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

 - filename: packages/openmemory-js/src/api/routes/admin/decay/run/route.ts
 - what is the file used for: registers post /admin/decay/run for explicit decay jobs
*/

import { runDurableDecayJob } from "../../../../../durable/repository";
import { bad, fail, posint, type decay_req, type route_ctx } from "../../../_kit";

export const admin_decay_run_route = (app: any, ctx: route_ctx) => {
  app.post("/admin/decay/run", async (req: any, res: any) => {
    const body = (req.body || {}) as decay_req;
    if (body.limit !== undefined && !posint(body.limit))
      return bad(res, "limit", "limit must be a positive integer");
    if (body.dry_run !== undefined && typeof body.dry_run !== "boolean")
      return bad(res, "dry_run", "dry_run must be a boolean");
    if (body.actor_id !== undefined && typeof body.actor_id !== "string")
      return bad(res, "actor_id", "actor_id must be a string");

    try {
      const decay = await runDurableDecayJob(ctx.db, {
        user_id: body.user_id,
        project_id: body.project_id,
        actor_id: body.actor_id,
        limit: body.limit,
        dry_run: body.dry_run,
      });
      return res.json({ adapter: "durable-postgres", decay });
    } catch (e: unknown) {
      fail(res, "decay_failed", e);
    }
  });
};
