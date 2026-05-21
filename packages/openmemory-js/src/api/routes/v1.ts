import { all_async, run_async, transaction } from "../../database/connection";
import {
  claimDurableConsolidation,
  completeDurableConsolidation,
  createExtractionCandidate,
  createDurableContradiction,
  createDurableConsolidation,
  createWorkingMemoryEvent,
  DurableConflictError,
  DurableEdgeType,
  DurableRecallInput,
  DurableRememberInput,
  deleteDurableMemory,
  executeDurableEdgeHandler,
  explainDurableMemory,
  getDurableMemory,
  listDurableMemories,
  moveDurableMemoryTier,
  recallDurableMemories,
  reinforceDurableMemory,
  rememberDurableMemory,
  promoteExtractionCandidate,
  queryDurableTemporalGraph,
  rejectExtractionCandidate,
  resolveDurableContradiction,
  runDurableDecayJob,
  updateDurableMemory,
} from "../../durable/repository";
import { buildExtractionCandidateInput } from "../../durable/ingestion";
import { verifyDurableSourceSignature } from "../../durable/sourceAuth";
import { embed } from "../../embeddings/embed";
import {
  OptionalExtractorUnavailable,
  extractDocumentContent,
  extractUrlContent,
  extractionToCandidateInput,
} from "../../ingestion/extract";
import {
  SourceConfigError,
  ingestSourceConnector,
} from "../../sources/framework";
import { getSourceConnector } from "../../sources/registry";
import { createVectorStore, VectorStore } from "../../vectorStores";

type RecallMode = "strict" | "historical" | "associative";
const RECALL_MODES = ["strict", "historical", "associative"] as const;

type RememberRequest = {
  content?: string;
  source?: {
    kind?: string;
    uri?: string;
    id?: string;
  };
  metadata?: Record<string, unknown>;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  entities?: DurableRememberInput["entities"];
  edges?: DurableRememberInput["edges"];
  tags?: string[];
  user_id?: string;
  project_id?: string;
  actor_id?: string;
};

type RecallRequest = {
  query?: string;
  mode?: RecallMode;
  at_time?: string | number;
  limit?: number;
  user_id?: string;
  project_id?: string;
  source?: {
    kind?: string;
    uri?: string;
    id?: string;
  };
};

type UpdateRequest = {
  content?: string;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  user_id?: string;
  expected_version?: number;
};

type ReinforceRequest = {
  boost?: number;
  user_id?: string;
};

type DeleteRequest = {
  user_id?: string;
  actor_id?: string;
  reason?: string;
};

type ResolveContradictionRequest = {
  resolution?: string;
  actor_id?: string;
  reason?: string;
  user_id?: string;
};

