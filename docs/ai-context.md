# AI Context

## Project
- OpenMemory repository.
- Current focus: architectural rewrite and code improvement.
- User priority: remove Python surfaces; make the project JavaScript-only for now.

## Current Goal
- Continue `/retention/*` parity review before moving legacy route behavior onto durable internals.
- Use `ATODO.md` as the full step-by-step architecture rewrite backlog; use `TODO.md` for the immediate active tranche.

## Architecture Inputs
- Target architecture from the attached architecture document: bitemporal, append-only cognitive graph with working memory, facets, provenance, contracts, contradictions, consolidation, three recall modes, explain API, and Postgres + pgvector first.
- FigJam board `cHvNZ1CU304RAH4ccuADBv`: input event -> working memory buffer -> ingestion pipeline -> durable cognitive graph -> executable edge runtime -> consolidation -> memory tiers -> recall engine -> explain API -> agent/app response.

## Repo Snapshot
- Active implementation package is `packages/openmemory-js`.
- Deferred surfaces were removed from the active tree during cleanup: secondary SDKs, old examples, ops tools, editor extension, dashboard shell, local DB/temp artifacts, and hosted deploy configs.
- Current default JS server surface is intentionally narrow: health/system, retention memory, users, and MCP when it builds cleanly.
- Initial `/v1` memory endpoints are registered. `/v1/memories`, `/v1/recall`, and `/v1/memories/:id/explain` use durable repositories on Postgres and fall back to legacy HSG in SQLite compatibility mode.
- Durable `/v1/memories` accepts structured entities and edges, then writes `entities`, `memory_entities`, and `edges` rows inside the memory transaction.
- Durable `/v1/memories` writes an append-only `memory_versions` row, and durable explain returns that version history.
- `DELETE /v1/memories/:id` is available. In Postgres mode it soft-deletes by setting `superseded_at`, writes audit, and recall excludes the memory.
- Durable `/v1` lifecycle endpoints now cover get, list, update, reinforce, explain, recall, remember, and soft delete. `/retention/*` remains legacy HSG compatibility.
- Strict durable recall enforces `contracts.recall_allowed !== false` in addition to provenance, current validity, and contradiction checks.
- Durable explain responses include score components for confidence, salience, provenance, contradiction penalty, contract penalty, and contract state.
- `POST /v1/contradictions/:id/resolve` resolves durable contradiction rows in Postgres mode and writes audit.
- `POST /v1/consolidations` records pending durable consolidation requests in Postgres mode and writes audit; the actual consolidation worker is not implemented yet.
- `/retention/*` routes are inventoried and classified in `ATODO.md`; keep them as legacy compatibility until parity tests prove safe migration, especially because legacy delete is hard-delete while durable delete is soft-delete.
- `/v1` malformed input now returns a consistent `400` envelope: `{ err: "invalid_request", field, msg }`.
- `/v1` memory lifecycle routes hide tenant mismatch as `404 not_found`, including the legacy-backed local delete adapter; `/retention/*` keeps legacy compatibility behavior.
- `/v1` memory lifecycle success responses preserve top-level compatibility fields and add normalized envelopes: `memory`, `page`, or `deleted` depending on the operation.
- `dotenv` was removed from dependencies because configuration uses the custom `.env` loader in `src/configuration/index.ts`; remaining provider/MCP/ingestion/vector dependencies are still referenced by exported or active code.
- Durable ingestion is specified in `docs/durable-ingestion-design.md`; `/retention/ingest*` stays legacy until durable ingestion fixtures and working-memory tables exist.
- Durable ingestion now has `working_memory_events` and `extraction_candidates` schema tables. `createWorkingMemoryEvent` records raw input events and writes `ingestion.event` audit rows.
- `createExtractionCandidate` records deterministic extraction candidates with facets, entities, edges, contracts, confidence, metadata, and `ingestion.candidate` audit rows.
- `POST /v1/ingest` is registered. It validates raw durable ingestion events and writes `working_memory_events` only in Postgres mode; local SQLite mode returns `501 unsupported`.
- `promoteExtractionCandidate` promotes a pending extraction candidate to durable `memories`, `memory_versions`, provenance, entities, edges, candidate accepted status, and `ingestion.promote` audit in one transaction.
- `POST /v1/ingest/candidates/:id/accept` and `POST /v1/ingest/candidates/:id/reject` are registered as Postgres-only durable candidate controls. Reject writes `ingestion.reject` audit; accept uses candidate promotion.
- Legacy `/retention/ingest` and `/retention/ingest/url` behavior is covered by parity tests before any durable migration.
- `tests/postgres_v1_integration.ts` is an opt-in real Postgres HTTP harness. It runs when `OM_TEST_POSTGRES_URL` is set and skips in default local test runs.
- The opt-in Postgres harness now checks that `/v1/ingest` persists both `working_memory_events` and matching `audit_log` rows.
- Package root exports are intentionally narrow: `src/index.ts` exports the `Memory` SDK/service surface only. Deferred ingestion helpers and provider modules are no longer root exports.
- Deferred provider SDKs for GitHub, Notion, Google, OneDrive, and web crawling are optional runtime installs, not hard package dependencies.
- `/v1/memories/:id/explain` exposes a normalized schema in both durable Postgres and legacy local modes: bitemporal, score components, provenance, contradictions, inference path, versions, audit events, contracts, and metadata.
- Explain responses include deterministic factual `reasons` strings derived from confidence, provenance count, open contradiction count, and recall contract state. Do not generate narrative explanations yet.
- Obsolete unreferenced tests `tests/verify.ts` and `tests/multilingual_dedup.ts` were removed. Keep durable, v1, Postgres opt-in, retention parity, import smoke, omnibus, and project isolation tests until their covered behavior is intentionally replaced.
- Current JS package still contains legacy internals that will be handled in later rewrite phases: custom `server.js`, SQLite/Postgres branches, sector-based HSG memory, waypoints, and route groups beyond the future `/v1` API.
