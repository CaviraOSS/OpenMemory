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

 - filename: packages/openmemory-js/src/api/routes/recall/route.ts
 - what is the file used for: registers post /recall for memory retrieval
*/

import { recallDurableMemories } from "../../../durable/repository";
import { local_recall } from "../../../database/localstore";
import { embed } from "../../../embeddings/embed";
import {
  bad,
  external_ids,
  fail,
  modes,
  obj,
  parse_time,
  posint,
  to_recall,
  type mode,
  type recall_req,
  type route_ctx,
} from "../_kit";

export const recall_route = (app: any, ctx: route_ctx) => {
  app.post("/recall", async (req: any, res: any) => {
    const body = req.body as recall_req;
    if (typeof body?.query !== "string" || body.query.trim().length === 0)
      return bad(res, "query", "query must be a non-empty string");

    const m = body.mode || "associative";
    if (!modes.includes(m as mode))
      return bad(res, "mode", "mode must be strict, historical, or associative");

    const at = parse_time(body.at_time);
    if (body.at_time !== undefined && at === undefined)
      return bad(res, "at_time", "at_time must be a valid date or timestamp");
    if (body.limit !== undefined && !posint(body.limit))
      return bad(res, "limit", "limit must be a positive integer");
    if (body.source !== undefined && !obj(body.source))
      return bad(res, "source", "source must be an object");
    if (
      body.source &&
      ["kind", "uri", "id"].some(
        (k) =>
          body.source?.[k as keyof NonNullable<recall_req["source"]>] !== undefined &&
          typeof body.source[k as keyof NonNullable<recall_req["source"]>] !== "string",
      )
    )
      return bad(res, "source", "source fields must be strings");

    try {
      const start = Date.now();
      let emb_ms = 0;
      const input = await to_recall(body, m as mode, at, async (text) => {
        const t = Date.now();
        try {
          return await embed(text);
        } finally {
          emb_ms = Date.now() - t;
        }
      });

      if (ctx.mem) {
        const t = Date.now();
        const recalled = await local_recall({
          query: input.query,
          mode: m as mode,
          limit: input.limit,
          user_id: input.user_id,
          project_id: input.project_id,
          embedding: input.embedding,
        });
        const ret_ms = Date.now() - t;
        return res.json({
          query: recalled.query,
          mode: recalled.mode,
          adapter: ctx.store,
          vector_store: ctx.store,
          results: recalled.results,
          ...(body.include_timings
            ? { timings: { embedding_ms: emb_ms, vector_ms: 0, retrieval_ms: ret_ms, total_ms: Date.now() - start } }
            : {}),
        });
      }

      const vt = Date.now();
      const ids = await external_ids(ctx.vec, input);
      const vec_ms = Date.now() - vt;
      if (ctx.vec && ids.length === 0) {
        return res.json({
          query: input.query,
          mode: input.mode,
          adapter: "durable-postgres",
          vector_store: ctx.vec.kind,
          results: [],
          ...(body.include_timings
            ? { timings: { embedding_ms: emb_ms, vector_ms: vec_ms, retrieval_ms: 0, total_ms: Date.now() - start } }
            : {}),
        });
      }

      const rt = Date.now();
      const recalled = await recallDurableMemories(ctx.db, {
        ...input,
        candidate_ids: ids.length ? ids : undefined,
      });
      const ret_ms = Date.now() - rt;
      return res.json({
        query: recalled.query,
        mode: recalled.mode,
        adapter: "durable-postgres",
        vector_store: ctx.vec?.kind || "postgres",
        results: recalled.results,
        ...(body.include_timings
          ? { timings: { embedding_ms: emb_ms, vector_ms: vec_ms, retrieval_ms: ret_ms, total_ms: Date.now() - start } }
          : {}),
      });
    } catch (e: unknown) {
      fail(res, "recall_failed", e);
    }
  });
};
