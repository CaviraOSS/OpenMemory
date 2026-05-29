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

 - filename: packages/openmemory-js/src/api/routes/consolidations/claim/route.ts
 - what is the file used for: registers post /consolidations/claim for worker job claiming
*/

import { claimDurableConsolidation } from "../../../../durable/repository";
import { bad, fail, type claim_req, type route_ctx } from "../../_kit";

export const consolidation_claim_route = (app: any, ctx: route_ctx) => {
  app.post("/consolidations/claim", async (req: any, res: any) => {
    const body = (req.body || {}) as claim_req;
    if (typeof body.worker_id !== "string" || body.worker_id.trim().length === 0)
      return bad(res, "worker_id", "worker_id must be a non-empty string");

    try {
      const job = await claimDurableConsolidation(ctx.db, {
        worker_id: body.worker_id,
        user_id: body.user_id,
        project_id: body.project_id,
      });
      return res.json({ adapter: "durable-postgres", job });
    } catch (e: unknown) {
      fail(res, "consolidation_claim_failed", e);
    }
  });
};
