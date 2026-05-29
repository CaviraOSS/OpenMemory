/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename: packages/openmemory-js/src/api/routes/memories/delete/route.ts
 - what is the file used for: registers delete /memories/:id for soft deletion
*/

import { deleteDurableMemory } from "../../../../durable/repository";
import { local_delete } from "../../../../database/localstore";
import { bad, fail, type delete_req, type route_ctx } from "../../_kit";

export const memory_delete_route = (app: any, ctx: route_ctx) => {
  app.delete("/memories/:id", async (req: any, res: any) => {
    const body = (req.body || {}) as delete_req;
    if (body.actor_id !== undefined && typeof body.actor_id !== "string")
      return bad(res, "actor_id", "actor_id must be a string");
    if (body.reason !== undefined && typeof body.reason !== "string")
      return bad(res, "reason", "reason must be a string");

    try {
      const deleted = ctx.mem ? await local_delete(req.params.id, req.query.user_id || body.user_id) : await deleteDurableMemory(ctx.db, {
        id: req.params.id,
        user_id: req.query.user_id || body.user_id,
        actor_id: body.actor_id,
        reason: body.reason,
      });
      if (!deleted) return res.status(404).json({ err: "not_found" });
      if (ctx.vec) await ctx.vec.delete(req.params.id);
      return res.json({ ok: true, adapter: "durable-postgres", deleted: { id: req.params.id } });
    } catch (e: unknown) {
      fail(res, "delete_failed", e);
    }
  });
};
