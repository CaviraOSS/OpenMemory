import {
  all_async,
  q,
  run_async,
  transaction,
} from "../../database/connection";
import { env } from "../../configuration";
import {
  claimDurableConsolidation,
  createDurableContradiction,
  createDurableConsolidation,
  createWorkingMemoryEvent,
  DurableConflictError,
  DurableRecallInput,
  DurableRememberInput,
  deleteDurableMemory,
  explainDurableMemory,
  getDurableMemory,
  listDurableMemories,
  recallDurableMemories,
  reinforceDurableMemory,
  rememberDurableMemory,
  promoteExtractionCandidate,
  rejectExtractionCandidate,
  resolveDurableContradiction,
  updateDurableMemory,
} from "../../durable/repository";
import {
  add_hsg_memory,
  delete_memory,
  hsg_query,
  reinforce_memory,
  update_memory,
} from "../../retention/hsg";
import { embed } from "../../retention/embed";
import { j, p } from "../../utilities";

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

export function v1(app: any) {
  const durableDb = makeDurableExecutor(run_async, all_async);

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

    const metadata = {
      ...(body.metadata || {}),
      ...(body.source ? { source: body.source } : {}),
      ...(body.facets ? { facets: body.facets } : {}),
      ...(body.contracts ? { contracts: body.contracts } : {}),
    };

    try {
      if (env.metadata_backend === "postgres") {
        const embedding = await embed(body.content);
        const memory = await rememberDurableMemory(
          durableDb,
          toDurableRememberInput(body, embedding),
        );

        return res.json({
          id: memory.id,
          memory_id: memory.id,
          status: memory.status,
          adapter: "durable-postgres",
          memory: memoryRef(memory),
        });
      }

      const memory = await add_hsg_memory(
        body.content,
        j(body.tags || []),
        metadata,
        body.user_id,
        body.project_id,
      );

      res.json({
        id: memory.id,
        memory_id: memory.id,
        status: memory.deduplicated ? "deduplicated" : "stored",
        adapter: "legacy-hsg",
        primary_facet: memory.primary_sector,
        facets: memory.sectors,
        memory: memoryRef({
          id: memory.id,
          status: memory.deduplicated ? "deduplicated" : "stored",
        }),
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
      if (env.metadata_backend === "postgres") {
        const recalled = await recallDurableMemories(
          durableDb,
          await toDurableRecallInput(body, mode, atTime),
        );

        return res.json({
          query: recalled.query,
          mode: recalled.mode,
          adapter: "durable-postgres",
          results: recalled.results,
        });
      }

      const matches = await hsg_query(body.query, body.limit || 10, {
        user_id: body.user_id,
        project_id: body.project_id,
        endTime: atTime,
      });

      res.json({
        query: body.query,
        mode,
        adapter: "legacy-hsg",
        results: matches.map((memory) => ({
          id: memory.id,
          content: memory.content,
          score: memory.score,
          facets: memory.sectors,
          primary_facet: memory.primary_sector,
          salience: memory.salience,
          last_seen_at: memory.last_seen_at,
        })),
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

      if (env.metadata_backend === "postgres") {
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
      }

      const rows = req.query.user_id
        ? await q.all_mem_by_user.all(
            req.query.user_id,
            limit || 100,
            offset || 0,
          )
        : await q.all_mem.all(limit || 100, offset || 0);

      return res.json({
        adapter: "legacy-hsg",
        items: rows.map((memory: any) => ({
          id: memory.id,
          content: memory.content,
          facets: p(memory.tags),
          metadata: p(memory.meta),
          user_id: memory.user_id,
          project_id: memory.project_id,
          salience: memory.salience,
          confidence: memory.feedback_score || 0,
          recorded_at: memory.created_at,
        })),
        limit: limit || 100,
        offset: offset || 0,
        page: {
          limit: limit || 100,
          offset: offset || 0,
          count: rows.length,
        },
      });
    } catch (e: unknown) {
      serverError(res, "list_failed", e);
    }
  });

  app.get("/v1/memories/:id", async (req: any, res: any) => {
    try {
      if (env.metadata_backend === "postgres") {
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
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });
      if (req.query.user_id && memory.user_id !== req.query.user_id) {
        return res.status(404).json({ err: "not_found" });
      }

      const response = {
        id: memory.id,
        adapter: "legacy-hsg",
        content: memory.content,
        facets: p(memory.tags),
        metadata: p(memory.meta),
        user_id: memory.user_id,
        project_id: memory.project_id,
        bitemporal: {
          valid_from: null,
          valid_to: null,
          observed_at: memory.created_at,
          recorded_at: memory.created_at,
          superseded_at: null,
        },
        confidence: {
          salience: memory.salience,
          confidence: memory.feedback_score || 0,
        },
        provenance_count: 0,
        version_count: memory.version || 1,
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

      if (env.metadata_backend === "postgres") {
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
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });
      const confidence = Number(memory.feedback_score || 0);
      const salience = Number(memory.salience || 0);
      const recall_score_inputs = recallQuery
        ? {
            query: recallQuery,
            mode: recallMode,
            confidence,
            salience,
            provenance: 0,
            contradiction_penalty: 0,
            contract_penalty: 0,
            score: confidence * 0.6 + salience * 0.4,
          }
        : undefined;

      res.json({
        id: memory.id,
        adapter: "legacy-hsg",
        content: memory.content,
        facets: p(memory.tags),
        contracts: {},
        metadata: p(memory.meta),
        bitemporal: {
          valid_from: null,
          valid_to: null,
          observed_at: memory.created_at,
          recorded_at: memory.created_at,
          superseded_at: null,
        },
        confidence: {
          salience,
          feedback_score: confidence,
        },
        score_components: {
          confidence,
          salience,
          provenance: 0,
          contradiction_penalty: 0,
          contract_penalty: 0,
          contracts: {},
        },
        recall_score_inputs,
        reasons: [
          `confidence ${confidence}`,
          "0 provenance sources",
          "0 open contradictions",
          "recall allowed by contract",
        ],
        provenance: [],
        contradictions: [],
        inference_path: [],
        versions: [],
        audit_events: [],
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
      if (env.metadata_backend === "postgres") {
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

        const response = {
          adapter: "durable-postgres",
          ...updated,
        };
        return res.json({ ...response, memory: memoryRef(response) });
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });
      if (body?.user_id && memory.user_id !== body.user_id) {
        return res.status(404).json({ err: "not_found" });
      }

      const updated = await update_memory(
        req.params.id,
        body?.content,
        body?.tags,
        body?.metadata,
      );
      res.json({
        adapter: "legacy-hsg",
        ...updated,
        memory: memoryRef(updated),
      });
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
      if (env.metadata_backend === "postgres") {
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
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });
      if (body?.user_id && memory.user_id !== body.user_id) {
        return res.status(404).json({ err: "not_found" });
      }

      await reinforce_memory(req.params.id, body?.boost);
      res.json({
        ok: true,
        adapter: "legacy-hsg",
        memory: memoryRef({ id: req.params.id, status: "reinforced" }),
      });
    } catch (e: unknown) {
      serverError(res, "reinforce_failed", e);
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
      if (env.metadata_backend === "postgres") {
        const deleted = await deleteDurableMemory(durableDb, {
          id: req.params.id,
          user_id: req.query.user_id || body.user_id,
          actor_id: body.actor_id,
          reason: body.reason,
        });
        if (!deleted) return res.status(404).json({ err: "not_found" });

        return res.json({
          ok: true,
          adapter: "durable-postgres",
          deleted: { id: req.params.id },
        });
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });

      const userId = req.query.user_id || body.user_id;
      if (userId && memory.user_id !== userId) {
        return res.status(404).json({ err: "not_found" });
      }

      await delete_memory(req.params.id);
      res.json({
        ok: true,
        adapter: "legacy-hsg",
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
      if (env.metadata_backend !== "postgres") {
        return res.status(501).json({
          err: "unsupported",
          msg: "contradiction creation requires durable postgres mode",
        });
      }

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
      if (env.metadata_backend !== "postgres") {
        return res.status(501).json({
          err: "unsupported",
          msg: "contradiction resolution requires durable postgres mode",
        });
      }

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
      if (env.metadata_backend !== "postgres") {
        return res.status(501).json({
          err: "unsupported",
          msg: "consolidations require durable postgres mode",
        });
      }

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
      if (env.metadata_backend !== "postgres") {
        return res.status(501).json({
          err: "unsupported",
          msg: "consolidation claim requires durable postgres mode",
        });
      }

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
      if (env.metadata_backend !== "postgres") {
        return res.status(501).json({
          err: "unsupported",
          msg: "durable ingestion requires durable postgres mode",
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

      return res.json({
        adapter: "durable-postgres",
        event,
      });
    } catch (e: unknown) {
      serverError(res, "ingest_failed", e);
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
      if (env.metadata_backend !== "postgres") {
        return res.status(501).json({
          err: "unsupported",
          msg: "candidate acceptance requires durable postgres mode",
        });
      }

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
      if (env.metadata_backend !== "postgres") {
        return res.status(501).json({
          err: "unsupported",
          msg: "candidate rejection requires durable postgres mode",
        });
      }

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
