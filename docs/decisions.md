# Decisions

## 2026-05-13
- Initialize persistent AI memory files because they were missing.
- Near-term rewrite direction: JavaScript-only server-first package; defer VS Code and adjacent integrations.
- Use `packages/openmemory-js` as the canonical product package for the rewrite.
- Prefer a strangler rewrite: build a clean durable core inside the JS package while temporarily adapting legacy endpoints.
- Production storage target is Postgres + pgvector first; SQLite local mode is deferred.
- Public API should stay small: remember, recall, explain, consolidate, resolve contradiction.
- Aggressive cleanup removes deferred product surfaces from the active tree instead of parking them.
- Cleanup pass may edit docs/config/workflows/package metadata, but should avoid changing JS implementation logic until the setup task is complete.

## 2026-05-14
- JS package startup contract: `npm run dev` runs `src/server.ts`, `npm run build` emits `dist`, and `npm run start` runs `dist/server.js`.
- Importing `openmemory-js` must not start an HTTP server; server startup is explicit through `startServer()`.
- Default server route set is limited to health/system, retention memory, users, and MCP; dashboard, IDE, Vercel, connector webhooks, compression, dynamics, LangGraph, and temporal HTTP routes are deferred.
- Root env and compose defaults are Postgres + pgvector first; SQLite remains legacy/local compatibility, not the advertised production path.
- Live server cleanup should improve only the default runtime path first; broad splits of `connection.ts` and `hsg.ts` wait for the durable-core rewrite.
- `TODO.md` is part of the persistent workflow and must be updated on every user prompt.
- Rewrite Phase 0 root npm workflow is active: root scripts delegate to the `openmemory-js` workspace for dev, build, start, test, and migrate.
- Durable rewrite now has a Postgres-first schema module under `src/durable/schema.ts`; migration version `2.0.0-durable-core` creates the target durable tables and pgvector index.
- `/v1/memories`, `/v1/recall`, and `/v1/memories/:id/explain` exist as explicit legacy-HSG adapters until the durable repository/pipeline replaces their internals.
- `/v1/memories` uses the durable repository when `OM_METADATA_BACKEND=postgres`; SQLite compatibility continues to use legacy HSG until a Postgres test harness exists.
- `/v1/recall` and `/v1/memories/:id/explain` use durable repositories when `OM_METADATA_BACKEND=postgres`; SQLite compatibility remains on legacy HSG.
- Durable `/v1` route execution must use `all_async` for SELECT queries and `transaction.begin/commit/rollback` for repository transaction commands; plain `run_async("BEGIN")` is not a real Postgres transaction.
- Durable `/v1/memories` supports explicit structured entity and edge input first; automatic NLP extraction is deferred until the durable route has a Postgres integration harness.
- Durable explain inference queries must use the schema columns `memory_id`, `derived_from`, and `inference_method`; do not reference non-existent `output_memory_id` or `inference_type` columns.
- Real Postgres durable `/v1` verification is opt-in through `OM_TEST_POSTGRES_URL`; default tests skip it so local SQLite compatibility remains fast and dependency-light.
- Durable memory writes must insert a `memory_versions` row in the same transaction, and explain responses expose the version history.
- Durable deletes are soft deletes: set `superseded_at`, write a `memory.delete` audit event, and rely on durable recall filters to exclude superseded memories.
- Durable `/v1` is the product API path for lifecycle operations. `/retention/*` stays legacy HSG compatibility until endpoint parity is intentionally proven.
- Durable update appends a new `memory_versions` row and writes `memory.update` audit; durable reinforce clamps salience and writes `memory.reinforce` audit.
- Strict durable recall excludes memories with `contracts.recall_allowed === false`.
- Durable explain exposes score components directly instead of requiring callers to infer confidence, provenance, contradiction, and contract state from raw arrays.
- Durable contradiction resolution is explicit through `/v1/contradictions/:id/resolve`; it updates open contradiction rows to resolved and writes `contradiction.resolve` audit.

## 2026-05-15
- `ATODO.md` is the repository-level architecture rewrite backlog; `TODO.md` tracks the immediate active tranche.
- Durable consolidation starts as an explicit request API: `POST /v1/consolidations` creates a pending row and audit event in Postgres mode.
- The consolidation worker, automatic scheduling, and recall-impact evals remain deferred; do not auto-merge memories until evaluation proves behavior.
- `/retention/*` stays as legacy compatibility after classification; do not silently point it at durable repositories until parity tests account for behavior differences such as hard delete versus durable soft delete.
- `/v1` validation errors use `{ err: "invalid_request", field, msg }`; validation should run before durable/legacy storage work or unsupported-mode checks.
- Dependency cleanup should remove only demonstrably unused packages until provider exports are narrowed; `dotenv` is removed because the package has its own `.env` loader and no runtime import.
- `/v1` memory lifecycle tenant mismatches return `404 not_found` even in legacy-backed local mode; legacy `/retention/*` keeps its existing compatibility status codes.
- Durable ingestion starts with a persisted input-event design and fixture tests; do not move `/retention/ingest*` until raw event storage, extraction candidates, durable writes, and audit behavior are implemented.
- `/v1` success responses keep existing top-level fields for compatibility while adding normalized `memory`, `page`, and `deleted` envelopes for new clients.
- Durable ingestion raw events are stored in `working_memory_events` and audited with `ingestion.event`; extraction candidates stay separate so failed extraction can preserve raw input without partial memory writes.
- Durable extraction candidates are persisted explicitly before promotion to memories; automatic NLP extraction remains disabled until deterministic fixture tests exist for the promotion path.
- `/v1/ingest` exists as a Postgres-only raw event endpoint. It does not replace `/retention/ingest*` and does not promote candidates to memories yet.
- Extraction candidate promotion is repository-level and transactional; route-level accept/reject controls remain separate from raw `/v1/ingest`.
- Legacy document and URL ingestion remain on `/retention/*` with parity coverage; durable ingestion should not replace them until route-level candidate acceptance and Postgres integration tests exist.
- Candidate accept/reject controls live under `/v1/ingest/candidates/:id/*` and are Postgres-only until durable ingestion has local-compatible semantics.
- Real Postgres ingestion verification must assert persisted rows, not only HTTP response shape; the opt-in harness checks `working_memory_events` and `audit_log`.
- The package root should remain SDK-only and server-safe. Deferred ingestion helpers and provider modules stay internal until those surfaces are intentionally revived.
- GitHub, Notion, Google, OneDrive, and web crawler SDKs are optional provider installs, not default JS server dependencies.
- Explain responses should keep a normalized structural schema across durable and legacy adapters so clients do not need adapter-specific field checks.
- Explain reason text must stay deterministic and factual until recall scoring and provenance policy are evaluated; avoid fake generated narratives.
- Delete only tests outside the active rewrite safety net. Unreferenced manual or corrupted legacy tests can go; retention parity tests stay until `/retention/*` migration is complete.
