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

 - filename: packages/openmemory-js/src/api/routes/memories/list/route.ts
 - what is the file used for: registers get /memories for paged memory listing
*/

import { listDurableMemories } from "../../../../durable/repository";
import { local_list } from "../../../../database/localstore";
import { bad, fail, parse_posint, type route_ctx } from "../../_kit";

export const memory_list_route = (app: any, ctx: route_ctx) => {
  app.get("/memories", async (req: any, res: any) => {
    try {
      const limit = parse_posint(req.query.limit);
      const offset = req.query.offset === undefined || req.query.offset === "" ? undefined : Number(req.query.offset);
      if (req.query.limit !== undefined && limit === undefined)
        return bad(res, "limit", "limit must be a positive integer");
      if (req.query.offset !== undefined && (!Number.isInteger(offset) || Number(offset) < 0))
        return bad(res, "offset", "offset must be a non-negative integer");

      const listed = ctx.mem ? await local_list({
        user_id: req.query.user_id,
        project_id: req.query.project_id,
        limit,
        offset,
      }) : await listDurableMemories(ctx.db, {
        user_id: req.query.user_id,
        project_id: req.query.project_id,
        limit,
        offset,
      });
      return res.json({
        adapter: ctx.mem ? ctx.store : "durable-postgres",
        ...listed,
        page: { limit: listed.limit, offset: listed.offset, count: listed.items.length },
      });
    } catch (e: unknown) {
      fail(res, "list_failed", e);
    }
  });
};
