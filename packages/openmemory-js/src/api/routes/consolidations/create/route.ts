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

 - filename: packages/openmemory-js/src/api/routes/consolidations/create/route.ts
 - what is the file used for: registers post /consolidations for durable consolidation requests
*/

import { createDurableConsolidation } from "../../../../durable/repository";
import { bad, fail, obj, type consolidation_req, type route_ctx } from "../../_kit";

export const consolidation_create_route = (app: any, ctx: route_ctx) => {
  app.post("/consolidations", async (req: any, res: any) => {
    const body = (req.body || {}) as consolidation_req;
    if (body.source_memory_ids !== undefined && (!Array.isArray(body.source_memory_ids) || body.source_memory_ids.some((id) => typeof id !== "string" || id.length === 0)))
      return bad(res, "source_memory_ids", "source_memory_ids must be an array of non-empty strings");
    if (body.scope !== undefined && !obj(body.scope)) return bad(res, "scope", "scope must be an object");
    if (body.metadata !== undefined && !obj(body.metadata)) return bad(res, "metadata", "metadata must be an object");

    try {
      const consolidation = await createDurableConsolidation(ctx.db, {
        user_id: body.user_id,
        project_id: body.project_id,
        idempotency_key: body.idempotency_key,
        scope: body.scope,
        source_memory_ids: body.source_memory_ids,
        metadata: body.metadata,
      });
      return res.json({ adapter: "durable-postgres", ...consolidation });
    } catch (e: unknown) {
      fail(res, "consolidation_failed", e);
    }
  });
};
