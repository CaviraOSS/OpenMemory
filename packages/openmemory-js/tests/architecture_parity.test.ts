import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExtractionCandidateInput,
  extractDurableFacets,
} from "../src/durable/ingestion";
import {
  buildLegacyMigrationReport,
  normalizeLegacyMemoryRow,
} from "../src/durable/migrationReport";
import {
  executeDurableEdgeHandler,
  moveDurableMemoryTier,
  recallDurableMemories,
  queryDurableTemporalGraph,
  runDurableDecayJob,
} from "../src/durable/repository";
import { createHttpApp } from "../src/api/httpApp";
import { getExternalVectorCandidateIds, v1 } from "../src/api/routes/v1";
import { env } from "../src/configuration";
import {
  get_model,
  load_models,
  resolveEmbeddingModel,
} from "../src/database/models";
import {
  embedForFacet,
  getEmbeddingInfo,
  getEmbeddingTimeoutMs,
} from "../src/embeddings/embed";
import { computeSimhash, hammingDistance } from "../src/utilities/fingerprint";
import { detectTextLanguage } from "../src/utilities/language";
import {
  computeKeywordOverlap,
  extractKeywords,
} from "../src/utilities/keyword";
import { canonical_tokens_from_text } from "../src/utilities/text";
import { scoreDurableRecall } from "../src/durable/scoring";
import {
  signDurableSourcePayload,
  verifyDurableSourceSignature,
} from "../src/durable/sourceAuth";
import {
  SourceConfigError,
  ingestSourceConnector,
  withSourceRetry,
} from "../src/sources/framework";
import {
  OptionalExtractorUnavailable,
  extractUrlContent,
  extractDocumentContent,
  extractionToCandidateInput,
} from "../src/ingestion/extract";
import { chunkTextForCandidates } from "../src/ingestion/chunking";
import { previewMemoryCompression } from "../src/ingestion/compression";
import { SourceRateLimiter } from "../src/sources/framework";
import { getSourceConnector } from "../src/sources/registry";
import { MCP_TOOL_NAMES, createMcpToolRegistry } from "../src/mcp/server";
import {
  KNOWN_VECTOR_STORES,
  buildVectorStoreFilter,
  getVectorStoreConfig,
  normalizeVectorStoreKind,
} from "../src/vectorStores";

const fakeDb = () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  return {
    calls,
    db: {
      async query(sql: string, params: unknown[] = []) {
        calls.push({ sql, params });
        if (/returning/i.test(sql)) {
          return { rows: [{ id: "row-1", status: "ok" }] };
        }
        return { rows: [] };
      },
    },
  };
};

test("deterministic ingestion extracts facets from content and source", () => {
  const facets = extractDurableFacets({
    content: "Yesterday I fixed the deploy steps and learned the API contract.",
    source: { kind: "manual", id: "note-1" },
  });

  assert.equal(facets.episodic, true);
  assert.equal(facets.procedural, true);
  assert.equal(facets.reflective, true);
  assert.equal(facets.semantic, true);
  assert.equal(facets.source_kind, "manual");
});

test("ingestion event can build an automatic extraction candidate", () => {
  const candidate = buildExtractionCandidateInput({
    event_id: "event-1",
    user_id: "user-1",
    project_id: "project-1",
    content: "This API key is sensitive and expires tomorrow.",
    source: { kind: "manual" },
    metadata: { priority: "high" },
    contracts: { source_visibility: "hidden" },
  });

  assert.equal(candidate.event_id, "event-1");
  assert.equal(candidate.facets.semantic, true);
  assert.equal(candidate.contracts.source_visibility, "hidden");
  assert.equal(candidate.metadata.priority, "high");
  assert.equal(candidate.metadata.language, "en");
  assert.equal(typeof candidate.metadata.simhash, "string");
  assert.equal(candidate.metadata.token_count, 8);
  assert.equal(candidate.confidence, 0.6);
});

test("language detection handles multilingual text without external services", () => {
  assert.equal(detectTextLanguage("I fixed the deployment process.").language, "en");
  assert.equal(detectTextLanguage("我喜欢普洱茶").language, "zh");
  assert.equal(detectTextLanguage("これは日本語のメモです").language, "ja");
  assert.equal(detectTextLanguage("배포 절차를 수정했습니다").language, "ko");
});

