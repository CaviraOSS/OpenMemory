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

 - filename: packages/openmemory-js/src/api/routes/edges/execute/route.ts
 - what is the file used for: registers post /edges/execute for audited executable edge effects
*/

import { executeDurableEdgeHandler } from "../../../../durable/repository";
import { bad, fail, obj, type edge_req, type route_ctx } from "../../_kit";

export const edge_execute_route = (app: any, ctx: route_ctx) => {
  app.post("/edges/execute", async (req: any, res: any) => {
    const body = (req.body || {}) as edge_req;
    if (typeof body.edge_id !== "string" || body.edge_id.trim().length === 0)
      return bad(res, "edge_id", "edge_id must be a non-empty string");
    if (typeof body.edge_type !== "string" || !["supersedes", "contradicts", "derives_from", "same_as"].includes(body.edge_type))
      return bad(res, "edge_type", "edge_type must be supersedes, contradicts, derives_from, or same_as");
    if (typeof body.source_memory_id !== "string" || body.source_memory_id.trim().length === 0)
      return bad(res, "source_memory_id", "source_memory_id must be a non-empty string");
    if (typeof body.target_memory_id !== "string" || body.target_memory_id.trim().length === 0)
      return bad(res, "target_memory_id", "target_memory_id must be a non-empty string");
    if (body.metadata !== undefined && !obj(body.metadata))
      return bad(res, "metadata", "metadata must be an object");

    try {
      const edge = await executeDurableEdgeHandler(ctx.db, {
        edge_id: body.edge_id,
        edge_type: body.edge_type,
        source_memory_id: body.source_memory_id,
        target_memory_id: body.target_memory_id,
        user_id: body.user_id,
        project_id: body.project_id,
        metadata: body.metadata,
      });
      return res.json({ adapter: "durable-postgres", edge });
    } catch (e: unknown) {
      fail(res, "edge_execute_failed", e);
    }
  });
};
