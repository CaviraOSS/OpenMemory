import { q, vector_store } from "../../database/connection";
import { p } from "../../utilities";
import {
  update_userSummary,
  auto_update_user_summaries,
} from "../../retention/userSummary";

export const usr = (app: any) => {
  app.get("/users/:user_id/summary", async (req: any, res: any) => {
    try {
      const userId = req.params.user_id;
      if (!userId) return res.status(400).json({ error: "user_id required" });

      const user = await q.get_user.get(userId);
      if (!user) return res.status(404).json({ error: "user not found" });

      res.json({
        user_id: user.user_id,
        summary: user.summary,
        reflection_count: user.reflection_count,
        updated_at: user.updated_at,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/users/:user_id/summary/regenerate", async (req: any, res: any) => {
    try {
      const userId = req.params.user_id;
      if (!userId) return res.status(400).json({ err: "user_id required" });

      await update_userSummary(userId);
      const user = await q.get_user.get(userId);

      res.json({
        ok: true,
        user_id: userId,
        summary: user?.summary,
        reflection_count: user?.reflection_count,
      });
    } catch (err: any) {
      res.status(500).json({ err: err.message });
    }
  });

  app.post("/users/summaries/regenerate-all", async (req: any, res: any) => {
    try {
      const result = await auto_update_user_summaries();
      res.json({ ok: true, updated: result.updated });
    } catch (err: any) {
      res.status(500).json({ err: err.message });
    }
  });

  app.get("/users/:user_id/memories", async (req: any, res: any) => {
    try {
      const userId = req.params.user_id;
      if (!userId) return res.status(400).json({ err: "user_id required" });

      const limit = req.query.l ? parseInt(req.query.l) : 100;
      const offset = req.query.u ? parseInt(req.query.u) : 0;

      const rows = await q.all_mem_by_user.all(userId, limit, offset);
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
      }));
      res.json({ user_id: userId, items });
    } catch (err: any) {
      res.status(500).json({ err: err.message });
    }
  });

  app.delete("/users/:user_id/memories", async (req: any, res: any) => {
    try {
      const userId = req.params.user_id;
      if (!userId) return res.status(400).json({ err: "user_id required" });

      const memories = await q.all_mem_by_user.all(userId, 10000, 0);
      let deleted = 0;

      for (const memory of memories) {
        await q.del_mem.run(memory.id);
        await vector_store.deleteVectors(memory.id);
        await q.del_waypoints.run(memory.id, memory.id);
        deleted++;
      }

      res.json({ ok: true, deleted });
    } catch (err: any) {
      res.status(500).json({ err: err.message });
    }
  });
};
