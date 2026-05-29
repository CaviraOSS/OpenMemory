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

 - filename: packages/openmemory-js/src/api/routes/index.ts
 - what is the file used for: registers every active api route with one shared route context
*/

import { admin_decay_run_route } from "./admin/decay/run/route";
import { contradiction_create_route } from "./contradictions/create/route";
import { contradiction_resolve_route } from "./contradictions/resolve/route";
import { consolidation_claim_route } from "./consolidations/claim/route";
import { consolidation_complete_route } from "./consolidations/complete/route";
import { consolidation_create_route } from "./consolidations/create/route";
import { edge_execute_route } from "./edges/execute/route";
import { graph_temporal_query_route } from "./graph/temporal/query/route";
import { health_route } from "./health/route";
import { candidate_accept_route } from "./ingest/candidates/accept/route";
import { candidate_reject_route } from "./ingest/candidates/reject/route";
import { ingest_document_route } from "./ingest/document/route";
import { ingest_event_route } from "./ingest/event/route";
import { make_ctx } from "./_kit";
import { memory_create_route } from "./memories/create/route";
import { memory_delete_route } from "./memories/delete/route";
import { memory_explain_route } from "./memories/explain/route";
import { memory_get_route } from "./memories/get/route";
import { memory_list_route } from "./memories/list/route";
import { memory_reinforce_route } from "./memories/reinforce/route";
import { memory_tier_route } from "./memories/tier/route";
import { memory_update_route } from "./memories/update/route";
import { recall_route } from "./recall/route";
import { source_ingest_route } from "./sources/ingest/route";

export function routes(app: any) {
  const ctx = make_ctx();
  health_route(app);
  memory_create_route(app, ctx);
  recall_route(app, ctx);
  memory_list_route(app, ctx);
  memory_get_route(app, ctx);
  memory_explain_route(app, ctx);
  memory_update_route(app, ctx);
  memory_reinforce_route(app, ctx);
  memory_tier_route(app, ctx);
  memory_delete_route(app, ctx);
  contradiction_create_route(app, ctx);
  contradiction_resolve_route(app, ctx);
  consolidation_create_route(app, ctx);
  consolidation_claim_route(app, ctx);
  consolidation_complete_route(app, ctx);
  edge_execute_route(app, ctx);
  graph_temporal_query_route(app, ctx);
  admin_decay_run_route(app, ctx);
  ingest_event_route(app, ctx);
  ingest_document_route(app, ctx);
  source_ingest_route(app, ctx);
  candidate_accept_route(app, ctx);
  candidate_reject_route(app, ctx);
}
