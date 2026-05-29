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

 - filename: packages/openmemory-js/src/api/routes/contradictions/create/route.ts
 - what is the file used for: registers post /contradictions for manual contradiction creation
*/

import { createDurableContradiction } from "../../../../durable/repository";
import { bad, fail, obj, type create_contradiction_req, type route_ctx } from "../../_kit";

export const contradiction_create_route = (app: any, ctx: route_ctx) => {
  app.post("/contradictions", async (req: any, res: any) => {
    const body = (req.body || {}) as create_contradiction_req;
    if (typeof body.memory_id !== "string" || body.memory_id.trim().length === 0)
      return bad(res, "memory_id", "memory_id must be a non-empty string");
    if (typeof body.contradicts_memory_id !== "string" || body.contradicts_memory_id.trim().length === 0)
      return bad(res, "contradicts_memory_id", "contradicts_memory_id must be a non-empty string");
    if (body.confidence !== undefined && (typeof body.confidence !== "number" || body.confidence < 0 || body.confidence > 1))
      return bad(res, "confidence", "confidence must be between 0 and 1");
    if (body.metadata !== undefined && !obj(body.metadata))
      return bad(res, "metadata", "metadata must be an object");

    try {
      const created = await createDurableContradiction(ctx.db, {
        user_id: body.user_id,
        project_id: body.project_id,
        memory_id: body.memory_id,
        contradicts_memory_id: body.contradicts_memory_id,
        conflict_group_id: body.conflict_group_id,
        resolution_policy: body.resolution_policy,
        confidence: body.confidence,
        metadata: body.metadata,
      });
      return res.json({ adapter: "durable-postgres", ...created, contradiction: { ...created } });
    } catch (e: unknown) {
      fail(res, "contradiction_create_failed", e);
    }
  });
};
