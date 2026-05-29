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

 - filename: packages/openmemory-js/src/api/routes/contradictions/resolve/route.ts
 - what is the file used for: registers post /contradictions/:id/resolve for contradiction resolution
*/

import { resolveDurableContradiction } from "../../../../durable/repository";
import { bad, fail, type resolve_contradiction_req, type route_ctx } from "../../_kit";

export const contradiction_resolve_route = (app: any, ctx: route_ctx) => {
  app.post("/contradictions/:id/resolve", async (req: any, res: any) => {
    const body = req.body as resolve_contradiction_req;
    if (typeof body?.resolution !== "string" || body.resolution.trim().length === 0)
      return bad(res, "resolution", "resolution must be a non-empty string");
    if (body.actor_id !== undefined && typeof body.actor_id !== "string")
      return bad(res, "actor_id", "actor_id must be a string");
    if (body.reason !== undefined && typeof body.reason !== "string")
      return bad(res, "reason", "reason must be a string");

    try {
      const resolved = await resolveDurableContradiction(ctx.db, {
        id: req.params.id,
        resolution: body.resolution,
        actor_id: body.actor_id,
        reason: body.reason,
        user_id: body.user_id,
      });
      if (!resolved) return res.status(404).json({ err: "not_found" });
      return res.json({ adapter: "durable-postgres", ...resolved });
    } catch (e: unknown) {
      fail(res, "resolve_failed", e);
    }
  });
};