test("simhash is stable and separates different multilingual phrases", () => {
  const left = computeSimhash("我喜欢健身");
  const right = computeSimhash("我喜欢普洱茶");

  assert.equal(computeSimhash("I like dark theme"), computeSimhash("I like dark theme"));
  assert.notEqual(left, right);
  assert.ok(hammingDistance(left, right) > 0);
  assert.notEqual(computeSimhash("!!!"), computeSimhash("???"));
});

test("multilingual tokenization keeps Cyrillic and Chinese memories distinct", () => {
  const cyrillicApples = "Я люблю яблоки";
  const cyrillicCars = "Я люблю машины";
  const chineseTea = "我喜欢普洱茶";
  const chineseFitness = "我喜欢健身";

  assert.deepEqual(canonical_tokens_from_text(cyrillicApples), [
    "люблю",
    "яблоки",
  ]);
  assert.notEqual(computeSimhash(cyrillicApples), computeSimhash(cyrillicCars));
  assert.notEqual(computeSimhash(chineseTea), computeSimhash(chineseFitness));
  assert.ok(
    computeKeywordOverlap(extractKeywords("普洱茶"), extractKeywords(chineseTea)) >
      computeKeywordOverlap(extractKeywords("普洱茶"), extractKeywords(chineseFitness)),
  );
});

test("keyword scoring gives bounded lexical boost for overlapping text", () => {
  const query = extractKeywords("deploy api contract");
  const matching = extractKeywords("The API contract controls deploy safety.");
  const unrelated = extractKeywords("I bought tea yesterday.");

  assert.ok(computeKeywordOverlap(query, matching) > computeKeywordOverlap(query, unrelated));

  const base = scoreDurableRecall({ confidence: 0.5, salience: 0.5, provenance_count: 1 });
  const boosted = scoreDurableRecall({
    confidence: 0.5,
    salience: 0.5,
    provenance_count: 1,
    lexical_score: 1,
  });

  assert.ok(boosted.score > base.score);
  assert.ok(boosted.lexical > 0);
});

test("gemini embedding config uses the current embedding model", () => {
  const originalProvider = env.emb_kind;
  const originalGeminiKey = env.gemini_key;

  try {
    env.emb_kind = "gemini";
    env.gemini_key = "test-key";

    assert.equal(get_model("semantic", "gemini"), "models/gemini-embedding-001");
    assert.equal(getEmbeddingInfo().model, "gemini-embedding-001");
  } finally {
    env.emb_kind = originalProvider;
    env.gemini_key = originalGeminiKey;
  }
});

test("embedding model config loads the repository models.yml", () => {
  const errors: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  try {
    assert.equal(load_models().semantic.gemini, "models/gemini-embedding-001");
    assert.ok(
      !errors.some((args) => String(args[0]).includes("models.yml not found")),
      "models.yml should be discovered from the package workspace",
    );
  } finally {
    console.error = originalError;
  }
});

test("embedding provider fallback handles invalid providers without hanging", async () => {
  const originalProvider = env.emb_kind;
  const originalFallback = [...env.embedding_fallback];

  try {
    env.emb_kind = "missing-provider";
    env.embedding_fallback = ["synthetic"];

    const vector = await embedForFacet("fallback chain stays deterministic", "semantic");

    assert.equal(vector.length, env.vec_dim);
    assert.ok(vector.some((value) => value !== 0));
  } finally {
    env.emb_kind = originalProvider;
    env.embedding_fallback = originalFallback;
  }
});

test("embedding timeout config rejects invalid values and supports small test timeouts", () => {
  const originalTimeout = process.env.OM_EMBED_TIMEOUT_MS;

  try {
    delete process.env.OM_EMBED_TIMEOUT_MS;
    assert.equal(getEmbeddingTimeoutMs(), 30000);

    process.env.OM_EMBED_TIMEOUT_MS = "7";
    assert.equal(getEmbeddingTimeoutMs(), 7);

    process.env.OM_EMBED_TIMEOUT_MS = "-1";
    assert.equal(getEmbeddingTimeoutMs(), 30000);

    process.env.OM_EMBED_TIMEOUT_MS = "abc";
    assert.equal(getEmbeddingTimeoutMs(), 30000);
  } finally {
    if (originalTimeout === undefined) {
      delete process.env.OM_EMBED_TIMEOUT_MS;
    } else {
      process.env.OM_EMBED_TIMEOUT_MS = originalTimeout;
    }
  }
});

