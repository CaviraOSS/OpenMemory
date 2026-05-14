import { all_async, q, run_async, transaction } from "../../database/connection";
import { env } from "../../configuration";
import {
  createDurableConsolidation,
  DurableRememberInput,
  deleteDurableMemory,
  explainDurableMemory,
  getDurableMemory,
  listDurableMemories,
  recallDurableMemories,
  reinforceDurableMemory,
  rememberDurableMemory,
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
    if (!body?.content) {
      return res.status(400).json({ err: "content_required" });
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
      });
    } catch (e: any) {
      res.status(500).json({ err: "remember_failed", msg: e.message });
    }
  });

  app.post("/v1/recall", async (req: any, res: any) => {
    const body = req.body as RecallRequest;
    if (!body?.query) {
      return res.status(400).json({ err: "query_required" });
    }

    const mode = body.mode || "associative";
    const atTime = parseTime(body.at_time);

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
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

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

        return res.json({
          adapter: "durable-postgres",
          ...memory,
        });
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });
      if (req.query.user_id && memory.user_id !== req.query.user_id) {
        return res.status(404).json({ err: "not_found" });
      }

      return res.json({
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
      });
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
        provenance: [],
        contradictions: [],
        inference_path: [],
      });
    } catch (e: any) {
      res.status(500).json({ err: "explain_failed", msg: e.message });
    }
  });

  app.patch("/v1/memories/:id", async (req: any, res: any) => {
    const body = req.body as UpdateRequest;
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

        return res.json({
          adapter: "durable-postgres",
          ...updated,
        });
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
      res.json({ adapter: "legacy-hsg", ...updated });
    } catch (e: any) {
      res.status(500).json({ err: "update_failed", msg: e.message });
    }
  });

  app.post("/v1/memories/:id/reinforce", async (req: any, res: any) => {
    const body = req.body as ReinforceRequest;
    try {
      if (env.metadata_backend === "postgres") {
        const reinforced = await reinforceDurableMemory(durableDb, {
          id: req.params.id,
          user_id: body?.user_id,
          boost: body?.boost,
        });
        if (!reinforced) return res.status(404).json({ err: "not_found" });

        return res.json({
          adapter: "durable-postgres",
          ...reinforced,
        });
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });
      if (body?.user_id && memory.user_id !== body.user_id) {
        return res.status(404).json({ err: "not_found" });
      }

      await reinforce_memory(req.params.id, body?.boost);
      res.json({ ok: true, adapter: "legacy-hsg" });
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

        return res.json({ ok: true, adapter: "durable-postgres" });
      }

      const memory = await q.get_mem.get(req.params.id);
      if (!memory) return res.status(404).json({ err: "not_found" });

      const userId = req.query.user_id || req.body?.user_id;
      if (userId && memory.user_id !== userId) {
        return res.status(403).json({ err: "forbidden" });
      }

      await delete_memory(req.params.id);
      res.json({ ok: true, adapter: "legacy-hsg" });
    } catch (e: any) {
      res.status(500).json({ err: "delete_failed", msg: e.message });
    }
  });

  app.post("/v1/contradictions/:id/resolve", async (req: any, res: any) => {
    const body = req.body as ResolveContradictionRequest;
    if (!body?.resolution) {
      return res.status(400).json({ err: "resolution_required" });
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
}
