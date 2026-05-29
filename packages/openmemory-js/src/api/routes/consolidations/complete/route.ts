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

 - filename: packages/openmemory-js/src/api/routes/consolidations/complete/route.ts
 - what is the file used for: registers post /consolidations/:id/complete for finished worker output
*/

import { completeDurableConsolidation } from "../../../../durable/repository";
import { bad, fail, obj, type complete_req, type route_ctx } from "../../_kit";

export const consolidation_complete_route = (app: any, ctx: route_ctx) => {
  app.post("/consolidations/:id/complete", async (req: any, res: any) => {
    const body = (req.body || {}) as complete_req;
    if (typeof body.result_memory_id !== "string" || body.result_memory_id.trim().length === 0)
      return bad(res, "result_memory_id", "result_memory_id must be a non-empty string");
    if (body.source_memory_ids !== undefined && (!Array.isArray(body.source_memory_ids) || body.source_memory_ids.some((id) => typeof id !== "string" || id.trim().length === 0)))
      return bad(res, "source_memory_ids", "source_memory_ids must be an array of non-empty strings");
    if (body.metadata !== undefined && !obj(body.metadata))
      return bad(res, "metadata", "metadata must be an object");

    try {
      const completed = await completeDurableConsolidation(ctx.db, {
        id: req.params.id,
        result_memory_id: body.result_memory_id,
        source_memory_ids: body.source_memory_ids,
        summary: body.summary,
        metadata: body.metadata,
      });
      if (!completed) return res.status(404).json({ err: "not_found" });
      return res.json({ adapter: "durable-postgres", consolidation: completed });
    } catch (e: unknown) {
      fail(res, "consolidation_complete_failed", e);
    }
  });
};