test("embedding model routing supports provider and facet env overrides", () => {
  const envOverrides = {
    OM_EMBED_MODEL: "global-model",
    OM_GEMINI_MODEL: "models/gemini-provider",
    OM_GEMINI_SEMANTIC_MODEL: "models/gemini-semantic",
  };

  assert.equal(
    resolveEmbeddingModel("semantic", "gemini", { env: envOverrides }),
    "models/gemini-semantic",
  );
  assert.equal(
    resolveEmbeddingModel("episodic", "gemini", { env: envOverrides }),
    "models/gemini-provider",
  );
  assert.equal(
    resolveEmbeddingModel("semantic", "pinecone", { env: envOverrides }),
    "global-model",
  );
});

test("embedding info reports normalized provider chain and routed models", () => {
  const originalProvider = env.emb_kind;
  const originalFallback = [...env.embedding_fallback];
  const originalGeminiModel = process.env.OM_GEMINI_MODEL;

  try {
    env.emb_kind = "gemini";
    env.embedding_fallback = ["gemini", "synthetic", "missing", "synthetic"];
    process.env.OM_GEMINI_MODEL = "models/custom-gemini";

    const info = getEmbeddingInfo();

    assert.deepEqual(info.provider_chain, ["gemini", "synthetic"]);
    assert.equal(info.models.semantic, "models/custom-gemini");
  } finally {
    env.emb_kind = originalProvider;
    env.embedding_fallback = originalFallback;
    if (originalGeminiModel === undefined) {
      delete process.env.OM_GEMINI_MODEL;
    } else {
      process.env.OM_GEMINI_MODEL = originalGeminiModel;
    }
  }
});

test("vector store config recognizes active popular vector databases", () => {
  assert.deepEqual(KNOWN_VECTOR_STORES, [
    "postgres",
    "qdrant",
    "valkey",
    "redis",
    "pinecone",
    "weaviate",
    "chroma",
    "milvus",
  ]);
  assert.equal(normalizeVectorStoreKind("redis"), "valkey");
  assert.equal(normalizeVectorStoreKind("unknown"), "postgres");

  const qdrant = getVectorStoreConfig({
    OM_VECTOR_STORE: "qdrant",
    OM_QDRANT_URL: "http://localhost:6333",
    OM_QDRANT_API_KEY: "key",
    OM_VECTOR_COLLECTION: "memories",
  });

  assert.equal(qdrant.kind, "qdrant");
  assert.equal(qdrant.endpoint, "http://localhost:6333");
  assert.equal(qdrant.api_key, "key");
  assert.equal(qdrant.collection, "memories");
});

test("external vector filters preserve tenant and global project visibility", () => {
  assert.deepEqual(
    buildVectorStoreFilter({ user_id: "u1", project_id: "p1" }),
    {
      user_id: "u1",
      project_id: "p1",
      include_global_project: true,
    },
  );
});

test("durable recall can constrain candidates from an external vector store", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };

  await recallDurableMemories(db, {
    query: "deployment notes",
    user_id: "u1",
    candidate_ids: ["m2", "m1"],
  });

  assert.match(calls[0].sql, /m\.id = any/i);
  assert.match(calls[0].sql, /array_position/i);
  assert.deepEqual(calls[0].params.find(Array.isArray), ["m2", "m1"]);
});

test("v1 recall helper uses external vector store candidates when configured", async () => {
  const candidateIds = await getExternalVectorCandidateIds(
    {
      kind: "qdrant",
      query: async (input: any) => {
        assert.equal(input.user_id, "u1");
        assert.equal(input.project_id, "p1");
        return [{ id: "m2" }, { id: "m1" }];
      },
    } as any,
    {
      embedding: [0.1, 0.2],
      limit: 2,
      user_id: "u1",
      project_id: "p1",
    },
  );

  assert.deepEqual(candidateIds, ["m2", "m1"]);
});