type CreateContradictionRequest = {
  user_id?: string;
  project_id?: string;
  memory_id?: string;
  contradicts_memory_id?: string;
  conflict_group_id?: string;
  resolution_policy?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

type ConsolidationRequest = {
  user_id?: string;
  project_id?: string;
  idempotency_key?: string;
  scope?: Record<string, unknown>;
  source_memory_ids?: string[];
  metadata?: Record<string, unknown>;
};

type ConsolidationClaimRequest = {
  worker_id?: string;
  user_id?: string;
  project_id?: string;
};

type ConsolidationCompleteRequest = {
  result_memory_id?: string;
  source_memory_ids?: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
};

type TierRequest = {
  tier?: "active" | "warm" | "cold" | "archived";
  user_id?: string;
  project_id?: string;
  reason?: string;
};

type EdgeExecuteRequest = {
  edge_id?: string;
  edge_type?: DurableEdgeType;
  source_memory_id?: string;
  target_memory_id?: string;
  user_id?: string;
  project_id?: string;
  metadata?: Record<string, unknown>;
};

type TemporalGraphQueryRequest = {
  user_id?: string;
  project_id?: string;
  memory_id?: string;
  edge_type?: DurableEdgeType;
  at_time?: string;
  from?: string;
  to?: string;
  limit?: number;
};

type DecayRunRequest = {
  user_id?: string;
  project_id?: string;
  actor_id?: string;
  limit?: number;
  dry_run?: boolean;
};

const parseTime = (value: string | number | undefined) => {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

type IngestRequest = {
  user_id?: string;
  project_id?: string;
  source?: {
    kind?: string;
    uri?: string;
    id?: string;
    content_type?: string;
  };
  content?: string;
  metadata?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  observed_at?: string;
};

type DocumentIngestRequest = {
  user_id?: string;
  project_id?: string;
  source?: {
    kind?: string;
    uri?: string;
    id?: string;
    content_type?: string;
  };
  content_type?: string;
  data?: string;
  url?: string;
  encoding?: "text" | "base64";
  metadata?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  observed_at?: string;
};

type SourceIngestRequest = {
  user_id?: string;
  project_id?: string;
  config?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
};

type CandidateAcceptRequest = {
  source?: {
    kind?: string;
    uri?: string;
    id?: string;
    observed_at?: string;
  };
};

type CandidateRejectRequest = {
  reason?: string;
  user_id?: string;
};

const invalidRequest = (res: any, field: string, msg: string) =>
  res.status(400).json({ err: "invalid_request", field, msg });

const serverError = (res: any, err: string, e: unknown) =>
  res.status(500).json({
    err,
    msg: e instanceof Error ? e.message : String(e),
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isPositiveInteger = (value: unknown) =>
  Number.isInteger(value) && Number(value) > 0;

const parsePositiveInteger = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const hasUpdateFields = (body: UpdateRequest | undefined) =>
  body !== undefined &&
  (body.content !== undefined ||
    body.facets !== undefined ||
    body.contracts !== undefined ||
    body.metadata !== undefined ||
    body.tags !== undefined);

const memoryRef = (memory: Record<string, any>) => ({
  id: memory.id,
  memory_id: memory.memory_id || memory.id,
  status: memory.status,
  version: memory.version,
  salience: memory.salience,
});

export const makeDurableExecutor = (
  run: (sql: string, params?: any[]) => Promise<void>,
  all: (sql: string, params?: any[]) => Promise<any[]>,
  tx = transaction,
) => ({
  query: async (sql: string, params: unknown[] = []) => {
    const command = sql.trim().toUpperCase();
    if (command === "BEGIN") {
      await tx.begin();
      return { rows: [] };
    }
    if (command === "COMMIT") {
      await tx.commit();
      return { rows: [] };
    }
    if (command === "ROLLBACK") {
      await tx.rollback();
      return { rows: [] };
    }
    if (/^\s*select\b/i.test(sql)) {
      return { rows: await all(sql, params as any[]) };
    }

    await run(sql, params as any[]);
    return { rows: [] };
  },
});

export const toDurableRememberInput = (
  body: RememberRequest,
  embedding?: number[],
): DurableRememberInput => ({
  content: body.content || "",
  user_id: body.user_id,
  project_id: body.project_id,
  actor_id: body.actor_id,
  facets: body.facets,
  contracts: body.contracts,
  metadata: body.metadata,
  entities: body.entities,
  edges: body.edges,
  source: body.source,
  embedding,
});

export const toDurableRecallInput = async (
  body: RecallRequest,
  mode: RecallMode,
  atTime: number | undefined,
  embedder: (text: string) => Promise<number[]> = embed,
): Promise<DurableRecallInput> => {
  const embedding = await embedder(body.query || "");
  return {
    query: body.query || "",
    mode,
    at_time: atTime === undefined ? undefined : new Date(atTime),
    limit: body.limit,
    user_id: body.user_id,
    project_id: body.project_id,
    source: body.source,
    embedding: embedding.length > 0 ? embedding : undefined,
  };
};

export async function getExternalVectorCandidateIds(
  vectorStore: Pick<VectorStore, "query"> | null,
  input: {
    embedding?: number[];
    limit?: number;
    user_id?: string;
    project_id?: string;
  },
): Promise<string[]> {
  if (!vectorStore || !input.embedding?.length) return [];
  const results = await vectorStore.query({
    embedding: input.embedding,
    limit: Math.max(1, Math.min(input.limit || 10, 100)),
    user_id: input.user_id,
    project_id: input.project_id,
  });
  return results.map((result) => result.id).filter(Boolean);
}

export function v1(app: any) {
  const durableDb = makeDurableExecutor(run_async, all_async);
  const vectorStore = createVectorStore();

  app.post("/v1/memories", async (req: any, res: any) => {
    const body = req.body as RememberRequest;
    if (typeof body?.content !== "string" || body.content.trim().length === 0) {
      return invalidRequest(
        res,
        "content",
        "content must be a non-empty string",
      );
    }
    if (body.metadata !== undefined && !isRecord(body.metadata)) {
      return invalidRequest(res, "metadata", "metadata must be an object");
    }
    if (body.facets !== undefined && !isRecord(body.facets)) {
      return invalidRequest(res, "facets", "facets must be an object");
    }
    if (body.contracts !== undefined && !isRecord(body.contracts)) {
      return invalidRequest(res, "contracts", "contracts must be an object");
    }

    try {
      const embedding = await embed(body.content);
      const memory = await rememberDurableMemory(
        durableDb,
        toDurableRememberInput(body, embedding),
      );
      if (vectorStore) {
        await vectorStore.upsert({
          id: memory.id,
          embedding,
          content: body.content,
          user_id: body.user_id || "anonymous",
          project_id: body.project_id || null,
          metadata: body.metadata,
        });
      }

      return res.json({
        id: memory.id,
        memory_id: memory.id,
        status: memory.status,
        adapter: "durable-postgres",
        memory: memoryRef(memory),
      });
    } catch (e: unknown) {
      serverError(res, "remember_failed", e);
    }
  });

  app.post("/v1/recall", async (req: any, res: any) => {
    const body = req.body as RecallRequest;
    if (typeof body?.query !== "string" || body.query.trim().length === 0) {
      return invalidRequest(res, "query", "query must be a non-empty string");
    }

    const mode = body.mode || "associative";
    if (!RECALL_MODES.includes(mode as RecallMode)) {
      return invalidRequest(
        res,
        "mode",
        "mode must be strict, historical, or associative",
      );
    }

    const atTime = parseTime(body.at_time);
    if (body.at_time !== undefined && atTime === undefined) {
      return invalidRequest(
        res,
        "at_time",
        "at_time must be a valid date or timestamp",
      );
    }
    if (body.limit !== undefined && !isPositiveInteger(body.limit)) {
      return invalidRequest(res, "limit", "limit must be a positive integer");
    }
    if (body.source !== undefined && !isRecord(body.source)) {
      return invalidRequest(res, "source", "source must be an object");
    }
    if (
      body.source &&
      ["kind", "uri", "id"].some(
        (key) =>
          body.source?.[key as keyof NonNullable<RecallRequest["source"]>] !==
            undefined &&
          typeof body.source[
            key as keyof NonNullable<RecallRequest["source"]>
          ] !== "string",
      )
    ) {
      return invalidRequest(res, "source", "source fields must be strings");
    }

    try {
      const recallInput = await toDurableRecallInput(body, mode, atTime);
      const candidateIds = await getExternalVectorCandidateIds(
        vectorStore,
        recallInput,
      );
      if (vectorStore && candidateIds.length === 0) {
        return res.json({
          query: recallInput.query,
          mode: recallInput.mode,
          adapter: "durable-postgres",
          vector_store: vectorStore.kind,
          results: [],
        });
      }
      const recalled = await recallDurableMemories(durableDb, {
        ...recallInput,
        candidate_ids: candidateIds.length ? candidateIds : undefined,
      });

      return res.json({
        query: recalled.query,
        mode: recalled.mode,
        adapter: "durable-postgres",
        vector_store: vectorStore?.kind || "postgres",
        results: recalled.results,
      });
    } catch (e: unknown) {
      serverError(res, "recall_failed", e);
    }
  });

  app.get("/v1/memories", async (req: any, res: any) => {
    try {
      const limit = parsePositiveInteger(req.query.limit);
      const offset =
        req.query.offset === undefined || req.query.offset === ""
          ? undefined
          : Number(req.query.offset);
      if (req.query.limit !== undefined && limit === undefined) {
        return invalidRequest(res, "limit", "limit must be a positive integer");
      }
      if (
        req.query.offset !== undefined &&
        (!Number.isInteger(offset) || Number(offset) < 0)
      ) {
        return invalidRequest(
          res,
          "offset",
          "offset must be a non-negative integer",
        );
      }

      const listed = await listDurableMemories(durableDb, {
        user_id: req.query.user_id,
        project_id: req.query.project_id,
        limit,
        offset,
      });
      return res.json({
        adapter: "durable-postgres",
        ...listed,
        page: {
          limit: listed.limit,
          offset: listed.offset,
          count: listed.items.length,
        },
      });
    } catch (e: unknown) {
      serverError(res, "list_failed", e);
    }
  });

  app.get("/v1/memories/:id", async (req: any, res: any) => {
    try {
      const memory = await getDurableMemory(durableDb, {
        id: req.params.id,
        user_id: req.query.user_id,
        project_id: req.query.project_id,
      });
      if (!memory) return res.status(404).json({ err: "not_found" });

      const response = {
        adapter: "durable-postgres",
        ...memory,
      };
      return res.json({ ...response, memory: { ...response } });
    } catch (e: unknown) {
      serverError(res, "get_failed", e);
    }
  });

  app.get("/v1/memories/:id/explain", async (req: any, res: any) => {
    try {
      const recallQuery =
        typeof req.query.recall_query === "string"
          ? req.query.recall_query
          : undefined;
      const recallMode = (req.query.recall_mode || "associative") as RecallMode;
      if (recallQuery && !RECALL_MODES.includes(recallMode)) {
        return invalidRequest(
          res,
          "recall_mode",
          "recall_mode must be strict, historical, or associative",
        );
      }

      const explained = await explainDurableMemory(durableDb, {
        id: req.params.id,
        recall: recallQuery
          ? {
              query: recallQuery,
              mode: recallMode,
            }
          : undefined,
      });
      if (!explained) return res.status(404).json({ err: "not_found" });

      return res.json({
        adapter: "durable-postgres",
        ...explained,
      });
    } catch (e: unknown) {
      serverError(res, "explain_failed", e);
    }
  });

  app.patch("/v1/memories/:id", async (req: any, res: any) => {
    const body = req.body as UpdateRequest;
    if (!hasUpdateFields(body)) {
      return invalidRequest(
        res,
        "body",
        "body must include content, facets, contracts, metadata, or tags",
      );
    }
    if (body.content !== undefined && typeof body.content !== "string") {
      return invalidRequest(res, "content", "content must be a string");
    }
    if (body.facets !== undefined && !isRecord(body.facets)) {
      return invalidRequest(res, "facets", "facets must be an object");
    }
    if (body.contracts !== undefined && !isRecord(body.contracts)) {
      return invalidRequest(res, "contracts", "contracts must be an object");
    }
    if (body.metadata !== undefined && !isRecord(body.metadata)) {
      return invalidRequest(res, "metadata", "metadata must be an object");
    }
    if (
      body.expected_version !== undefined &&
      (!Number.isInteger(body.expected_version) || body.expected_version < 1)
    ) {
      return invalidRequest(
        res,
        "expected_version",
        "expected_version must be a positive integer",
      );
    }

    try {
      const updated = await updateDurableMemory(durableDb, {
        id: req.params.id,
        user_id: body?.user_id,
        content: body?.content,
        facets: body?.facets,
        contracts: body?.contracts,
        metadata: body?.metadata,
        expected_version: body?.expected_version,
      });
      if (!updated) return res.status(404).json({ err: "not_found" });
      if (vectorStore && body.content) {
        await vectorStore.upsert({
          id: req.params.id,
          embedding: await embed(body.content),
          content: body.content,
          user_id: body.user_id,
          project_id: undefined,
          metadata: body.metadata,
        });
      }

      const response = {
        adapter: "durable-postgres",
        ...updated,
      };
      return res.json({ ...response, memory: memoryRef(response) });
    } catch (e: unknown) {
      if (e instanceof DurableConflictError) {
        return res.status(409).json({
          err: "conflict",
          msg: e.message,
          expected_version: e.expected_version,
          current_version: e.current_version,
        });
      }
      serverError(res, "update_failed", e);
    }
  });

  app.post("/v1/memories/:id/reinforce", async (req: any, res: any) => {
    const body = req.body as ReinforceRequest;
    if (
      body?.boost !== undefined &&
      (typeof body.boost !== "number" ||
        !Number.isFinite(body.boost) ||
        body.boost < 0 ||
        body.boost > 1)
    ) {
      return invalidRequest(
        res,
        "boost",
        "boost must be a number between 0 and 1",
      );
    }

    try {
      const reinforced = await reinforceDurableMemory(durableDb, {
        id: req.params.id,
        user_id: body?.user_id,
        boost: body?.boost,
      });
      if (!reinforced) return res.status(404).json({ err: "not_found" });

      const response = {
        adapter: "durable-postgres",
        ...reinforced,
      };
      return res.json({ ...response, memory: memoryRef(response) });
    } catch (e: unknown) {
      serverError(res, "reinforce_failed", e);
    }
  });

  app.post("/v1/memories/:id/tier", async (req: any, res: any) => {
    const body = (req.body || {}) as TierRequest;
    if (
      typeof body.tier !== "string" ||
      !["active", "warm", "cold", "archived"].includes(body.tier)
    ) {
      return invalidRequest(
        res,
        "tier",
        "tier must be active, warm, cold, or archived",
      );
    }
    if (body.reason !== undefined && typeof body.reason !== "string") {
      return invalidRequest(res, "reason", "reason must be a string");
    }

    try {
      const moved = await moveDurableMemoryTier(durableDb, {
        id: req.params.id,
        tier: body.tier,
        user_id: body.user_id,
        project_id: body.project_id,
        reason: body.reason,
      });
      if (!moved) return res.status(404).json({ err: "not_found" });

      return res.json({
        adapter: "durable-postgres",
        memory: moved,
      });
    } catch (e: unknown) {
      serverError(res, "tier_failed", e);
    }
  });

  app.delete("/v1/memories/:id", async (req: any, res: any) => {
    const body = (req.body || {}) as DeleteRequest;
    if (body.actor_id !== undefined && typeof body.actor_id !== "string") {
      return invalidRequest(res, "actor_id", "actor_id must be a string");
    }
    if (body.reason !== undefined && typeof body.reason !== "string") {
      return invalidRequest(res, "reason", "reason must be a string");
    }

    try {
      const deleted = await deleteDurableMemory(durableDb, {
        id: req.params.id,
        user_id: req.query.user_id || body.user_id,
        actor_id: body.actor_id,
        reason: body.reason,
      });
      if (!deleted) return res.status(404).json({ err: "not_found" });
      if (vectorStore) await vectorStore.delete(req.params.id);

      return res.json({
        ok: true,
        adapter: "durable-postgres",
        deleted: { id: req.params.id },
      });
    } catch (e: unknown) {
      serverError(res, "delete_failed", e);
    }
  });

  app.post("/v1/contradictions", async (req: any, res: any) => {
    const body = (req.body || {}) as CreateContradictionRequest;
    if (
      typeof body.memory_id !== "string" ||
      body.memory_id.trim().length === 0
    ) {
      return invalidRequest(
        res,
        "memory_id",
        "memory_id must be a non-empty string",
      );
    }
    if (
      typeof body.contradicts_memory_id !== "string" ||
      body.contradicts_memory_id.trim().length === 0
    ) {
      return invalidRequest(
        res,
        "contradicts_memory_id",
        "contradicts_memory_id must be a non-empty string",
      );
    }
    if (
      body.confidence !== undefined &&
      (typeof body.confidence !== "number" ||
        body.confidence < 0 ||
        body.confidence > 1)
    ) {
      return invalidRequest(
        res,
        "confidence",
        "confidence must be between 0 and 1",
      );
    }
    if (body.metadata !== undefined && !isRecord(body.metadata)) {
      return invalidRequest(res, "metadata", "metadata must be an object");
    }

    try {
      const created = await createDurableContradiction(durableDb, {
        user_id: body.user_id,
        project_id: body.project_id,
        memory_id: body.memory_id,
        contradicts_memory_id: body.contradicts_memory_id,
        conflict_group_id: body.conflict_group_id,
        resolution_policy: body.resolution_policy,
        confidence: body.confidence,
        metadata: body.metadata,
      });

      return res.json({
        adapter: "durable-postgres",
        ...created,
        contradiction: { ...created },
      });
    } catch (e: unknown) {
      serverError(res, "contradiction_create_failed", e);
    }
  });

  app.post("/v1/contradictions/:id/resolve", async (req: any, res: any) => {
    const body = req.body as ResolveContradictionRequest;
    if (
      typeof body?.resolution !== "string" ||
      body.resolution.trim().length === 0
    ) {
      return invalidRequest(
        res,
        "resolution",
        "resolution must be a non-empty string",
      );
    }
    if (body.actor_id !== undefined && typeof body.actor_id !== "string") {
      return invalidRequest(res, "actor_id", "actor_id must be a string");
    }
    if (body.reason !== undefined && typeof body.reason !== "string") {
      return invalidRequest(res, "reason", "reason must be a string");
    }

    try {
      const resolved = await resolveDurableContradiction(durableDb, {
        id: req.params.id,
        resolution: body.resolution,
        actor_id: body.actor_id,
        reason: body.reason,
        user_id: body.user_id,
      });
      if (!resolved) return res.status(404).json({ err: "not_found" });

      return res.json({
        adapter: "durable-postgres",
        ...resolved,
      });
    } catch (e: unknown) {
      serverError(res, "resolve_failed", e);
    }
  });

  app.post("/v1/consolidations", async (req: any, res: any) => {
    const body = (req.body || {}) as ConsolidationRequest;
    if (
      body.source_memory_ids !== undefined &&
      (!Array.isArray(body.source_memory_ids) ||
        body.source_memory_ids.some(
          (id) => typeof id !== "string" || id.length === 0,
        ))
    ) {
      return invalidRequest(
        res,
        "source_memory_ids",
        "source_memory_ids must be an array of non-empty strings",
      );
    }
    if (body.scope !== undefined && !isRecord(body.scope)) {
      return invalidRequest(res, "scope", "scope must be an object");
    }
    if (body.metadata !== undefined && !isRecord(body.metadata)) {
      return invalidRequest(res, "metadata", "metadata must be an object");
    }

    try {
      const consolidation = await createDurableConsolidation(durableDb, {
        user_id: body.user_id,
        project_id: body.project_id,
        idempotency_key: body.idempotency_key,
        scope: body.scope,
        source_memory_ids: body.source_memory_ids,
        metadata: body.metadata,
      });

      return res.json({
        adapter: "durable-postgres",
        ...consolidation,
      });
    } catch (e: unknown) {
      serverError(res, "consolidation_failed", e);
    }
  });

  app.post("/v1/consolidations/claim", async (req: any, res: any) => {
    const body = (req.body || {}) as ConsolidationClaimRequest;
    if (
      typeof body.worker_id !== "string" ||
      body.worker_id.trim().length === 0
    ) {
      return invalidRequest(
        res,
        "worker_id",
        "worker_id must be a non-empty string",
      );
    }

    try {
      const job = await claimDurableConsolidation(durableDb, {
        worker_id: body.worker_id,
        user_id: body.user_id,
        project_id: body.project_id,
      });

      return res.json({
        adapter: "durable-postgres",
        job,
      });
    } catch (e: unknown) {
      serverError(res, "consolidation_claim_failed", e);
    }
  });

  app.post("/v1/consolidations/:id/complete", async (req: any, res: any) => {
    const body = (req.body || {}) as ConsolidationCompleteRequest;
    if (
      typeof body.result_memory_id !== "string" ||
      body.result_memory_id.trim().length === 0
    ) {
      return invalidRequest(
        res,
        "result_memory_id",
        "result_memory_id must be a non-empty string",
      );
    }
    if (
      body.source_memory_ids !== undefined &&
      (!Array.isArray(body.source_memory_ids) ||
        body.source_memory_ids.some(
          (id) => typeof id !== "string" || id.trim().length === 0,
        ))
    ) {
      return invalidRequest(
        res,
        "source_memory_ids",
        "source_memory_ids must be an array of non-empty strings",
      );
    }
    if (body.metadata !== undefined && !isRecord(body.metadata)) {
      return invalidRequest(res, "metadata", "metadata must be an object");
    }

    try {
      const completed = await completeDurableConsolidation(durableDb, {
        id: req.params.id,
        result_memory_id: body.result_memory_id,
        source_memory_ids: body.source_memory_ids,
        summary: body.summary,
        metadata: body.metadata,
      });
      if (!completed) return res.status(404).json({ err: "not_found" });

      return res.json({
        adapter: "durable-postgres",
        consolidation: completed,
      });
    } catch (e: unknown) {
      serverError(res, "consolidation_complete_failed", e);
    }
  });

  app.post("/v1/edges/execute", async (req: any, res: any) => {
    const body = (req.body || {}) as EdgeExecuteRequest;
    if (typeof body.edge_id !== "string" || body.edge_id.trim().length === 0) {
      return invalidRequest(
        res,
        "edge_id",
        "edge_id must be a non-empty string",
      );
    }
    if (
      typeof body.edge_type !== "string" ||
      !["supersedes", "contradicts", "derives_from", "same_as"].includes(
        body.edge_type,
      )
    ) {
      return invalidRequest(
        res,
        "edge_type",
        "edge_type must be supersedes, contradicts, derives_from, or same_as",
      );
    }
    if (
      typeof body.source_memory_id !== "string" ||
      body.source_memory_id.trim().length === 0
    ) {
      return invalidRequest(
        res,
        "source_memory_id",
        "source_memory_id must be a non-empty string",
      );
    }
    if (
      typeof body.target_memory_id !== "string" ||
      body.target_memory_id.trim().length === 0
    ) {
      return invalidRequest(
        res,
        "target_memory_id",
        "target_memory_id must be a non-empty string",
      );
    }
    if (body.metadata !== undefined && !isRecord(body.metadata)) {
      return invalidRequest(res, "metadata", "metadata must be an object");
    }

    try {
      const edge = await executeDurableEdgeHandler(durableDb, {
        edge_id: body.edge_id,
        edge_type: body.edge_type,
        source_memory_id: body.source_memory_id,
        target_memory_id: body.target_memory_id,
        user_id: body.user_id,
        project_id: body.project_id,
        metadata: body.metadata,
      });

      return res.json({
        adapter: "durable-postgres",
        edge,
      });
    } catch (e: unknown) {
      serverError(res, "edge_execute_failed", e);
    }
  });

  app.post("/v1/graph/temporal/query", async (req: any, res: any) => {
    const body = (req.body || {}) as TemporalGraphQueryRequest;
    if (
      body.edge_type !== undefined &&
      ![
        "mentions",
        "supports",
        "contradicts",
        "derives_from",
        "supersedes",
        "same_as",
        "causes",
        "depends_on",
        "part_of",
        "related_to",
      ].includes(body.edge_type)
    ) {
      return invalidRequest(res, "edge_type", "edge_type is not supported");
    }
    if (body.limit !== undefined && !isPositiveInteger(body.limit)) {
      return invalidRequest(res, "limit", "limit must be a positive integer");
    }
    for (const field of ["at_time", "from", "to"] as const) {
      if (body[field] !== undefined && parseTime(body[field]) === undefined) {
        return invalidRequest(res, field, `${field} must be a valid date`);
      }
    }

    try {
      const graph = await queryDurableTemporalGraph(durableDb, body);
      return res.json({
        adapter: "durable-postgres",
        graph,
      });
    } catch (e: unknown) {
      serverError(res, "temporal_graph_failed", e);
    }
  });

  app.post("/v1/admin/decay/run", async (req: any, res: any) => {
    const body = (req.body || {}) as DecayRunRequest;
    if (body.limit !== undefined && !isPositiveInteger(body.limit)) {
      return invalidRequest(res, "limit", "limit must be a positive integer");
    }
    if (body.dry_run !== undefined && typeof body.dry_run !== "boolean") {
      return invalidRequest(res, "dry_run", "dry_run must be a boolean");
    }
    if (body.actor_id !== undefined && typeof body.actor_id !== "string") {
      return invalidRequest(res, "actor_id", "actor_id must be a string");
    }

    try {
      const decay = await runDurableDecayJob(durableDb, {
        user_id: body.user_id,
        project_id: body.project_id,
        actor_id: body.actor_id,
        limit: body.limit,
        dry_run: body.dry_run,
      });

      return res.json({
        adapter: "durable-postgres",
        decay,
      });
    } catch (e: unknown) {
      serverError(res, "decay_failed", e);
    }
  });

  app.post("/v1/ingest", async (req: any, res: any) => {
    const body = (req.body || {}) as IngestRequest;
    if (
      typeof body.source?.kind !== "string" ||
      body.source.kind.trim().length === 0
    ) {
      return invalidRequest(
        res,
        "source.kind",
        "source.kind must be a non-empty string",
      );
    }
    if (typeof body.content !== "string" || body.content.trim().length === 0) {
      return invalidRequest(
        res,
        "content",
        "content must be a non-empty string",
      );
    }
    if (body.metadata !== undefined && !isRecord(body.metadata)) {
      return invalidRequest(res, "metadata", "metadata must be an object");
    }
    if (body.contracts !== undefined && !isRecord(body.contracts)) {
      return invalidRequest(res, "contracts", "contracts must be an object");
    }

    try {
      const signature = verifyDurableSourceSignature({
        source_kind: body.source.kind,
        raw_body: req.rawBody,
        headers: req.headers,
      });
      if (!signature.ok) {
        const status = signature.reason === "secret_missing" ? 503 : 401;
        return res.status(status).json({
          err:
            signature.reason === "secret_missing"
              ? "webhook_not_configured"
              : "invalid_signature",
          reason: signature.reason,
        });
      }

      const event = await createWorkingMemoryEvent(durableDb, {
        user_id: body.user_id,
        project_id: body.project_id,
        source: {
          kind: body.source.kind,
          uri: body.source.uri,
          id: body.source.id,
          content_type: body.source.content_type,
        },
        content: body.content,
        metadata: body.metadata,
        contracts: body.contracts,
        observed_at: body.observed_at,
      });
      const candidate = await createExtractionCandidate(
        durableDb,
        buildExtractionCandidateInput({
          event_id: event.id,
          user_id: body.user_id,
          project_id: body.project_id,
          source: {
            kind: body.source.kind,
            uri: body.source.uri,
            id: body.source.id,
            observed_at: body.observed_at,
          },
          content: body.content,
          metadata: body.metadata,
          contracts: body.contracts,
        }),
      );

      return res.json({
        adapter: "durable-postgres",
        event: {
          ...event,
          extraction: {
            automatic: true,
            status: "candidate_created",
            candidate_id: candidate.id,
          },
        },
        candidate,
      });
    } catch (e: unknown) {
      serverError(res, "ingest_failed", e);
    }
  });

  app.post("/v1/ingest/document", async (req: any, res: any) => {
    const body = (req.body || {}) as DocumentIngestRequest;
    if (body.url !== undefined && typeof body.url !== "string") {
      return invalidRequest(res, "url", "url must be a string");
    }
    if (body.data !== undefined && typeof body.data !== "string") {
      return invalidRequest(res, "data", "data must be a string");
    }
    if (!body.url && !body.data) {
      return invalidRequest(res, "data", "data or url is required");
    }
    if (
      !body.url &&
      (typeof body.content_type !== "string" ||
        body.content_type.trim().length === 0)
    ) {
      return invalidRequest(
        res,
        "content_type",
        "content_type is required when data is provided",
      );
    }
    if (
      body.encoding !== undefined &&
      !["text", "base64"].includes(body.encoding)
    ) {
      return invalidRequest(res, "encoding", "encoding must be text or base64");
    }
    if (body.metadata !== undefined && !isRecord(body.metadata)) {
      return invalidRequest(res, "metadata", "metadata must be an object");
    }
    if (body.contracts !== undefined && !isRecord(body.contracts)) {
      return invalidRequest(res, "contracts", "contracts must be an object");
    }

    try {
      const content = body.url
        ? await extractUrlContent(body.url)
        : await extractDocumentContent(
            body.content_type || "text/plain",
            body.encoding === "base64"
              ? Buffer.from(body.data || "", "base64")
              : body.data || "",
          );
      const source = {
        kind: body.source?.kind || (body.url ? "url" : "document"),
        uri: body.source?.uri || body.url,
        id: body.source?.id,
        content_type:
          body.source?.content_type || content.metadata.content_type,
      };
      const event = await createWorkingMemoryEvent(durableDb, {
        user_id: body.user_id,
        project_id: body.project_id,
        source,
        content: content.text,
        metadata: {
          ...body.metadata,
          ...content.metadata,
        },
        contracts: body.contracts,
        observed_at: body.observed_at,
      });
      const candidate = await createExtractionCandidate(
        durableDb,
        extractionToCandidateInput({
          event_id: event.id,
          user_id: body.user_id,
          project_id: body.project_id,
          source: {
            kind: source.kind,
            uri: source.uri,
            id: source.id,
            observed_at: body.observed_at,
          },
          content,
          metadata: body.metadata,
          contracts: body.contracts,
        }),
      );

      return res.json({
        adapter: "durable-postgres",
        event,
        candidate,
      });
    } catch (e: unknown) {
      if (e instanceof OptionalExtractorUnavailable) {
        return res.status(422).json({
          err: "extractor_unavailable",
          content_type: e.content_type,
          install_hint: e.install_hint,
        });
      }
      serverError(res, "document_ingest_failed", e);
    }
  });

  app.post("/v1/sources/:source/ingest", async (req: any, res: any) => {
    const body = (req.body || {}) as SourceIngestRequest;
    if (body.config !== undefined && !isRecord(body.config)) {
      return invalidRequest(res, "config", "config must be an object");
    }
    if (body.filters !== undefined && !isRecord(body.filters)) {
      return invalidRequest(res, "filters", "filters must be an object");
    }
    if (body.contracts !== undefined && !isRecord(body.contracts)) {
      return invalidRequest(res, "contracts", "contracts must be an object");
    }

    try {
      const connector = getSourceConnector(
        req.params.source,
        body.config || {},
      );
      const result = await ingestSourceConnector(durableDb, connector, {
        user_id: body.user_id,
        project_id: body.project_id,
        filters: body.filters,
        contracts: body.contracts,
      });
      return res.json({
        adapter: "durable-postgres",
        source: req.params.source,
        ...result,
      });
    } catch (e: unknown) {
      if (e instanceof SourceConfigError) {
        return res.status(400).json({
          err: "source_config",
          msg: e.message,
        });
      }
      if (e instanceof OptionalExtractorUnavailable) {
        return res.status(422).json({
          err: "extractor_unavailable",
          content_type: e.content_type,
          install_hint: e.install_hint,
        });
      }
      serverError(res, "source_ingest_failed", e);
    }
  });

  app.post("/v1/ingest/candidates/:id/accept", async (req: any, res: any) => {
    const body = (req.body || {}) as CandidateAcceptRequest;
    if (
      typeof req.params?.id !== "string" ||
      req.params.id.trim().length === 0
    ) {
      return invalidRequest(res, "id", "id must be a non-empty string");
    }
    if (body.source !== undefined && !isRecord(body.source)) {
      return invalidRequest(res, "source", "source must be an object");
    }

    try {
      const memory = await promoteExtractionCandidate(durableDb, {
        candidate_id: req.params.id,
        source: body.source,
      });
      if (!memory) return res.status(404).json({ err: "not_found" });

      return res.json({
        adapter: "durable-postgres",
        memory,
      });
    } catch (e: unknown) {
      serverError(res, "candidate_accept_failed", e);
    }
  });

  app.post("/v1/ingest/candidates/:id/reject", async (req: any, res: any) => {
    const body = (req.body || {}) as CandidateRejectRequest;
    if (
      typeof req.params?.id !== "string" ||
      req.params.id.trim().length === 0
    ) {
      return invalidRequest(res, "id", "id must be a non-empty string");
    }
    if (typeof body.reason !== "string" || body.reason.trim().length === 0) {
      return invalidRequest(res, "reason", "reason must be a non-empty string");
    }

    try {
      const rejected = await rejectExtractionCandidate(durableDb, {
        candidate_id: req.params.id,
        reason: body.reason,
        user_id: body.user_id,
      });
      if (!rejected) return res.status(404).json({ err: "not_found" });

      return res.json({
        adapter: "durable-postgres",
        candidate: rejected,
      });
    } catch (e: unknown) {
      serverError(res, "candidate_reject_failed", e);
    }
  });
}
