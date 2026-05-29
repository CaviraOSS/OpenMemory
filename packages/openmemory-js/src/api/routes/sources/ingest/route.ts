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

 - filename: packages/openmemory-js/src/api/routes/sources/ingest/route.ts
 - what is the file used for: registers post /sources/:source/ingest for connector-backed source ingestion
*/

import { OptionalExtractorUnavailable } from "../../../../ingestion/extract";
import { SourceConfigError, ingestSourceConnector } from "../../../../sources/framework";
import { getSourceConnector } from "../../../../sources/registry";
import { bad, fail, obj, type route_ctx, type source_req } from "../../_kit";

export const source_ingest_route = (app: any, ctx: route_ctx) => {
  app.post("/sources/:source/ingest", async (req: any, res: any) => {
    const body = (req.body || {}) as source_req;
    if (body.config !== undefined && !obj(body.config))
      return bad(res, "config", "config must be an object");
    if (body.filters !== undefined && !obj(body.filters))
      return bad(res, "filters", "filters must be an object");
    if (body.contracts !== undefined && !obj(body.contracts))
      return bad(res, "contracts", "contracts must be an object");

    try {
      const connector = getSourceConnector(req.params.source, body.config || {});
      const result = await ingestSourceConnector(ctx.db, connector, {
        user_id: body.user_id,
        project_id: body.project_id,
        filters: body.filters,
        contracts: body.contracts,
      });
      return res.json({ adapter: "durable-postgres", source: req.params.source, ...result });
    } catch (e: unknown) {
      if (e instanceof SourceConfigError)
        return res.status(400).json({ err: "source_config", msg: e.message });
      if (e instanceof OptionalExtractorUnavailable)
        return res.status(422).json({
          err: "extractor_unavailable",
          content_type: e.content_type,
          install_hint: e.install_hint,
        });
      fail(res, "source_ingest_failed", e);
    }
  });
};
