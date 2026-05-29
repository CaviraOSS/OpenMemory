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

 - filename: packages/openmemory-js/src/api/routes/memories/explain/route.ts
 - what is the file used for: registers get /memories/:id/explain for durable explain output
*/

import { explainDurableMemory } from "../../../../durable/repository";
import { bad, fail, modes, type mode, type route_ctx } from "../../_kit";

export const memory_explain_route = (app: any, ctx: route_ctx) => {
  app.get("/memories/:id/explain", async (req: any, res: any) => {
    try {
      const query = typeof req.query.recall_query === "string" ? req.query.recall_query : undefined;
      const m = (req.query.recall_mode || "associative") as mode;
      if (query && !modes.includes(m))
        return bad(res, "recall_mode", "recall_mode must be strict, historical, or associative");

      const explained = await explainDurableMemory(ctx.db, {
        id: req.params.id,
        recall: query ? { query, mode: m } : undefined,
      });
      if (!explained) return res.status(404).json({ err: "not_found" });
      return res.json({ adapter: "durable-postgres", ...explained });
    } catch (e: unknown) {
      fail(res, "explain_failed", e);
    }
  });
};
