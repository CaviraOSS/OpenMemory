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

 - filename: packages/openmemory-js/src/api/routes/memories/get/route.ts
 - what is the file used for: registers get /memories/:id for single memory fetch
*/

import { getDurableMemory } from "../../../../durable/repository";
import { local_get } from "../../../../database/localstore";
import { fail, type route_ctx } from "../../_kit";

export const memory_get_route = (app: any, ctx: route_ctx) => {
  app.get("/memories/:id", async (req: any, res: any) => {
    try {
      const memory = ctx.mem ? await local_get(req.params.id, {
        user_id: req.query.user_id,
        project_id: req.query.project_id,
      }) : await getDurableMemory(ctx.db, {
        id: req.params.id,
        user_id: req.query.user_id,
        project_id: req.query.project_id,
      });
      if (!memory) return res.status(404).json({ err: "not_found" });
      const out = { adapter: ctx.mem ? ctx.store : "durable-postgres", ...memory };
      return res.json({ ...out, memory: { ...out } });
    } catch (e: unknown) {
      fail(res, "get_failed", e);
    }
  });
};
