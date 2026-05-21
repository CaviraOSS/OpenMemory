# insp/openmemory-js Forensic Audit

## Scope
- Audited `insp/openmemory-js` recursively: every folder and file currently present in the old JS package snapshot.
- File count: 80. Line count: 24109.
- Method: full inventory, line counts, import/export/route scan, security/runtime grep, and targeted reads of the largest and highest-risk files.
- This is an audit, not a merge. Old code is treated as reference material unless it fits the durable `/v1` architecture.

## Staff-Level Decision
- Do not revive `insp/openmemory-js` wholesale. It mixes SQLite, Postgres, Valkey, MCP, dashboard, IDE, Vercel, temporal routes, source connectors, document/media extraction, background jobs, and old HSG memory behavior in one package.
- Keep the active rewrite Postgres-first and `/v1`-first. Port only small deterministic pieces or well-bounded contracts through durable repository/API boundaries.
- Already ported from this tree: multilingual text handling, deterministic language metadata, simhash fingerprinting, and bounded keyword lexical scoring.

## Highest-Value Old Features
| Priority | Feature | Source evidence | Rewrite action |
| --- | --- | --- | --- |
| P1 | Webhook HMAC verification | `src/server/middleware/webhook.ts`, `tests/webhook.test.ts` | Port into durable source ingestion when connector input contracts exist. |
| P1 | Explicit decay/compression formulas | `src/memory/decay.ts`, `src/ops/compress.ts` | Rebuild as explicit audited admin jobs, never as background timers. |
| P1 | Source connector contracts/rate limiting/retry | `src/sources/base.ts`, connector files | Rebuild after durable source-event schema is stable. |
| P2 | Document/media extraction | `src/ops/extract.ts` | Reintroduce as optional adapters that create extraction candidates. Keep heavy deps optional. |
| P2 | Temporal query semantics | `src/temporal_graph/*`, issue/PR history | Map to durable graph/bitemporal tables, not old route/storage code. |
| P2 | Provider fallback/timeout lessons | `src/memory/embed.ts`, PR history | Keep active embedding code simple; only port missing provider support with tests. |

## Second Runtime-Value Port Pass
- Ported `src/utils/chunking.ts` behavior as `packages/openmemory-js/src/ingestion/chunking.ts`, limited to exact-order candidate chunking.
- Ported selected `src/ops/compress.ts` rules as `packages/openmemory-js/src/ingestion/compression.ts`, limited to deterministic preview metrics with `mutates_storage: false`.
- Ported the useful URL/HTML extraction idea from `src/ops/extract.ts` into `extractUrlContent`, using injected `fetch` and no new dependencies.
- Ported the token-bucket source rate limiter from `src/sources/base.ts` into `SourceRateLimiter`, with injected clock/sleep for tests.
- Still rejected old mutation surfaces: `/compression/*`, `/memory/ingest`, `/memory/ingest/url`, `/sources/*`, old connector classes, and hard PDF/DOCX/audio/video dependencies.

## High-Risk Code To Avoid
- `src/core/db.ts`: 900+ lines mixing backend selection, schema creation, query helpers, vector stores, mutexes, and console logging.
- `src/memory/hsg.ts`: 1,300+ lines of HSG behavior, scoring, waypoints, decay, simhash, and retrieval. Useful ideas are already mined; the module is not a production boundary.
- `src/ai/mcp.ts`: large MCP surface coupled to old memory/server behavior. Rebuild later against durable `/v1` APIs.
- `src/server/routes/*`: most routes are deferred surfaces removed from the active runtime.
- `package-lock.json` and old package metadata: dependency state reflects deleted/deferred surfaces, not the target product package.

