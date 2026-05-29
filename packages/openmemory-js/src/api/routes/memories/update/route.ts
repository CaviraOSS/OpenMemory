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

 - filename: packages/openmemory-js/src/api/routes/memories/update/route.ts
 - what is the file used for: registers patch /memories/:id for durable memory updates
*/

import { DurableConflictError, updateDurableMemory } from "../../../../durable/repository";
import { local_update } from "../../../../database/localstore";
import { embed } from "../../../../embeddings/embed";
import { bad, fail, has_update, mem_ref, obj, type route_ctx, type update_req } from "../../_kit";

export const memory_update_route = (app: any, ctx: route_ctx) => {
  app.patch("/memories/:id", async (req: any, res: any) => {
    const body = req.body as update_req;
    if (!has_update(body))
      return bad(res, "body", "body must include content, facets, contracts, metadata, or tags");
    if (body.content !== undefined && typeof body.content !== "string")
      return bad(res, "content", "content must be a string");
    if (body.facets !== undefined && !obj(body.facets))
      return bad(res, "facets", "facets must be an object");
    if (body.contracts !== undefined && !obj(body.contracts))
      return bad(res, "contracts", "contracts must be an object");
    if (body.metadata !== undefined && !obj(body.metadata))
      return bad(res, "metadata", "metadata must be an object");
    if (body.expected_version !== undefined && (!Number.isInteger(body.expected_version) || body.expected_version < 1))
      return bad(res, "expected_version", "expected_version must be a positive integer");

    try {
      const emb = body.content ? await embed(body.content) : undefined;
      const updated = ctx.mem ? await local_update({
        id: req.params.id,
        user_id: body?.user_id,
        content: body?.content,
        facets: body?.facets,
        contracts: body?.contracts,
        metadata: body?.metadata,
        embedding: emb,
      }) : await updateDurableMemory(ctx.db, {
        id: req.params.id,
        user_id: body?.user_id,
        content: body?.content,
        facets: body?.facets,
        contracts: body?.contracts,
        metadata: body?.metadata,
        expected_version: body?.expected_version,
      });
      if (!updated) return res.status(404).json({ err: "not_found" });
      if (ctx.vec && body.content)
        await ctx.vec.upsert({
          id: req.params.id,
          embedding: emb || await embed(body.content),
          content: body.content,
          user_id: body.user_id,
          project_id: undefined,
          metadata: body.metadata,
        });

      const out = { adapter: ctx.mem ? ctx.store : "durable-postgres", ...updated };
      return res.json({ ...out, memory: mem_ref(out) });
    } catch (e: unknown) {
      if (e instanceof DurableConflictError)
        return res.status(409).json({
          err: "conflict",
          msg: e.message,
          expected_version: e.expected_version,
          current_version: e.current_version,
        });
      fail(res, "update_failed", e);
    }
  });
};