test("durable source HMAC accepts current and rejects tampered webhook payloads", () => {
  const body = Buffer.from(JSON.stringify({ content: "source event" }));
  const signature = signDurableSourcePayload(body, "secret");

  assert.deepEqual(
    verifyDurableSourceSignature({
      source_kind: "github_webhook",
      raw_body: body,
      headers: { "x-hub-signature-256": signature },
      secrets: { OM_GITHUB_WEBHOOK_SECRET: "secret" },
    }),
    { ok: true, required: true, secret_env: "OM_GITHUB_WEBHOOK_SECRET" },
  );

  assert.equal(
    verifyDurableSourceSignature({
      source_kind: "github_webhook",
      raw_body: Buffer.from("{}"),
      headers: { "x-hub-signature-256": signature },
      secrets: { OM_GITHUB_WEBHOOK_SECRET: "secret" },
    }).reason,
    "mismatch",
  );
});

test("v1 ingest rejects invalid webhook signature before durable writes", async () => {
  const app = createHttpApp();
  v1(app);
  const route = app.routes.find(
    (candidate) =>
      candidate.method === "POST" && candidate.path === "/v1/ingest",
  );
  assert.ok(route);

  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const originalSecret = process.env.OM_GITHUB_WEBHOOK_SECRET;
  process.env.OM_GITHUB_WEBHOOK_SECRET = "secret";

  try {
    await route.handler(
      {
        body: {
          source: { kind: "github_webhook" },
          content: "source event",
        },
        rawBody: Buffer.from(JSON.stringify({ content: "source event" })),
        headers: { "x-hub-signature-256": "sha256=00" },
      } as any,
      response as any,
    );

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, {
      err: "invalid_signature",
      reason: "bad_signature",
    });
  } finally {
    if (originalSecret === undefined) {
      delete process.env.OM_GITHUB_WEBHOOK_SECRET;
    } else {
      process.env.OM_GITHUB_WEBHOOK_SECRET = originalSecret;
    }
  }
});

test("executable supersedes edge closes the target and audits the action", async () => {
  const { db, calls } = fakeDb();

  await executeDurableEdgeHandler(db, {
    edge_id: "edge-1",
    edge_type: "supersedes",
    source_memory_id: "new-memory",
    target_memory_id: "old-memory",
    user_id: "user-1",
    project_id: "project-1",
    metadata: { reason: "newer fact" },
    now: new Date("2026-05-19T00:00:00Z"),
  });

  assert.match(
    calls.map((call) => call.sql).join("\n"),
    /update .*memories.*superseded_at/is,
  );
  assert.ok(
    calls.some((call) => call.params.includes("edge.supersedes")),
    "writes edge.supersedes audit event",
  );
});

test("memory tier movement updates accessibility without deleting memory", async () => {
  const { db, calls } = fakeDb();

  const moved = await moveDurableMemoryTier(db, {
    id: "memory-1",
    tier: "archived",
    user_id: "user-1",
    reason: "low access",
  });

  assert.equal(moved?.tier, "archived");
  assert.match(calls.map((call) => call.sql).join("\n"), /memory_tier/is);
  assert.doesNotMatch(calls.map((call) => call.sql).join("\n"), /delete from/i);
});

test("memory tier movement returns null when no current memory matches", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      return { rows: [] };
    },
  };

  const moved = await moveDurableMemoryTier(db, {
    id: "missing-memory",
    tier: "cold",
    user_id: "user-1",
  });

  assert.equal(moved, null);
  assert.ok(
    !calls.some((call) => call.params.includes("memory.tier")),
    "does not audit a missing memory update",
  );
});