## Concrete Line Findings
| File | Lines | Finding |
| --- | --- | --- |
| `src/core/db.ts` | 1, 73-75, 153-162, 500-683 | Imports SQLite and Valkey, switches backend at runtime, starts readiness polling, then defines separate SQLite transaction locking. This is exactly the mixed backend path the rewrite removed. |
| `src/memory/hsg.ts` | 50-177, 249-293, 322-365, 440-478 | Contains useful sector/scoring/simhash/token-overlap ideas but puts them inside one huge HSG module. Only deterministic helpers should be extracted. |
| `src/memory/decay.ts` | 63-84, 225-395 | Decay config and tier formulas are useful, but `apply_decay` is batch/background-oriented and must become an explicit audited operation. |
| `src/ops/extract.ts` | 28-90, 110-218 | Handles PDF/DOCX/HTML/URL/audio/video, but uses heavy dependencies, temp files, and OpenAI transcription. Rebuild as optional source adapters. |
| `src/server/middleware/webhook.ts` | 23-103 | Good constant-time HMAC verification for GitHub/Notion; small enough to port cleanly. |
| `src/server/middleware/auth.ts` | 32-41, 142-191 | Auth/rate-limit concept is useful, but global timer and logging need active-server style cleanup. |
| `src/sources/base.ts` | 76-141, 217-245 | Retry/rate-limit/source abstractions are useful; current `ingestDocument` coupling must be removed. |
| `src/temporal_graph/query.ts` | 4-437 | Query capabilities align with bitemporal goals, but SQL targets old `temporal_facts` storage and must be remapped. |

