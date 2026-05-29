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

 - filename: packages/openmemory-js/src/api/routes/memories/create/route.ts
 - what is the file used for: registers post /memories for creating durable memories
*/

import { rememberDurableMemory } from "../../../../durable/repository";
import { local_add } from "../../../../database/localstore";
import { embed } from "../../../../embeddings/embed";
import { bad, fail, mem_ref, obj, to_memory, type remember_req, type route_ctx } from "../../_kit";

export const memory_create_route = (app: any, ctx: route_ctx) => {
  app.post("/memories", async (req: any, res: any) => {
    const body = req.body as remember_req;
    if (typeof body?.content !== "string" || body.content.trim().length === 0)
      return bad(res, "content", "content must be a non-empty string");
    if (body.metadata !== undefined && !obj(body.metadata))
      return bad(res, "metadata", "metadata must be an object");
    if (body.facets !== undefined && !obj(body.facets))
      return bad(res, "facets", "facets must be an object");
    if (body.contracts !== undefined && !obj(body.contracts))
      return bad(res, "contracts", "contracts must be an object");

    try {
      const embedding = await embed(body.content);
      if (ctx.mem) {
        const memory = await local_add(to_memory(body, embedding));
        return res.json({
          id: memory.id,
          memory_id: memory.id,
          status: memory.status,
          adapter: ctx.store,
          memory: mem_ref(memory),
        });
      }

      const memory = await rememberDurableMemory(ctx.db, to_memory(body, embedding));
      if (ctx.vec) {
        await ctx.vec.upsert({
          id: memory.id,
          embedding,
          content: body.content,
          user_id: body.user_id || "anonymous",
          project_id: body.project_id || null,
          metadata: body.metadata,
        });
      }

      return res.json({
        id: memory.id,
        memory_id: memory.id,
        status: memory.status,
        adapter: "durable-postgres",
        memory: mem_ref(memory),
      });
    } catch (e: unknown) {
      fail(res, "remember_failed", e);
    }
  });
};
