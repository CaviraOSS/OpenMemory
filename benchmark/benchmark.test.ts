import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  BENCHMARKS,
  chunkText,
  createCogneeAdapter,
  createLlmJudge,
  createConversation,
  createFixtureAdapter,
  createMem0Adapter,
  createSupermemoryAdapter,
  createZepAdapter,
  BENCHMARK_SYSTEMS,
  createBenchmarkMatrixPlan,
  validateBenchmarkMatrixPreflight,
  formatBenchmarkPreflightError,
  generateOutputName,
  loadBenchmarkConfig,
  loadDatasetSource,
  loadExistingRun,
  normalizeDatasetPayload,
  parseBenchmarkArgs,
  renderTemplate,
  runBenchmark,
  runBenchmarkJob,
} from "./index";

describe("TypeScript memory benchmarks", () => {
  it("exposes only the approved benchmark suites", () => {
    assert.deepEqual(
      BENCHMARKS.map((benchmark) => benchmark.id),
      ["longmemeval", "longmemeval-v2", "locomo", "tremu"],
    );
  });

  it("keeps suite metadata tied to OpenMemory architecture claims", () => {
    const requiredCapabilities = new Set([
      "long_range_recall",
      "multi_session_reasoning",
      "knowledge_updates",
      "abstention",
      "agent_state_tracking",
      "workflow_memory",
      "temporal_reasoning",
      "bitemporal_recall",
    ]);

    const covered = new Set(
      BENCHMARKS.flatMap((benchmark) => benchmark.capabilities),
    );

    for (const capability of requiredCapabilities) {
      assert.ok(covered.has(capability), `missing ${capability}`);
    }
  });

  it("defines the five memory systems benchmarked against each other", () => {
    assert.deepEqual(
      BENCHMARK_SYSTEMS.map((system) => system.id),
      ["openmemory", "mem0", "cognee", "zep", "supermemory"],
    );
    assert.equal(
      BENCHMARK_SYSTEMS.find((system) => system.id === "openmemory")?.role,
      "subject",
    );
    assert.ok(
      BENCHMARK_SYSTEMS.filter((system) => system.role === "alternative").length,
      4,
    );
  });

  it("creates a five-system matrix plan for the same benchmark datasets", () => {
    const plan = createBenchmarkMatrixPlan({
      datasetConfigs: [
        "benchmark/configs/datasets/longmemeval.json",
        "benchmark/configs/datasets/locomo.json",
      ],
    });

    assert.equal(plan.jobs.length, 10);
    assert.deepEqual(
      plan.jobs.slice(0, 5).map((job) => job.system_id),
      ["openmemory", "mem0", "cognee", "zep", "supermemory"],
    );
    assert.equal(plan.jobs[0].agent_config, "benchmark/configs/agents/openmemory-http.json");
  });

  it("fails real matrix preflight when external memory credentials are missing", async () => {
    const plan = createBenchmarkMatrixPlan({
      systems: ["mem0", "zep", "supermemory"],
      agentConfigs: [
        benchmarkPath("configs/agents/mem0.json"),
        benchmarkPath("configs/agents/zep.json"),
        benchmarkPath("configs/agents/supermemory.json"),
      ],
      datasetConfigs: [benchmarkPath("configs/datasets/longmemeval.json")],
    });
    const result = await validateBenchmarkMatrixPreflight({
      jobs: plan.jobs,
      env: {},
    });

    assert.equal(result.ok, false);
    assert.match(formatBenchmarkPreflightError(result), /MEM0_API_KEY/);
    assert.match(formatBenchmarkPreflightError(result), /ZEP_API_KEY/);
    assert.match(formatBenchmarkPreflightError(result), /SUPERMEMORY_API_KEY/);
    assert.match(formatBenchmarkPreflightError(result), /OPENAI_API_KEY/);
  });

  it("passes matrix preflight when selected external systems are configured", async () => {
    const plan = createBenchmarkMatrixPlan({
      systems: ["mem0"],
      agentConfigs: [benchmarkPath("configs/agents/mem0.json")],
      datasetConfigs: [benchmarkPath("configs/datasets/longmemeval.json")],
    });
    const result = await validateBenchmarkMatrixPreflight({
      jobs: plan.jobs,
      env: { MEM0_API_KEY: "mem0", OPENAI_API_KEY: "openai" },
    });

    assert.equal(result.ok, true);
  });

  it("chunks context in order without dropping text", () => {
    const chunks = chunkText(
      "Alpha sentence. Beta sentence. Gamma sentence.",
      24,
    );

    assert.deepEqual(chunks, [
      "Alpha sentence.",
      "Beta sentence.",
      "Gamma sentence.",
    ]);
  });

  it("runs a MemoryAgentBench-style inject-once-query-many fixture", async () => {
    const longMemEval = BENCHMARKS.find(
      (benchmark) => benchmark.id === "longmemeval",
    );
    assert.ok(longMemEval);

    const result = await runBenchmark(longMemEval, {
      samples: [
        {
          id: "sample-1",
          context:
            "Mira moved the analytics warehouse from Firebase to Postgres. The migration happened after the March planning session.",
          queries: [
            {
              id: "q1",
              question: "What database does Mira prefer for analytics?",
              answers: ["Postgres"],
            },
            {
              id: "q2",
              question: "What was replaced?",
              answers: ["Firebase"],
            },
          ],
        },
      ],
      adapter: createFixtureAdapter({
        q1: "Postgres",
        q2: "Firebase",
      }),
      chunkSize: 80,
    });

    assert.equal(result.summary.total_queries, 2);
    assert.equal(result.summary.exact_match, 1);
    assert.equal(result.summary.f1, 1);
    assert.equal(result.records[0].context_id, "sample-1");
    assert.ok(result.records[0].ingested_chunks > 0);
  });

  it("loads agent and dataset configs with MemoryAgentBench-style overrides", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openmemory-benchmark-"));
    try {
      const agentConfig = join(dir, "agent.json");
      const datasetConfig = join(dir, "dataset.json");
      await writeFile(
        agentConfig,
        JSON.stringify({
          agent_name: "openmemory_v1",
          adapter: "fixture",
          output_dir: join(dir, "outputs"),
          model: "fixture",
          retrieve_num: 5,
        }),
      );
      await writeFile(
        datasetConfig,
        JSON.stringify({
          benchmark_id: "locomo",
          dataset: "Conversation_Memory",
          sub_dataset: "locomo_dev",
          chunk_size: 100,
          generation_max_length: 50,
          max_test_samples: 5,
          shots: 0,
          tag: "dev",
        }),
      );

      const config = await loadBenchmarkConfig({
        agentConfig,
        datasetConfig,
        chunkSize: 64,
        maxTestSamples: 2,
      });

      assert.equal(config.dataset.benchmark_id, "locomo");
      assert.equal(config.dataset.chunk_size, 64);
      assert.equal(config.dataset.max_test_samples, 2);
      assert.equal(
        generateOutputName(config.agent, config.dataset),
        "locomo_dev_dev_size50_shots0_max_samples2_openmemory_v1_fixture",
      );

      config.agent.agent_name = "Structure_rag_mem0";
      config.agent.retrieve_num = 100;
      config.agent.agent_chunk_size = 4096;
      assert.equal(
        generateOutputName(config.agent, config.dataset),
        "locomo_dev_dev_size50_shots0_max_samples2_k100_chunk4096_Structure_rag_mem0_fixture",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("parses npm-friendly positional CLI arguments", () => {
    assert.deepEqual(
      parseBenchmarkArgs([
        "benchmark/configs/agents/fixture.json",
        "benchmark/configs/datasets/locomo.json",
        "--rerun",
        "--llm_eval",
        "--download",
        "--max_test_queries_ablation",
        "3",
      ]),
      {
        agentConfig: "benchmark/configs/agents/fixture.json",
        datasetConfig: "benchmark/configs/datasets/locomo.json",
        force: true,
        llmEval: true,
        download: true,
        maxQueries: 3,
      },
    );
  });

  it("creates conversations from loaded samples", () => {
    const conversations = createConversation(
      [
        {
          id: "ctx",
          context: "One. Two. Three.",
          queries: [{ id: "q", question: "Which number?", answers: ["Two"] }],
        },
      ],
      { chunkSize: 6 },
    );

    assert.deepEqual(conversations[0].chunks, ["One.", "Two.", "Three."]);
    assert.equal(
      conversations[0].query_answer_pairs[0].question,
      "Which number?",
    );
  });

  it("normalizes MemoryAgentBench-shaped rows and preserves query metadata", () => {
    const samples = normalizeDatasetPayload(
      {
        data: [
          {
            id: "ctx-1",
            context: "A long prior conversation about moving from Firebase to Postgres.",
            questions: ["What database is current?"],
            answers: [["Postgres"]],
            metadata: {
              source: "longmemeval_s",
              qa_pair_ids: ["qa-1"],
              question_types: ["knowledge-update"],
              question_dates: ["2026-05-01"],
              previous_events: [["Firebase was used earlier."]],
            },
          },
        ],
      },
      {
        benchmark_id: "longmemeval",
        dataset: "Accurate_Retrieval",
        sub_dataset: "longmemeval_s",
        chunk_size: 4096,
        generation_max_length: 50,
        max_test_samples: 1,
        shots: 0,
      },
    );

    assert.equal(samples[0].id, "ctx-1");
    assert.equal(samples[0].queries[0].id, "qa-1");
    assert.equal(samples[0].queries[0].type, "knowledge-update");
    assert.equal(samples[0].queries[0].timestamp, "2026-05-01");
    assert.deepEqual(samples[0].queries[0].previous_events, [
      "Firebase was used earlier.",
    ]);
  });

  it("loads Hugging Face row datasets with pagination and source filtering", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      const offset = new URL(url).searchParams.get("offset");
      return response({
        rows:
          offset === "0"
            ? [
                {
                  row: {
                    context: "Keep this context",
                    questions: ["What should stay?"],
                    answers: [["this"]],
                    metadata: {
                      source: "longmemeval_s_-1_500",
                      qa_pair_ids: ["qa-keep"],
                    },
                  },
                },
                {
                  row: {
                    context: "Drop this context",
                    questions: ["What should drop?"],
                    answers: [["drop"]],
                    metadata: { source: "other" },
                  },
                },
              ]
            : [],
      });
    };

    const samples = await loadDatasetSource(
      {
        kind: "huggingface_rows",
        dataset: "ai-hyz/MemoryAgentBench",
        config: "default",
        split: "Accurate_Retrieval",
        source_filter: "longmemeval_s_-1_500",
        page_size: 2,
      },
      {
        benchmark_id: "longmemeval",
        dataset: "Accurate_Retrieval",
        sub_dataset: "longmemeval_s",
        chunk_size: 4096,
        generation_max_length: 50,
        max_test_samples: 10,
        shots: 0,
      },
      { fetcher, useCache: false },
    );

    assert.equal(calls.length, 2);
    assert.equal(samples.length, 1);
    assert.equal(samples[0].queries[0].id, "qa-keep");
  });

  it("loads Hugging Face JSONL and JSON files through a shared manifest source", async () => {
    const fetcher = async () =>
      response(
        [
          JSON.stringify({
            id: "q1",
            question: "What is current?",
            answer: "Postgres",
            context: "The current database is Postgres.",
          }),
          JSON.stringify({
            id: "q2",
            question: "What changed?",
            answer: "Firebase was replaced",
            context: "Firebase was replaced by Postgres.",
          }),
        ].join("\n"),
      );

    const samples = await loadDatasetSource(
      {
        kind: "huggingface_jsonl",
        dataset: "example/dataset",
        path: "questions.jsonl",
      },
      {
        benchmark_id: "longmemeval-v2",
        dataset: "Agent_Environment_Memory",
        sub_dataset: "longmemeval_v2",
        chunk_size: 4096,
        generation_max_length: 50,
        max_test_samples: 1,
        shots: 0,
      },
      { fetcher, useCache: false },
    );

    assert.equal(samples.length, 1);
    assert.equal(samples[0].queries[0].question, "What is current?");
    assert.deepEqual(samples[0].queries[0].answers, ["Postgres"]);
  });

  it("parses optional LLM judge JSON without requiring an SDK dependency", async () => {
    const judge = createLlmJudge({
      apiKey: "test-key",
      model: "judge-model",
      fetcher: async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.model, "judge-model");
        return response({
          choices: [
            {
              message: {
                content:
                  '{"score":0.75,"label":"partially_correct","rationale":"contains the key fact"}',
              },
            },
          ],
        });
      },
    });

    const result = await judge({
      benchmark_id: "longmemeval",
      context_id: "ctx",
      query_id: "q",
      question: "What database is current?",
      expected_answers: ["Postgres"],
      predicted_answer: "It is Postgres, replacing Firebase.",
      exact_match: 0,
      f1: 1,
      substring_match: 1,
      input_len: 0,
      output_len: 0,
      memory_construction_time: 0,
      query_time_len: 0,
      ingested_chunks: 1,
    });

    assert.equal(result.score, 0.75);
    assert.equal(result.label, "partially_correct");
  });

  it("supports Gemini as an LLM judge provider", async () => {
    const judge = createLlmJudge({
      provider: "gemini",
      apiKey: "gemini-key",
      model: "gemini-2.0-flash",
      fetcher: async (url, init) => {
        assert.match(String(url), /generativelanguage\.googleapis\.com/);
        assert.match(String(url), /key=gemini-key/);
        const body = JSON.parse(String(init?.body));
        assert.equal(body.generationConfig.responseMimeType, "application/json");
        return response({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"score":1,"label":"correct","rationale":"exact"}',
                  },
                ],
              },
            },
          ],
        });
      },
    });

    const result = await judge(minimalRecord());
    assert.equal(result.score, 1);
    assert.equal(result.label, "correct");
  });

  it("supports Siray.ai as an OpenAI-compatible LLM judge provider", async () => {
    const judge = createLlmJudge({
      provider: "siray",
      apiKey: "siray-key",
      model: "gpt-5.2-chat",
      fetcher: async (url, init) => {
        assert.equal(String(url), "https://api.siray.ai/v1/chat/completions");
        assert.equal((init?.headers as Record<string, string>).authorization, "Bearer siray-key");
        return response({
          choices: [
            {
              message: {
                content: '{"score":0,"label":"incorrect"}',
              },
            },
          ],
        });
      },
    });

    const result = await judge(minimalRecord());
    assert.equal(result.score, 0);
  });

  it("ports the MemoryAgentBench Mem0 flow: add chat messages, search memories, then generate", async () => {
    const added: unknown[] = [];
    const adapter = createMem0Adapter({
      retrieveNum: 3,
      memory: {
        add(messages, options) {
          added.push({ messages, options });
          return { ok: true };
        },
        search() {
          return { results: [{ memory: "The current database is Postgres" }] };
        },
      },
      generate: async ({ system, user }) => {
        assert.match(system, /The current database is Postgres/);
        assert.match(user, /What database/);
        return "Postgres";
      },
    });

    const sample = benchmarkSample();
    await adapter.reset(sample);
    await adapter.ingest("Mira moved analytics to Postgres.", sample);
    const answer = await adapter.answer(sample.queries[0], sample);

    assert.equal(added.length, 1);
    assert.equal((added[0] as any).options.user_id, "context_ctx_longmemeval");
    assert.equal((answer as any).output, "Postgres");
    assert.deepEqual((answer as any).retrieval_context, [
      "The current database is Postgres",
    ]);
  });

  it("ports the MemoryAgentBench Cognee flow: add, cognify, search dataset", async () => {
    const calls: string[] = [];
    const adapter = createCogneeAdapter({
      retrieveNum: 2,
      chunkSize: 128,
      cognee: {
        async add(_text, options) {
          calls.push(`add:${options.dataset_name}`);
        },
        async cognify(options) {
          calls.push(`cognify:${options.datasets[0]}:${options.chunk_size}`);
        },
        async search(options) {
          calls.push(`search:${options.datasets[0]}:${options.top_k}`);
          return ["Postgres memory", "Firebase replaced"];
        },
      },
    });

    const sample = benchmarkSample();
    await adapter.ingest("Mira moved analytics to Postgres.", sample);
    const answer = await adapter.answer(sample.queries[0], sample);

    assert.deepEqual(calls, [
      "add:default_dataset_longmemeval_context_ctx",
      "cognify:default_dataset_longmemeval_context_ctx:128",
      "search:default_dataset_longmemeval_context_ctx:2",
    ]);
    assert.equal((answer as any).output, "Postgres memory\nFirebase replaced\n");
  });

  it("ports the MemoryAgentBench Zep flow: graph/thread ingest, graph search, then generate", async () => {
    const calls: string[] = [];
    const searchQueries: string[] = [];
    let firstThreadMessage: any;
    const adapter = createZepAdapter({
      retrieveNum: 2,
      zep: {
        user: { add: ({ user_id }) => calls.push(`user:${user_id}`) },
        thread: {
          create: ({ thread_id }) => calls.push(`thread:${thread_id}`),
          addMessages: ({ thread_id, messages }) => {
            calls.push(`threadAdd:${thread_id}`);
            firstThreadMessage = (messages as any[])[0];
          },
          getUserContext: () => ({ context: "thread context" }),
        },
        graph: {
          create: ({ graph_id }) => calls.push(`graph:${graph_id}`),
          add: ({ graph_id, data }) => calls.push(`graphAdd:${graph_id}:${data.length}`),
          search: ({ scope, query }) => {
            searchQueries.push(query);
            if (scope === "edges") {
              return {
                edges: [
                  {
                    fact: "Mira moved analytics to Postgres",
                    valid_at: "2026-05-01",
                    invalid_at: null,
                  },
                ],
              };
            }
            if (scope === "nodes") {
              return { nodes: [{ name: "Postgres", summary: "current database" }] };
            }
            return { episodes: [{ content: "Mira replaced Firebase." }] };
          },
        },
      },
      generate: async ({ context }) => {
        assert.match(context, /Mira moved analytics to Postgres/);
        assert.match(context, /2026-05-01 - present/);
        assert.match(context, /Postgres: current database/);
        assert.match(context, /Content: Mira replaced Firebase/);
        assert.match(context, /thread context/);
        return "Postgres";
      },
    });

    const sample = benchmarkSample();
    await adapter.ingest("x".repeat(2600), sample);
    const answer = await adapter.answer(
      {
        ...sample.queries[0],
        question: "Prefix. Now Answer the Question: What database is current?",
      },
      sample,
    );

    assert.ok(calls.includes("user:user_ctx_longmemeval"));
    assert.equal(firstThreadMessage.content.length, 2400);
    assert.equal(searchQueries[0], "What database is current?");
    assert.equal((answer as any).output, "Postgres");
  });

  it("adds Supermemory through the same add/search/generate benchmark contract", async () => {
    const adapter = createSupermemoryAdapter({
      retrieveNum: 2,
      client: {
        async add({ content, container }) {
          assert.match(content, /Postgres/);
          assert.equal(container, "ctx");
        },
        async search() {
          return { results: [{ content: "Postgres memory" }] };
        },
      },
      generate: async ({ context }) => {
        assert.match(context, /Postgres memory/);
        return "Postgres";
      },
    });

    const sample = benchmarkSample();
    await adapter.ingest("Mira moved analytics to Postgres.", sample);
    const answer = await adapter.answer(sample.queries[0], sample);

    assert.equal((answer as any).output, "Postgres");
  });

  it("renders suite-aware query prompts without mutating stored question text", () => {
    const sample = {
      id: "ctx",
      context: "Rina changed the database to Postgres.",
      queries: [],
      metadata: { source: "longmemeval_s" },
    };
    const query = {
      id: "qa",
      question: "What database is current?",
      answers: ["Postgres"],
      type: "knowledge-update",
      timestamp: "2026-05-01",
      previous_events: ["Firebase was used earlier."],
    };
    const rendered = renderTemplate("query", {
      agent: {
        agent_name: "fixture",
        adapter: "fixture",
        output_dir: "benchmark-results",
        model: "fixture",
      },
      dataset: {
        benchmark_id: "longmemeval",
        dataset: "Accurate_Retrieval",
        sub_dataset: "longmemeval_s",
        chunk_size: 4096,
        generation_max_length: 50,
        max_test_samples: 1,
        shots: 0,
      },
      sample,
      query,
    });

    assert.match(rendered, /Question type: knowledge-update/);
    assert.match(rendered, /Previous events:/);
    assert.match(rendered, /Now Answer the Question:/);
    assert.equal(query.question, "What database is current?");
  });

  it("resumes from saved results and appends new query outputs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openmemory-benchmark-"));
    try {
      const outputPath = join(dir, "results.json");
      const benchmark = BENCHMARKS[0];
      const samples = [
        {
          id: "ctx",
          context: "The durable API stores memories in Postgres.",
          queries: [
            {
              id: "q1",
              question: "Where are memories stored?",
              answers: ["Postgres"],
            },
            {
              id: "q2",
              question: "What API is used?",
              answers: ["durable API"],
            },
          ],
        },
      ];

      await runBenchmarkJob({
        benchmark,
        samples,
        adapter: createFixtureAdapter({ q1: "Postgres" }),
        chunkSize: 80,
        outputPath,
        maxQueries: 1,
        force: true,
      });

      const resumed = await loadExistingRun(outputPath);
      assert.equal(resumed.records.length, 1);
      assert.equal(resumed.next_query_index, 1);

      const finished = await runBenchmarkJob({
        benchmark,
        samples,
        adapter: createFixtureAdapter({ q1: "Postgres", q2: "durable API" }),
        chunkSize: 80,
        outputPath,
      });

      assert.equal(finished.summary.total_queries, 2);
      assert.equal(finished.summary.exact_match, 1);
      const saved = JSON.parse(await readFile(outputPath, "utf8"));
      assert.equal(saved.data.length, 2);
      assert.equal(saved.summary.total_queries, 2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function response(body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: true,
    status: 200,
    text: async () => text,
    json: async () => JSON.parse(text),
  } as Response;
}

function minimalRecord() {
  return {
    benchmark_id: "longmemeval" as const,
    context_id: "ctx",
    query_id: "q",
    question: "What database is current?",
    expected_answers: ["Postgres"],
    predicted_answer: "Postgres",
    exact_match: 1,
    f1: 1,
    substring_match: 1,
    input_len: 0,
    output_len: 0,
    memory_construction_time: 0,
    query_time_len: 0,
    ingested_chunks: 1,
  };
}

function benchmarkSample() {
  return {
    id: "ctx",
    context: "Mira moved analytics to Postgres.",
    metadata: { benchmark: "longmemeval", sub_dataset: "longmemeval" },
    queries: [
      {
        id: "q",
        question: "What database is current?",
        answers: ["Postgres"],
      },
    ],
  };
}

function benchmarkPath(path: string): string {
  const cwd = process.cwd().replace(/\\/g, "/");
  const repoRoot = cwd.endsWith("/packages/openmemory-js")
    ? join(process.cwd(), "../..")
    : process.cwd();
  return join(repoRoot, "benchmark", path);
}