## File-By-File Verdict
| File | Lines | Verdict | Notes |
| --- | ---: | --- | --- |
| `insp\openmemory-js\.env.example` | 207 | Reference | Use only as historical config/docs signal; active package already has JS-only scripts and narrow CLI. |
| `insp\openmemory-js\.prettierrc` | 8 | Reference | Use only as historical config/docs signal; active package already has JS-only scripts and narrow CLI. |
| `insp\openmemory-js\bin\opm.js` | 256 | Reference | Use only as historical config/docs signal; active package already has JS-only scripts and narrow CLI. |
| `insp\openmemory-js\Dockerfile` | 36 | Reference | Use only as historical config/docs signal; active package already has JS-only scripts and narrow CLI. |
| `insp\openmemory-js\nodemon.json` | 7 | Reference | Use only as historical config/docs signal; active package already has JS-only scripts and narrow CLI. |
| `insp\openmemory-js\package.json` | 53 | Reference | Use only as historical config/docs signal; active package already has JS-only scripts and narrow CLI. |
| `insp\openmemory-js\package-lock.json` | 8490 | Reject | Old dependency graph only; do not port. |
| `insp\openmemory-js\README.md` | 196 | Reference | Use only as historical config/docs signal; active package already has JS-only scripts and narrow CLI. |
| `insp\openmemory-js\src\ai\graph.ts` | 344 | Review | No specific reusable decision found. |
| `insp\openmemory-js\src\ai\mcp.ts` | 892 | Defer | MCP is valuable but must be rebuilt after durable API stabilizes; old module is too broad. |
| `insp\openmemory-js\src\ai\mcp_tools.ts` | 83 | Defer | MCP is valuable but must be rebuilt after durable API stabilizes; old module is too broad. |
| `insp\openmemory-js\src\cli.ts` | 82 | Review | No specific reusable decision found. |
| `insp\openmemory-js\src\core\cfg.ts` | 116 | Reject | Legacy model/config/service wrappers do not match durable API boundary. |
| `insp\openmemory-js\src\core\db.ts` | 921 | Reject | Mixed SQLite/Postgres/Valkey legacy storage conflicts with Postgres-first durable rewrite. |
| `insp\openmemory-js\src\core\identifiers.ts` | 71 | Selective port | Identifier/SSL guardrails are useful patterns; active DB config already centralizes most of this. |
| `insp\openmemory-js\src\core\memory.ts` | 146 | Reject | Legacy model/config/service wrappers do not match durable API boundary. |
| `insp\openmemory-js\src\core\migrate.ts` | 403 | Reject | Mixed SQLite/Postgres/Valkey legacy storage conflicts with Postgres-first durable rewrite. |
| `insp\openmemory-js\src\core\models.ts` | 102 | Reject | Legacy model/config/service wrappers do not match durable API boundary. |
| `insp\openmemory-js\src\core\pg_ssl.ts` | 60 | Selective port | Identifier/SSL guardrails are useful patterns; active DB config already centralizes most of this. |
| `insp\openmemory-js\src\core\telemetry.ts` | 39 | Reject | Legacy model/config/service wrappers do not match durable API boundary. |
| `insp\openmemory-js\src\core\types.ts` | 137 | Reject | Legacy model/config/service wrappers do not match durable API boundary. |
| `insp\openmemory-js\src\core\vector\postgres.ts` | 208 | Reject | Mixed SQLite/Postgres/Valkey legacy storage conflicts with Postgres-first durable rewrite. |
| `insp\openmemory-js\src\core\vector\valkey.ts` | 276 | Reject | Mixed SQLite/Postgres/Valkey legacy storage conflicts with Postgres-first durable rewrite. |
| `insp\openmemory-js\src\core\vector_store.ts` | 29 | Reject | Mixed SQLite/Postgres/Valkey legacy storage conflicts with Postgres-first durable rewrite. |
| `insp\openmemory-js\src\index.ts` | 4 | Reject | Old root export shape is trivial and obsolete. |
| `insp\openmemory-js\src\memory\decay.ts` | 395 | Port carefully | Decay formulas are useful only as explicit audited admin job; no background timers. |
| `insp\openmemory-js\src\memory\embed.ts` | 703 | Selective port | Provider timeout/fallback lessons matter; active embeddings already use simpler facet code. |
| `insp\openmemory-js\src\memory\hsg.ts` | 1287 | Reject wholesale | Overgrown HSG runtime; only deterministic pieces like simhash/lexical scoring were worth porting. |
| `insp\openmemory-js\src\memory\reflect.ts` | 156 | Defer | LLM/reflection summaries need explicit durable worker contracts before revival. |
| `insp\openmemory-js\src\memory\user_summary.ts` | 102 | Defer | LLM/reflection summaries need explicit durable worker contracts before revival. |
| `insp\openmemory-js\src\ops\compress.ts` | 269 | Partially ported | Deterministic compression preview rules were ported as pure helpers; old routes/jobs remain rejected. |
| `insp\openmemory-js\src\ops\dynamics.ts` | 253 | Mine formulas | Compression/dynamics math may inform consolidation/decay jobs; do not restore old routes. |
| `insp\openmemory-js\src\ops\extract.ts` | 300 | Partially ported | Text/HTML/URL extraction ideas were ported without hard deps; PDF/DOCX/audio/video remain optional-adapter errors. |
| `insp\openmemory-js\src\ops\ingest.ts` | 270 | Port later | Document/media extraction should become optional durable candidate creation, not legacy retention ingest. |
| `insp\openmemory-js\src\server.ts` | 1 | Reject | Old Express/server startup had side effects/background jobs; active server is intentionally small. |
| `insp\openmemory-js\src\server\index.ts` | 132 | Reject | Old Express/server startup had side effects/background jobs; active server is intentionally small. |
| `insp\openmemory-js\src\server\middleware\auth.ts` | 180 | Selective port | Keep auth/rate-limit/tenant ideas; remove timer/log boilerplate and fit current middleware shape. |
| `insp\openmemory-js\src\server\middleware\tenant.ts` | 54 | Selective port | Keep auth/rate-limit/tenant ideas; remove timer/log boilerplate and fit current middleware shape. |
| `insp\openmemory-js\src\server\middleware\validate.ts` | 202 | Selective port | Keep auth/rate-limit/tenant ideas; remove timer/log boilerplate and fit current middleware shape. |
| `insp\openmemory-js\src\server\middleware\webhook.ts` | 93 | Port next | HMAC verification and tests are useful; rebuild around active HTTP adapter and durable source ingestion. |
| `insp\openmemory-js\src\server\routes\compression.ts` | 101 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\dashboard.ts` | 439 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\dynamics.ts` | 472 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\ide.ts` | 314 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\index.ts` | 24 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\langgraph.ts` | 66 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\memory.ts` | 352 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\sources.ts` | 183 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\system.ts` | 65 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\temporal.ts` | 572 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\users.ts` | 140 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\routes\vercel.ts` | 104 | Reject route | Old routes advertise deferred dashboard/IDE/Vercel/temporal/source surfaces; keep behavior only through new durable endpoints. |
| `insp\openmemory-js\src\server\server.ts` | 379 | Reject | Old Express/server startup had side effects/background jobs; active server is intentionally small. |
| `insp\openmemory-js\src\sources\base.ts` | 222 | Partially ported | Retry/rate-limit/source content contracts were ported into the durable source framework; old ingest coupling remains rejected. |
| `insp\openmemory-js\src\sources\github.ts` | 173 | Port later | Connector structure is useful after `/v1/ingest` source contract exists; old code is coupled to legacy ingest. |
| `insp\openmemory-js\src\sources\google_drive.ts` | 141 | Port later | Connector structure is useful after `/v1/ingest` source contract exists; old code is coupled to legacy ingest. |
| `insp\openmemory-js\src\sources\google_sheets.ts` | 106 | Port later | Connector structure is useful after `/v1/ingest` source contract exists; old code is coupled to legacy ingest. |
| `insp\openmemory-js\src\sources\google_slides.ts` | 130 | Port later | Connector structure is useful after `/v1/ingest` source contract exists; old code is coupled to legacy ingest. |
| `insp\openmemory-js\src\sources\index.ts` | 18 | Port later | Connector structure is useful after `/v1/ingest` source contract exists; old code is coupled to legacy ingest. |
| `insp\openmemory-js\src\sources\notion.ts` | 153 | Port later | Connector structure is useful after `/v1/ingest` source contract exists; old code is coupled to legacy ingest. |
| `insp\openmemory-js\src\sources\onedrive.ts` | 127 | Port later | Connector structure is useful after `/v1/ingest` source contract exists; old code is coupled to legacy ingest. |
| `insp\openmemory-js\src\sources\web_crawler.ts` | 157 | Port later | Connector structure is useful after `/v1/ingest` source contract exists; old code is coupled to legacy ingest. |
| `insp\openmemory-js\src\temporal_graph\index.ts` | 4 | Selective port | Temporal query semantics fit architecture, but storage/routes must be rebuilt on durable graph schema. |
| `insp\openmemory-js\src\temporal_graph\query.ts` | 393 | Selective port | Temporal query semantics fit architecture, but storage/routes must be rebuilt on durable graph schema. |
| `insp\openmemory-js\src\temporal_graph\store.ts` | 326 | Selective port | Temporal query semantics fit architecture, but storage/routes must be rebuilt on durable graph schema. |
| `insp\openmemory-js\src\temporal_graph\timeline.ts` | 287 | Selective port | Temporal query semantics fit architecture, but storage/routes must be rebuilt on durable graph schema. |
| `insp\openmemory-js\src\temporal_graph\types.ts` | 40 | Selective port | Temporal query semantics fit architecture, but storage/routes must be rebuilt on durable graph schema. |
| `insp\openmemory-js\src\utils\chunking.ts` | 57 | Partially ported | Candidate chunking was ported; vector aggregation remains unnecessary in the current durable path. |
| `insp\openmemory-js\src\utils\index.ts` | 25 | Review | No specific reusable decision found. |
| `insp\openmemory-js\src\utils\keyword.ts` | 112 | Already ported | Deterministic language/token/keyword ideas are already in active durable utilities. |
| `insp\openmemory-js\src\utils\text.ts` | 128 | Already ported | Deterministic language/token/keyword ideas are already in active durable utilities. |
| `insp\openmemory-js\tests\__snapshots__\verify.test.ts.snap` | 25 | Reference tests | Use as behavior inventory only; tests were deleted by request and should be rewritten focused if needed. |
| `insp\openmemory-js\tests\multilingual_dedup.test.ts` | 34 | Reference tests | Use as behavior inventory only; tests were deleted by request and should be rewritten focused if needed. |
| `insp\openmemory-js\tests\omnibus.test.ts` | 173 | Reference tests | Use as behavior inventory only; tests were deleted by request and should be rewritten focused if needed. |
| `insp\openmemory-js\tests\temporal_per_tenant.test.ts` | 170 | Reference tests | Use as behavior inventory only; tests were deleted by request and should be rewritten focused if needed. |
| `insp\openmemory-js\tests\test_project_isolation.ts` | 103 | Reference tests | Use as behavior inventory only; tests were deleted by request and should be rewritten focused if needed. |
| `insp\openmemory-js\tests\verify.test.ts` | 61 | Reference tests | Use as behavior inventory only; tests were deleted by request and should be rewritten focused if needed. |
| `insp\openmemory-js\tests\webhook.test.ts` | 123 | Port next | HMAC verification and tests are useful; rebuild around active HTTP adapter and durable source ingestion. |
| `insp\openmemory-js\tsconfig.json` | 15 | Reference | Use only as historical config/docs signal; active package already has JS-only scripts and narrow CLI. |
| `insp\openmemory-js\vitest.config.ts` | 32 | Review | No specific reusable decision found. |

## Next Implementation Order
1. Port webhook verification plus focused tests into active source ingestion once source events are part of `/v1/ingest`.
2. Rebuild decay as `POST /v1/admin/decay/run` or equivalent explicit repository/admin command with audit rows.
3. Design durable source connector contract, then port only connector fetch/list/rate-limit logic.
4. Reintroduce document extraction behind optional dependencies and candidate promotion.
5. Add temporal graph query endpoints only after the durable graph schema has bitemporal query tests.
