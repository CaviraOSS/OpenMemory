import { all_async, q, run_async, transaction } from "../../database/connection";
import { env } from "../../configuration";
import {
  createDurableConsolidation,
  createWorkingMemoryEvent,
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
import { j, p } from "../../utilities";

type RecallMode = "strict" | "historical" | "associative";

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
};

type RecallRequest = {
  query?: string;
  mode?: RecallMode;
  at_time?: string | number;
  limit?: number;
  user_id?: string;
  project_id?: string;
};

type UpdateRequest = {
  content?: string;
  facets?: Record<string, unknown>;
  contracts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  user_id?: string;
};

type ReinforceRequest = {
  boost?: number;
  user_id?: string;
};

type ResolveContradictionRequest = {
  resolution?: string;
  user_id?: string;
};

type ConsolidationRequest = {
  user_id?: string;
  project_id?: string;
  scope?: Record<string, unknown>;
  source_memory_ids?: string[];
  metadata?: Record<string, unknown>;
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
): DurableRememberInput => ({
  content: body.content || "",
  user_id: body.user_id,
  project_id: body.project_id,
  facets: body.facets,
  contracts: body.contracts,
  metadata: body.metadata,
  entities: body.entities,
  edges: body.edges,
  source: body.source,
});

export function v1(app: any) {
  const durableDb = makeDurableExecutor(run_async, all_async);

  app.post("/v1/memories", async (req: any, res: any) => {
    const body = req.body as RememberRequest;
    if (typeof body?.content !== "string" || body.content.trim().length === 0) {
      return invalidRequest(res, "content", "content must be a non-empty string");
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
        const memory = await rememberDurableMemory(
          durableDb,
          toDurableRememberInput(body),
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
    } catch (e: any) {
      res.status(500).json({ err: "remember_failed", msg: e.message });
    }
  });

  app.post("/v1/recall", async (req: any, res: any) => {
    const body = req.body as RecallRequest;
    if (typeof body?.query !== "string" || body.query.trim().length === 0) {
      return invalidRequest(res, "query", "query must be a non-empty string");
    }

    const mode = body.mode || "associative";
    if (!["strict", "historical", "associative"].includes(mode)) {
      return invalidRequest(res, "mode", "mode must be strict, historical, or associative");
    }

    const atTime = parseTime(body.at_time);
    if (body.at_time !== undefined && atTime === undefined) {
      return invalidRequest(res, "at_time", "at_time must be a valid date or timestamp");
    }
    if (body.limit !== undefined && !isPositiveInteger(body.limit)) {
      return invalidRequest(res, "limit", "limit must be a positive integer");
    }

    try {
      if (env.metadata_backend === "postgres") {
        const recalled = await recallDurableMemories(
          durableDb,
          {
            query: body.query,
            mode,
            at_time: atTime === undefined ? undefined : new Date(atTime),
            limit: body.limit,
            user_id: body.user_id,
            project_id: body.project_id,
          },
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
    } catch (e: any) {
      res.status(500).json({ err: "recall_failed", msg: e.message });
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
        return invalidRequest(res, "offset", "offset must be a non-negative integer");
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
        ? await q.all_mem_by_user.all(req.query.user_id, limit || 100, offset || 0)
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
    } catch (e: any) {
      res.status(500).json({ err: "list_failed", msg: e.message });
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
    } catch (e: any) {
      res.status(500).json({ err: "get_failed", msg: e.message });
    }
  });

  app.get("/v1/memories/:id/explain", async (req: any, res: any) => {
    try {
      if (env.metadata_backend === "postgres") {
        const explained = await explainDurableMemory(durableDb, {
          id: req.params.id,
        });
        if (!explained) return res.status(404).json({ err: "not_found" });

        return res.json({
          adapter: "durable-postgres",
          ...explained,
        });
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });

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
          salience: memory.salience,
          feedback_score: memory.feedback_score || 0,
        },
        score_components: {
          confidence: Number(memory.feedback_score || 0),
          salience: Number(memory.salience || 0),
          provenance: 0,
          contradiction_penalty: 0,
          contract_penalty: 0,
          contracts: {},
        },
        reasons: [
          `confidence ${Number(memory.feedback_score || 0)}`,
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
    } catch (e: any) {
      res.status(500).json({ err: "explain_failed", msg: e.message });
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

    try {
      if (env.metadata_backend === "postgres") {
        const updated = await updateDurableMemory(durableDb, {
          id: req.params.id,
          user_id: body?.user_id,
          content: body?.content,
          facets: body?.facets,
          contracts: body?.contracts,
          metadata: body?.metadata,
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
    } catch (e: any) {
      res.status(500).json({ err: "update_failed", msg: e.message });
    }
  });

  app.post("/v1/memories/:id/reinforce", async (req: any, res: any) => {
    const body = req.body as ReinforceRequest;
    if (
      body?.boost !== undefined &&
      (typeof body.boost !== "number" || !Number.isFinite(body.boost) || body.boost < 0 || body.boost > 1)
    ) {
      return invalidRequest(res, "boost", "boost must be a number between 0 and 1");
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
    } catch (e: any) {
      res.status(500).json({ err: "reinforce_failed", msg: e.message });
    }
  });

  app.delete("/v1/memories/:id", async (req: any, res: any) => {
    try {
      if (env.metadata_backend === "postgres") {
        const deleted = await deleteDurableMemory(durableDb, {
          id: req.params.id,
          user_id: req.query.user_id || req.body?.user_id,
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

      const userId = req.query.user_id || req.body?.user_id;
      if (userId && memory.user_id !== userId) {
        return res.status(404).json({ err: "not_found" });
      }

      await delete_memory(req.params.id);
      res.json({
        ok: true,
        adapter: "legacy-hsg",
        deleted: { id: req.params.id },
      });
    } catch (e: any) {
      res.status(500).json({ err: "delete_failed", msg: e.message });
    }
  });

  app.post("/v1/contradictions/:id/resolve", async (req: any, res: any) => {
    const body = req.body as ResolveContradictionRequest;
    if (typeof body?.resolution !== "string" || body.resolution.trim().length === 0) {
      return invalidRequest(res, "resolution", "resolution must be a non-empty string");
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
        user_id: body.user_id,
      });
      if (!resolved) return res.status(404).json({ err: "not_found" });

      return res.json({
        adapter: "durable-postgres",
        ...resolved,
      });
    } catch (e: any) {
      res.status(500).json({ err: "resolve_failed", msg: e.message });
    }
  });

  app.post("/v1/consolidations", async (req: any, res: any) => {
    const body = (req.body || {}) as ConsolidationRequest;
    if (
      body.source_memory_ids !== undefined &&
      (!Array.isArray(body.source_memory_ids) ||
        body.source_memory_ids.some((id) => typeof id !== "string" || id.length === 0))
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
        scope: body.scope,
        source_memory_ids: body.source_memory_ids,
        metadata: body.metadata,
      });

      return res.json({
        adapter: "durable-postgres",
        ...consolidation,
      });
    } catch (e: any) {
      res.status(500).json({ err: "consolidation_failed", msg: e.message });
    }
  });

  app.post("/v1/ingest", async (req: any, res: any) => {
    const body = (req.body || {}) as IngestRequest;
    if (typeof body.source?.kind !== "string" || body.source.kind.trim().length === 0) {
      return invalidRequest(res, "source.kind", "source.kind must be a non-empty string");
    }
    if (typeof body.content !== "string" || body.content.trim().length === 0) {
      return invalidRequest(res, "content", "content must be a non-empty string");
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
    } catch (e: any) {
      res.status(500).json({ err: "ingest_failed", msg: e.message });
    }
  });

  app.post("/v1/ingest/candidates/:id/accept", async (req: any, res: any) => {
    const body = (req.body || {}) as CandidateAcceptRequest;
    if (typeof req.params?.id !== "string" || req.params.id.trim().length === 0) {
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
    } catch (e: any) {
      res.status(500).json({ err: "candidate_accept_failed", msg: e.message });
    }
  });

  app.post("/v1/ingest/candidates/:id/reject", async (req: any, res: any) => {
    const body = (req.body || {}) as CandidateRejectRequest;
    if (typeof req.params?.id !== "string" || req.params.id.trim().length === 0) {
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
    } catch (e: any) {
      res.status(500).json({ err: "candidate_reject_failed", msg: e.message });
    }
  });
}