test("durable decay job lowers salience and writes audit without deleting", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (/select .* from .*memories/is.test(sql)) {
        return {
          rows: [
            {
              id: "memory-1",
              user_id: "user-1",
              project_id: "project-1",
              salience: 0.8,
              memory_tier: "cold",
              recorded_at: "2026-04-19T00:00:00.000Z",
            },
          ],
        };
      }
      if (/update .*memories/is.test(sql)) {
        return {
          rows: [
            {
              id: "memory-1",
              user_id: "user-1",
              project_id: "project-1",
              salience: 0.15,
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await runDurableDecayJob(db, {
    user_id: "user-1",
    project_id: "project-1",
    limit: 10,
    now: new Date("2026-05-19T00:00:00.000Z"),
  });

  assert.equal(result.scanned, 1);
  assert.equal(result.changed, 1);
  assert.ok(result.memories[0].salience_after < result.memories[0].salience_before);
  assert.ok(calls.some((call) => call.params.includes("memory.decay")));
  assert.doesNotMatch(calls.map((call) => call.sql).join("\n"), /delete from/i);
});

test("durable decay dry run computes changes without writes", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (/select .* from .*memories/is.test(sql)) {
        return {
          rows: [
            {
              id: "memory-1",
              user_id: "user-1",
              project_id: null,
              salience: 0.4,
              memory_tier: "warm",
              recorded_at: "2026-05-01T00:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await runDurableDecayJob(db, {
    dry_run: true,
    now: new Date("2026-05-19T00:00:00.000Z"),
  });

  assert.equal(result.scanned, 1);
  assert.equal(result.changed, 1);
  assert.ok(!calls.some((call) => /update .*memories/is.test(call.sql)));
  assert.ok(!calls.some((call) => call.params.includes("memory.decay")));
});

test("source connector framework writes durable events and candidates", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (/working_memory_events/is.test(sql) && /returning/i.test(sql)) {
        return { rows: [{ id: "event-1", status: "pending" }] };
      }
      if (/extraction_candidates/is.test(sql) && /returning/i.test(sql)) {
        return { rows: [{ id: "candidate-1", status: "pending" }] };
      }
      return { rows: [] };
    },
  };
  const connector = {
    kind: "github",
    async list() {
      return [{ id: "issue-1" }];
    },
    async fetch() {
      return {
        id: "issue-1",
        content: "GitHub issue describes durable source ingestion.",
        uri: "https://github.com/org/repo/issues/1",
        content_type: "text/markdown",
        metadata: { repo: "org/repo" },
      };
    },
  };

  const result = await ingestSourceConnector(db, connector, {
    user_id: "user-1",
    project_id: "project-1",
  });

  assert.deepEqual(result, {
    ingested: 1,
    failed: 0,
    events: [{ event_id: "event-1", candidate_id: "candidate-1" }],
    errors: [],
  });
  assert.ok(calls.some((call) => /working_memory_events/is.test(call.sql)));
  assert.ok(calls.some((call) => /extraction_candidates/is.test(call.sql)));
  assert.ok(!calls.some((call) => /retention|ingestDocument/is.test(call.sql)));
});

test("source connector retry does not retry configuration errors", async () => {
  let attempts = 0;

  await assert.rejects(
    () =>
      withSourceRetry(
        async () => {
          attempts += 1;
          throw new SourceConfigError("missing token", "github");
        },
        { attempts: 3, base_delay_ms: 1 },
      ),
    /missing token/,
  );

  assert.equal(attempts, 1);
});

test("source connector retry handles transient failures", async () => {
  let attempts = 0;
  const result = await withSourceRetry(
    async () => {
      attempts += 1;
      if (attempts < 2) throw new Error("temporary");
      return "ok";
    },
    { attempts: 3, base_delay_ms: 1 },
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("source rate limiter schedules exhausted tokens without real sleeps", async () => {
  let now = 0;
  const waits: number[] = [];
  const limiter = new SourceRateLimiter({
    requests_per_second: 2,
    now: () => now,
    sleep: async (ms) => {
      waits.push(ms);
      now += ms;
    },
  });

  await limiter.acquire();
  await limiter.acquire();
  await limiter.acquire();

  assert.deepEqual(waits, [500]);
});

test("chunking preserves document order and content", () => {
  const text = [
    "First paragraph explains durable ingestion.",
    "Second paragraph keeps source metadata intact.",
    "Third paragraph becomes another candidate chunk.",
  ].join("\n\n");

  const chunks = chunkTextForCandidates(text, { target_chars: 55 });

  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((chunk) => chunk.text).join("\n\n"), text);
  assert.deepEqual(
    chunks.map((chunk) => chunk.index),
    chunks.map((_, index) => index),
  );
  assert.equal(chunkTextForCandidates("short text")[0].text, "short text");
});

test("compression preview removes boilerplate without mutating memory", () => {
  const preview = previewMemoryCompression(
    "I think that TypeScript documentation is very important due to the fact that the repository needs documentation.",
    "aggressive",
  );

  assert.match(preview.compressed, /TS|docs|repo/);
  assert.ok(preview.metrics.compressed_tokens < preview.metrics.original_tokens);
  assert.ok(preview.metrics.saved_tokens > 0);
  assert.equal(preview.mutates_storage, false);
});

test("document extraction keeps text exact and prepares durable candidates", async () => {
  const extracted = await extractDocumentContent("text/plain", "Line 1\nLine 2");
  const candidate = extractionToCandidateInput({
    event_id: "event-1",
    user_id: "user-1",
    content: extracted,
  });

  assert.equal(extracted.text, "Line 1\nLine 2");
  assert.equal(extracted.metadata.extraction_method, "passthrough");
  assert.equal(candidate.content, "Line 1\nLine 2");
  assert.equal(candidate.metadata.content_type, "text/plain");
  assert.equal(candidate.metadata.char_count, 13);
});

test("document ingestion route is registered on durable v1 only", () => {
  const app = createHttpApp();
  v1(app);
  const routes = app.getRoutes();

  assert.ok(routes.POST.includes("/v1/ingest/document"));
  assert.ok(!routes.POST.includes("/memory/ingest"));
  assert.ok(!routes.POST.includes("/retention/ingest"));
});

test("source ingestion route is registered on durable v1 only", () => {
  const app = createHttpApp();
  v1(app);
  const routes = app.getRoutes();

  assert.ok(routes.POST.includes("/v1/sources/:source/ingest"));
  assert.ok(!routes.POST.includes("/sources/:source/ingest"));
});

test("url extraction uses injected fetcher and source metadata", async () => {
  const extracted = await extractUrlContent(
    "https://example.com/docs",
    async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          "<html><body><h1>Docs</h1><script>bad()</script><p>Use durable ingestion.</p></body></html>",
      }) as Response,
  );

  assert.equal(extracted.text, "Docs\nUse durable ingestion.");
  assert.equal(extracted.metadata.content_type, "url");
  assert.equal(extracted.metadata.source_url, "https://example.com/docs");
  assert.equal(extracted.metadata.extraction_method, "fetch+html-strip");

  await assert.rejects(
    () =>
      extractUrlContent(
        "https://example.com/missing",
        async () =>
          ({
            ok: false,
            status: 404,
            statusText: "Not Found",
            text: async () => "",
          }) as Response,
      ),
    /HTTP 404/,
  );
});

test("source registry exposes web and github without legacy Memory.source", () => {
  assert.equal(getSourceConnector("web", { urls: ["https://example.com"] }).kind, "web");
  assert.equal(getSourceConnector("github", { repo: "org/repo" }).kind, "github");
  assert.equal(getSourceConnector("notion", {}).kind, "notion");
});

test("notion source maps pages and blocks into source content", async () => {
  const client = {
    search: async () => ({
      results: [
        {
          id: "page-1",
          url: "https://notion.so/page-1",
          last_edited_time: "2026-05-20T00:00:00.000Z",
          properties: {
            Name: { type: "title", title: [{ plain_text: "Roadmap" }] },
          },
        },
      ],
    }),
    pages: {
      retrieve: async () => ({
        id: "page-1",
        url: "https://notion.so/page-1",
        properties: {
          Name: { type: "title", title: [{ plain_text: "Roadmap" }] },
        },
      }),
    },
    blocks: {
      children: {
        list: async () => ({
          has_more: false,
          results: [
            {
              type: "heading_1",
              heading_1: { rich_text: [{ plain_text: "Plan" }] },
            },
            {
              type: "to_do",
              to_do: { checked: true, rich_text: [{ plain_text: "Ship sources" }] },
            },
          ],
        }),
      },
    },
  };
  const connector = getSourceConnector("notion", { client });

  const items = await connector.list();
  const content = await connector.fetch(items[0].id);

  assert.equal(items[0].name, "Roadmap");
  assert.equal(content.content, "# Roadmap\n\nPlan\n\n[x] Ship sources");
  assert.equal(content.content_type, "text/markdown");
  assert.equal(content.metadata?.source, "notion");
});

test("google drive source exports docs sheets and slides through injected service", async () => {
  const service = {
    files: {
      list: async () => ({
        data: {
          files: [
            {
              id: "doc-1",
              name: "Spec",
              mimeType: "application/vnd.google-apps.document",
              modifiedTime: "2026-05-20T00:00:00.000Z",
            },
          ],
        },
      }),
      get: async () => ({
        data: {
          id: "doc-1",
          name: "Spec",
          mimeType: "application/vnd.google-apps.document",
        },
      }),
      export: async () => ({ data: "Durable source spec" }),
    },
  };
  const connector = getSourceConnector("google_drive", { service });

  const items = await connector.list({ folder_id: "folder-1" });
  const content = await connector.fetch(items[0].id);

  assert.equal(items[0].name, "Spec");
  assert.equal(content.content, "Durable source spec");
  assert.equal(content.content_type, "text/plain");
  assert.equal(content.metadata?.source, "google_drive");
});

test("onedrive source lists and fetches items through injected fetch", async () => {
  const fetcher = async (url: string) => {
    if (url.endsWith("/children")) {
      return {
        ok: true,
        json: async () => ({
          value: [
            {
              id: "item-1",
              name: "Note.txt",
              size: 12,
              file: { mimeType: "text/plain" },
              webUrl: "https://onedrive/item-1",
            },
          ],
        }),
      } as Response;
    }
    if (url.endsWith("/items/item-1")) {
      return {
        ok: true,
        json: async () => ({
          id: "item-1",
          name: "Note.txt",
          size: 12,
          file: { mimeType: "text/plain" },
          webUrl: "https://onedrive/item-1",
        }),
      } as Response;
    }
    return {
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("OneDrive note").buffer,
    } as Response;
  };
  const connector = getSourceConnector("onedrive", {
    access_token: "token",
    fetcher,
  });

  const items = await connector.list();
  const content = await connector.fetch(items[0].id);

  assert.equal(items[0].name, "Note.txt");
  assert.equal(content.content.toString(), "OneDrive note");
  assert.equal(content.content_type, "text/plain");
  assert.equal(content.metadata?.source, "onedrive");
});

test("web crawler source discovers same-host pages within bounds", async () => {
  const pages: Record<string, string> = {
    "https://example.com": '<title>Home</title><main>Home<a href="/docs">Docs</a><a href="https://other.com/x">Other</a></main>',
    "https://example.com/docs": "<title>Docs</title><main>Durable docs</main>",
  };
  const fetcher = async (url: string) =>
    ({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "text/html" },
      text: async () => pages[url],
    }) as Response;
  const connector = getSourceConnector("web_crawler", {
    start_url: "https://example.com",
    max_pages: 2,
    max_depth: 1,
    fetcher,
  });

  const items = await connector.list();
  const content = await connector.fetch("https://example.com/docs");

  assert.deepEqual(
    items.map((item) => item.id),
    ["https://example.com", "https://example.com/docs"],
  );
  assert.equal(content.content, "Docs\nDurable docs");
  assert.equal(content.metadata?.source, "web_crawler");
});

