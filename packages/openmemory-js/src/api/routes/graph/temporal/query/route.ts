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

 - filename: packages/openmemory-js/src/api/routes/graph/temporal/query/route.ts
 - what is the file used for: registers post /graph/temporal/query for bitemporal graph reads
*/

import { queryDurableTemporalGraph } from "../../../../../durable/repository";
import { bad, fail, parse_time, posint, type route_ctx, type temporal_req } from "../../../_kit";

const edge_types = ["mentions", "supports", "contradicts", "derives_from", "supersedes", "same_as", "causes", "depends_on", "part_of", "related_to"];

export const graph_temporal_query_route = (app: any, ctx: route_ctx) => {
  app.post("/graph/temporal/query", async (req: any, res: any) => {
    const body = (req.body || {}) as temporal_req;
    if (body.edge_type !== undefined && !edge_types.includes(body.edge_type))
      return bad(res, "edge_type", "edge_type is not supported");
    if (body.limit !== undefined && !posint(body.limit))
      return bad(res, "limit", "limit must be a positive integer");
    for (const f of ["at_time", "from", "to"] as const)
      if (body[f] !== undefined && parse_time(body[f]) === undefined)
        return bad(res, f, `${f} must be a valid date`);

    try {
      const graph = await queryDurableTemporalGraph(ctx.db, body);
      return res.json({ adapter: "durable-postgres", graph });
    } catch (e: unknown) {
      fail(res, "temporal_graph_failed", e);
    }
  });
};
