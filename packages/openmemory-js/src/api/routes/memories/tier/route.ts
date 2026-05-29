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

 - filename: packages/openmemory-js/src/api/routes/memories/tier/route.ts
 - what is the file used for: registers post /memories/:id/tier for memory tier movement
*/

import { moveDurableMemoryTier } from "../../../../durable/repository";
import { bad, fail, type route_ctx, type tier_req } from "../../_kit";

export const memory_tier_route = (app: any, ctx: route_ctx) => {
  app.post("/memories/:id/tier", async (req: any, res: any) => {
    const body = (req.body || {}) as tier_req;
    if (typeof body.tier !== "string" || !["active", "warm", "cold", "archived"].includes(body.tier))
      return bad(res, "tier", "tier must be active, warm, cold, or archived");
    if (body.reason !== undefined && typeof body.reason !== "string")
      return bad(res, "reason", "reason must be a string");

    try {
      const moved = await moveDurableMemoryTier(ctx.db, {
        id: req.params.id,
        tier: body.tier,
        user_id: body.user_id,
        project_id: body.project_id,
        reason: body.reason,
      });
      if (!moved) return res.status(404).json({ err: "not_found" });
      return res.json({ adapter: "durable-postgres", memory: moved });
    } catch (e: unknown) {
      fail(res, "tier_failed", e);
    }
  });
};