test("web source connector fetches url content through injected fetch", async () => {
  const connector = getSourceConnector("web", {
    urls: ["https://example.com/a"],
    fetcher: async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "<h1>A</h1><p>Durable web source.</p>",
      }) as Response,
  });

  const items = await connector.list();
  const content = await connector.fetch(items[0].id);

  assert.deepEqual(items, [
    { id: "https://example.com/a", name: "https://example.com/a", type: "url", uri: "https://example.com/a" },
  ]);
  assert.equal(content.content, "A\nDurable web source.");
  assert.equal(content.content_type, "text/html");
  assert.equal(content.metadata?.extraction_method, "fetch+html-strip");
});

test("mcp tool registry is import safe and exposes durable tool names", () => {
  assert.deepEqual(MCP_TOOL_NAMES, [
    "openmemory_store",
    "openmemory_search",
    "openmemory_get",
    "openmemory_list",
    "openmemory_update",
    "openmemory_delete",
    "openmemory_explain",
    "openmemory_ingest",
  ]);

  const registry = createMcpToolRegistry({ base_url: "http://localhost:8080" });
  assert.deepEqual(
    registry.tools.map((tool) => tool.name),
    MCP_TOOL_NAMES,
  );
});

test("temporal graph query filters durable edges by time and tenant", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      return {
        rows: [
          {
            edge_id: "edge-1",
            source_memory_id: "source-1",
            target_memory_id: "target-1",
            edge_type: "depends_on",
            confidence: 0.7,
            weight: 0.8,
            valid_from: "2026-05-01T00:00:00.000Z",
            valid_to: null,
            source_content: "source",
            target_content: "target",
          },
        ],
      };
    },
  };

  const result = await queryDurableTemporalGraph(db, {
    user_id: "user-1",
    project_id: "project-1",
    at_time: "2026-05-19T00:00:00.000Z",
    edge_type: "depends_on",
  });

  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].edge_type, "depends_on");
  assert.match(calls[0].sql, /e\.user_id =/);
  assert.match(calls[0].sql, /source\.user_id =/);
  assert.match(calls[0].sql, /target\.user_id =/);
  assert.match(calls[0].sql, /valid_from/i);
  assert.ok(calls[0].params.includes("user-1"));
});

