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

 - filename: packages/openmemory-js/src/api/routes/ingest/event/route.ts
 - what is the file used for: registers post /ingest for raw durable source events
*/

import { buildExtractionCandidateInput } from "../../../../durable/ingestion";
import { createExtractionCandidate, createWorkingMemoryEvent } from "../../../../durable/repository";
import { verifyDurableSourceSignature } from "../../../../durable/sourceAuth";
import { bad, fail, obj, type ingest_req, type route_ctx } from "../../_kit";

export const ingest_event_route = (app: any, ctx: route_ctx) => {
  app.post("/ingest", async (req: any, res: any) => {
    const body = (req.body || {}) as ingest_req;
    if (typeof body.source?.kind !== "string" || body.source.kind.trim().length === 0)
      return bad(res, "source.kind", "source.kind must be a non-empty string");
    if (typeof body.content !== "string" || body.content.trim().length === 0)
      return bad(res, "content", "content must be a non-empty string");
    if (body.metadata !== undefined && !obj(body.metadata))
      return bad(res, "metadata", "metadata must be an object");
    if (body.contracts !== undefined && !obj(body.contracts))
      return bad(res, "contracts", "contracts must be an object");

    try {
      const sig = verifyDurableSourceSignature({
        source_kind: body.source.kind,
        raw_body: req.rawBody,
        headers: req.headers,
      });
      if (!sig.ok) {
        const status = sig.reason === "secret_missing" ? 503 : 401;
        return res.status(status).json({
          err: sig.reason === "secret_missing" ? "webhook_not_configured" : "invalid_signature",
          reason: sig.reason,
        });
      }

      const event = await createWorkingMemoryEvent(ctx.db, {
        user_id: body.user_id,
        project_id: body.project_id,
        source: {
          kind: body.source.kind,
          uri: body.source.uri,
          id: body.source.id,
          content_type: body.source.content_type,
        },
        content: body.content,
        metadata: body.metadata,
        contracts: body.contracts,
        observed_at: body.observed_at,
      });
      const candidate = await createExtractionCandidate(
        ctx.db,
        buildExtractionCandidateInput({
          event_id: event.id,
          user_id: body.user_id,
          project_id: body.project_id,
          source: {
            kind: body.source.kind,
            uri: body.source.uri,
            id: body.source.id,
            observed_at: body.observed_at,
          },
          content: body.content,
          metadata: body.metadata,
          contracts: body.contracts,
        }),
      );

      return res.json({
        adapter: "durable-postgres",
        event: {
          ...event,
          extraction: { automatic: true, status: "candidate_created", candidate_id: candidate.id },
        },
        candidate,
      });
    } catch (e: unknown) {
      fail(res, "ingest_failed", e);
    }
  });
};
