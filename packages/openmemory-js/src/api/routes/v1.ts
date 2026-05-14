import { q, run_async, all_async } from "../../database/connection";
import { env } from "../../configuration";
import { rememberDurableMemory, recallDurableMemory } from "../../durable/repository";
import { add_hsg_memory, hsg_query } from "../../retention/hsg";
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

const parseTime = (value: string | number | undefined) => {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export function v1(app: any) {
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
          { query: (sql, params) => run_async(sql, params as any[]) },
          {
            content: body.content,
            user_id: body.user_id,
            project_id: body.project_id,
            facets: body.facets,
            contracts: body.contracts,
            metadata: body.metadata,
            source: body.source,
          },
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
        const matches = await recallDurableMemory(
          {
            query: (sql, params) => run_async(sql, params as any[]),
            all: (sql, params) => all_async(sql, params as any[]),
          },
          {
            query: body.query,
            mode,
            at_time: atTime,
            limit: body.limit || 10,
            user_id: body.user_id,
            project_id: body.project_id,
          }
        );

        return res.json({
          query: body.query,
          mode,
          adapter: "durable-postgres",
          results: matches.map((memory: any) => ({
            id: memory.id,
            content: memory.content,
            score: memory.score,
            facets: memory.facets,
            primary_facet: memory.primary_facet,
            salience: memory.salience,
            last_seen_at: memory.last_seen_at,
          })),
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

  app.get("/v1/memories/:id/explain", async (req: any, res: any) => {
    try {
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
}
