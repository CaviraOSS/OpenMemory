# AI Context

## Project
- OpenMemory repository.
- Current focus: architectural rewrite and code improvement.
- User priority: remove Python surfaces; make the project JavaScript-only for now.

## Current Goal
- Continue `/retention/*` parity review before moving legacy route behavior onto durable internals.

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
- `tests/postgres_v1_integration.ts` is an opt-in real Postgres HTTP harness. It runs when `OM_TEST_POSTGRES_URL` is set and skips in default local test runs.
- Current JS package still contains legacy internals that will be handled in later rewrite phases: custom `server.js`, SQLite/Postgres branches, sector-based HSG memory, waypoints, and route groups beyond the future `/v1` API.
