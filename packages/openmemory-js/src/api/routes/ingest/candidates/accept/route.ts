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

 - filename: packages/openmemory-js/src/api/routes/ingest/candidates/accept/route.ts
 - what is the file used for: registers post /ingest/candidates/:id/accept for candidate promotion
*/

import { promoteExtractionCandidate } from "../../../../../durable/repository";
import { bad, fail, obj, type accept_req, type route_ctx } from "../../../_kit";

export const candidate_accept_route = (app: any, ctx: route_ctx) => {
  app.post("/ingest/candidates/:id/accept", async (req: any, res: any) => {
    const body = (req.body || {}) as accept_req;
    if (typeof req.params?.id !== "string" || req.params.id.trim().length === 0)
      return bad(res, "id", "id must be a non-empty string");
    if (body.source !== undefined && !obj(body.source))
      return bad(res, "source", "source must be an object");

    try {
      const memory = await promoteExtractionCandidate(ctx.db, {
        candidate_id: req.params.id,
        source: body.source,
      });
      if (!memory) return res.status(404).json({ err: "not_found" });
      return res.json({ adapter: "durable-postgres", memory });
    } catch (e: unknown) {
      fail(res, "candidate_accept_failed", e);
    }
  });
};