test("temporal graph route is registered separately from old temporal routes", () => {
  const app = createHttpApp();
  v1(app);
  const routes = app.getRoutes();

  assert.ok(routes.POST.includes("/v1/graph/temporal/query"));
  assert.ok(!routes.POST.includes("/temporal/query"));
});

test("optional media extractors fail clearly without hard dependencies", async () => {
  await assert.rejects(
    () => extractDocumentContent("audio/mpeg", Buffer.from("audio")),
    OptionalExtractorUnavailable,
  );
});

test("legacy migration report maps old rows without mutating them", () => {
  const row = {
    id: "old-1",
    content: "learned deploy process",
    primary_sector: "procedural",
    tags: JSON.stringify(["deploy", "api"]),
    meta: JSON.stringify({ source: "legacy" }),
    created_at: 1710000000000,
  };

  const mapped = normalizeLegacyMemoryRow(row);
  const report = buildLegacyMigrationReport({
    memories: [row],
    waypoints: [{ from: "old-1", to: "old-2" }],
    temporal_facts: [{ content: "valid until Friday" }],
  });

  assert.equal(mapped.id, "old-1");
  assert.equal(mapped.facets.procedural, true);
  assert.deepEqual(mapped.facets.tags, ["deploy", "api"]);
  assert.equal(mapped.metadata.source, "legacy");
  assert.equal(report.counts.memories, 1);
  assert.equal(report.counts.edges, 1);
  assert.equal(report.counts.temporal_facts, 1);
});

test("v1 routes expose durable lifecycle, ingestion, edge, and tier controls", () => {
  const app = createHttpApp();
  v1(app);
  const routes = app.getRoutes();

  assert.ok(routes.GET.includes("/v1/memories"));
  assert.ok(routes.GET.includes("/v1/memories/:id"));
  assert.ok(routes.GET.includes("/v1/memories/:id/explain"));
  assert.ok(routes.POST.includes("/v1/memories"));
  assert.ok(routes.POST.includes("/v1/recall"));
  assert.ok(routes.PATCH.includes("/v1/memories/:id"));
  assert.ok(routes.DELETE.includes("/v1/memories/:id"));
  assert.ok(routes.POST.includes("/v1/memories/:id/reinforce"));
  assert.ok(routes.POST.includes("/v1/memories/:id/tier"));
  assert.ok(routes.POST.includes("/v1/ingest"));
  assert.ok(routes.POST.includes("/v1/ingest/document"));
  assert.ok(routes.POST.includes("/v1/sources/:source/ingest"));
  assert.ok(routes.POST.includes("/v1/edges/execute"));
  assert.ok(routes.POST.includes("/v1/consolidations/:id/complete"));
  assert.ok(routes.POST.includes("/v1/admin/decay/run"));
});
