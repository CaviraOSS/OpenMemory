import { q, vector_store } from "../../database/connection";
import { j, p } from "../../utilities";
import {
  add_hsg_memory,
  hsg_query,
  reinforce_memory,
  update_memory,
} from "../../retention/hsg";
import { ingestDocument, ingestURL } from "../../operations/ingest";
import { update_userSummary } from "../../retention/userSummary";
import type {
  add_req,
  q_req,
  ingest_req,
  ingest_url_req,
} from "../../types/index";

export function mem(app: any) {
  app.post("/retention/add", async (req: any, res: any) => {
    const body = req.body as add_req;
    if (!body?.content) return res.status(400).json({ err: "content" });

    const userId = body.user_id;
    const projectId = body.project_id;
    try {
      const memory = await add_hsg_memory(
        body.content,
        j(body.tags || []),
        body.metadata,
        userId,
        projectId,
      );
      res.json(memory);

      if (userId) {
        update_userSummary(userId).catch((e) =>
          console.error("[mem] user summary update failed:", e),
        );
      }
    } catch (e: any) {
      res.status(500).json({ err: e.message });
    }
  });

  app.post("/retention/ingest", async (req: any, res: any) => {
    const body = req.body as ingest_req;
    if (!body?.content_type || !body?.data)
      return res.status(400).json({ err: "missing" });
    try {
      const result = await ingestDocument(
        body.content_type,
        body.data,
        body.metadata,
        body.config,
        body.user_id,
      );
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ err: "ingest_fail", msg: e.message });
    }
  });

  app.post("/retention/ingest/url", async (req: any, res: any) => {
    const body = req.body as ingest_url_req;
    if (!body?.url) return res.status(400).json({ err: "no_url" });
    try {
      const result = await ingestURL(
        body.url,
        body.metadata,
        body.config,
        body.user_id,
      );
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ err: "url_fail", msg: e.message });
    }
  });

  app.post("/retention/query", async (req: any, res: any) => {
    const body = req.body as q_req;
    const limit = body.k || 8;
    try {
      const filters = {
        sectors: body.filters?.sector ? [body.filters.sector] : undefined,
        minSalience: body.filters?.min_score,
        user_id: body.filters?.user_id || body.user_id,
        project_id: body.filters?.project_id || body.project_id,
        startTime: body.filters?.startTime ?? body.startTime,
        endTime: body.filters?.endTime ?? body.endTime,
      };
      const matches = await hsg_query(body.query, limit, filters);
      res.json({
        query: body.query,
        matches: matches.map((memory: any) => ({
          id: memory.id,
          content: memory.content,
          score: memory.score,
          sectors: memory.sectors,
          primary_sector: memory.primary_sector,
          path: memory.path,
          salience: memory.salience,
          last_seen_at: memory.last_seen_at,
        })),
      });
    } catch (e: any) {
      res.status(500).json({ err: "query_failed", msg: e.message });
    }
  });

  app.post("/retention/reinforce", async (req: any, res: any) => {
    const body = req.body as { id: string; boost?: number };
    if (!body?.id) return res.status(400).json({ err: "id" });
    try {
      await reinforce_memory(body.id, body.boost);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(404).json({ err: "nf" });
    }
  });

  app.patch("/retention/:id", async (req: any, res: any) => {
    const memoryId = req.params.id;
    const body = req.body as {
      content?: string;
      tags?: string[];
      metadata?: any;
      user_id?: string;
    };
    if (!memoryId) return res.status(400).json({ err: "id" });
    try {
      const memory = await q.get_mem.get(memoryId);
      if (!memory) return res.status(404).json({ err: "nf" });

      if (body.user_id && memory.user_id !== body.user_id) {
        return res.status(403).json({ err: "forbidden" });
      }

      const result = await update_memory(
        memoryId,
        body.content,
        body.tags,
        body.metadata,
      );
      res.json(result);
    } catch (e: any) {
      if (e.message.includes("not found")) {
        res.status(404).json({ err: "nf" });
      } else {
        res.status(500).json({ err: "internal" });
      }
    }
  });

  app.get("/retention/all", async (req: any, res: any) => {
    try {
      const offset = req.query.u ? parseInt(req.query.u) : 0;
      const limit = req.query.l ? parseInt(req.query.l) : 100;
      const sector = req.query.sector;
      const userId = req.query.user_id;

      let rows;
      if (userId) {
        rows = await q.all_mem_by_user.all(userId, limit, offset);
      } else if (sector) {
        rows = await q.all_mem_by_sector.all(sector, limit, offset);
      } else {
        rows = await q.all_mem.all(limit, offset);
      }

      const items = rows.map((memory: any) => ({
        id: memory.id,
        content: memory.content,
        tags: p(memory.tags),
        metadata: p(memory.meta),
        created_at: memory.created_at,
        updated_at: memory.updated_at,
        last_seen_at: memory.last_seen_at,
        salience: memory.salience,
        decay_lambda: memory.decay_lambda,
        primary_sector: memory.primary_sector,
        version: memory.version,
        user_id: memory.user_id,
      }));
      res.json({ items });
    } catch (e: any) {
      res.status(500).json({ err: "internal" });
    }
  });

  app.get("/retention/:id", async (req: any, res: any) => {
    try {
      const memoryId = req.params.id;
      const userId = req.query.user_id;
      const memory = await q.get_mem.get(memoryId);
      if (!memory) return res.status(404).json({ err: "nf" });

      if (userId && memory.user_id !== userId) {
        return res.status(403).json({ err: "forbidden" });
      }

      const vectors = await vector_store.getVectorsById(memoryId);
      const sectors = vectors.map((vector: any) => vector.sector);
      res.json({
        id: memory.id,
        content: memory.content,
        primary_sector: memory.primary_sector,
        sectors,
        tags: p(memory.tags),
        metadata: p(memory.meta),
        created_at: memory.created_at,
        updated_at: memory.updated_at,
        last_seen_at: memory.last_seen_at,
        salience: memory.salience,
        decay_lambda: memory.decay_lambda,
        version: memory.version,
        user_id: memory.user_id,
      });
    } catch (e: any) {
      res.status(500).json({ err: "internal" });
    }
  });

  app.delete("/retention/:id", async (req: any, res: any) => {
    try {
      const memoryId = req.params.id;
      const userId = req.query.user_id || req.body?.user_id;
      const memory = await q.get_mem.get(memoryId);
      if (!memory) return res.status(404).json({ err: "nf" });

      if (userId && memory.user_id !== userId) {
        return res.status(403).json({ err: "forbidden" });
      }

      await q.del_mem.run(memoryId);
      await vector_store.deleteVectors(memoryId);
      await q.del_waypoints.run(memoryId, memoryId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ err: "internal" });
    }
  });
}
