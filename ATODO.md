# Architecture TODO

## Purpose
- Track the full OpenMemory architecture rewrite as repository state, not chat state.
- Keep the near-term product path JS-only: `packages/openmemory-js`, npm install/fork, `npm run start`.
- Make `/v1/*` the durable product API.
- Keep `/retention/*` as legacy HSG compatibility until parity is proven and explicitly migrated.

## Current State
- Active package: `packages/openmemory-js`.
- Production direction: Postgres plus pgvector.
- Local SQLite behavior: legacy compatibility only, not the production architecture.
- Default runtime surface: health/system, retention compatibility, users, MCP only when stable, and durable `/v1`.
- Durable `/v1` currently covers remember, get, list, update, reinforce, recall, explain, soft delete, contradiction resolve, and pending consolidation requests.
- Durable `/v1/ingest` persists raw working-memory events in Postgres mode. Candidate accept/reject routes are registered, but automatic extraction is still disabled.

## Non-Negotiables
- No Python product path in this rewrite phase.
- No dashboard, VS Code extension, hosted deploy templates, or broad connector rebuild until the JS server is stable.
- Importing the package must not start a server.
- Root `npm run build`, `npm run test`, and `npm run start` must keep working.
- Prefer deleting obsolete code over adapting around it.
- Keep route behavior tenant-safe: user mismatches return `404` where existence would leak.
- Durable writes must be transactional and audited.
- Bitemporal fields must be preserved across create, update, recall, explain, and delete.

## Phase 0: Repo Reduction And JS Runtime Baseline

### Done
- [x] Remove deferred Python, editor, dashboard, examples, ops, local artifact, and hosted deploy surfaces from the active path.
- [x] Keep `packages/openmemory-js` as canonical package.
- [x] Make root npm scripts delegate to the JS workspace.
- [x] Fix package import side effects so SDK import does not bind a port.
- [x] Limit default route registration to the JS core path and explicit durable `/v1`.

### Remaining
- [ ] Recheck stale references after each major deletion: Python, dashboard, VS Code, `SDK/JS`, `SDK/PY`, `backend`, Railway, Render, Vercel.
- [ ] Decide whether any remaining non-core dependencies can be removed from `packages/openmemory-js/package.json`.
- [ ] Keep README aligned with the actual JS-only runtime.

## Phase 1: Durable Schema Foundation

### Done
- [x] Add durable schema migration for Postgres.
- [x] Create core durable tables for memories, versions, entities, edges, provenance, contradictions, inferences, audit, and consolidation.
- [x] Add schema contract tests.
- [x] Wire durable migration into the JS migrate command.

### Remaining
- [ ] Add migration idempotency tests against real Postgres.
- [ ] Add downgrade or forward-only migration policy.
- [ ] Verify pgvector index strategy with realistic cardinality.
- [ ] Add required indexes for tenant and project filters after query plans are measured.

## Phase 2: Durable Memory Lifecycle API

### Done
- [x] `POST /v1/memories`: durable create in Postgres mode.
- [x] `GET /v1/memories/:id`: durable get with facets, contracts, metadata, bitemporal fields, provenance summary, and version count.
- [x] `GET /v1/memories`: durable list with user, project, limit, and offset filters.
- [x] `PATCH /v1/memories/:id`: durable update with version append and audit.
- [x] `POST /v1/memories/:id/reinforce`: durable salience boost with clamp and audit.
- [x] `DELETE /v1/memories/:id`: durable soft delete with audit.
- [x] Tenant mismatch returns `404` for durable memory access.

### Remaining
- [x] Add stricter request validation and consistent `invalid_request` envelopes for malformed `/v1` lifecycle inputs.
- [x] Normalize `/v1` lifecycle tenant mismatches to `404 not_found`.
- [x] Normalize response shapes for create, get, list, update, reinforce, and delete.
- [x] Add pagination metadata for list.
- [ ] Add optimistic concurrency using memory version or updated timestamp.
- [ ] Decide whether delete should support reason metadata and actor identity.

## Phase 3: Durable Recall

### Done
- [x] Move `/v1/recall` to durable repository in Postgres mode.
- [x] Keep SQLite/local fallback on legacy HSG.
- [x] Add strict, historical, and associative recall query contract tests.
- [x] Enforce current validity, provenance visibility, superseded exclusion, contradiction exclusion, and `contracts.recall_allowed !== false`.
- [x] Include global project records where project visibility permits it.

### Remaining
- [ ] Replace placeholder scoring with measured scoring policy.
- [ ] Add vector search path using pgvector embeddings.
- [x] Add query mode validation.
- [ ] Add recall result provenance summaries.
- [ ] Add recall latency budget and benchmark harness.
- [ ] Confirm project-global visibility rules with integration tests.

## Phase 4: Explain API

### Done
- [x] `GET /v1/memories/:id/explain` reads durable memory, provenance, contradictions, inferences, audit, versions, and score components.
- [x] Align inference query with actual durable schema columns.

### Remaining
- [x] Add explain output schema test.
- [x] Add human-readable reason fields without fake narrative.
- [ ] Include recall score inputs when explanation follows recall.
- [ ] Hide internal audit fields that should not be public.
- [ ] Add redaction rules for sensitive provenance metadata.

## Phase 5: Contradictions

### Done
- [x] Add durable contradiction resolution endpoint.
- [x] Write `contradiction.resolve` audit events.
- [x] Exclude unresolved contradictions from strict recall where required.

### Remaining
- [ ] Add contradiction creation path from ingestion and manual API.
- [ ] Add conflict grouping and resolution policy.
- [ ] Add tests for unresolved, resolved, superseded, and cross-project contradictions.
- [ ] Add actor and reason fields to resolution.

## Phase 6: Consolidation

### Done
- [x] Add `POST /v1/consolidations` for pending durable consolidation requests in Postgres mode.
- [x] Write `consolidation.request` audit events.

### Remaining
- [ ] Build consolidation worker contract before implementation.
- [ ] Define consolidation states: pending, running, completed, failed, canceled.
- [ ] Add consolidation result records and links to source memories.
- [ ] Add idempotency key support.
- [ ] Add scheduler or explicit admin trigger.
- [ ] Add evals to prove consolidation improves recall before enabling automatic consolidation.

## Phase 7: Ingestion Pipeline

### Remaining
- [x] Design input event model for text, document, URL, provider event, and manual memory in `docs/durable-ingestion-design.md`.
- [x] Add working memory buffer event tables and repository.
- [x] Add extraction candidate repository for explicit facets, entities, edges, provenance-adjacent metadata, and contracts.
- [x] Add explicit promotion path that turns accepted extraction candidates into durable memories.
- [x] Add route/API contract for accepting or rejecting extraction candidates.
- [x] Add opt-in real Postgres integration coverage for durable ingestion event and audit writes.
- [ ] Keep automatic NLP extraction disabled until outputs are testable.
- [ ] Move `/retention/ingest` and `/retention/ingest/url` only after durable ingestion parity exists.
- [x] Add replayable durable ingestion event and candidate tests from fixed fixtures.
- [ ] Add durable ingestion promotion tests from fixed fixtures.

## Phase 8: Cognitive Graph And Executable Edges

### Remaining
- [ ] Finalize entity schema, edge schema, and allowed relationship types.
- [ ] Add edge confidence, provenance, and temporal validity.
- [ ] Add graph traversal repository.
- [ ] Add executable edge runtime boundary without hidden side effects.
- [ ] Add graph explainability and audit trail.
- [ ] Add tenant/project isolation tests for graph traversal.

## Phase 9: Contracts, Privacy, And Safety

### Remaining
- [ ] Define public contract schema for recall permissions, retention policy, sensitivity, source visibility, and expiry.
- [ ] Enforce contracts in create, update, recall, explain, export, and delete.
- [ ] Add field-level redaction for explain and recall.
- [ ] Add audit actor model.
- [ ] Add secure defaults for unauthenticated local development and production mode.
- [ ] Add tests for denial, redaction, expiry, and source-scoped recall.

## Phase 10: Legacy Route Parity And Migration

### Remaining
- [x] Inventory every `/retention/*` route.
- [x] Classify each `/retention/*` route as keep, move to `/v1`, or delete.
- [x] Write parity tests for current legacy add, query, get, list, update, reinforce, and delete behavior before replacing internals.
- [x] Write parity tests for current legacy document and URL ingest behavior before replacing internals.
- [ ] Move compatible behavior onto durable repositories behind `/v1`.
- [ ] Keep `/retention/*` responses stable until deprecation is announced.
- [ ] Add deprecation warnings only after client impact is understood.
- [ ] Remove legacy HSG internals after parity and migration are complete.

### Current `/retention/*` Classification
- [ ] `POST /retention/add`: keep as legacy compatibility; durable replacement is `POST /v1/memories`.
- [ ] `POST /retention/ingest`: keep legacy for now; durable ingestion pipeline is not built.
- [ ] `POST /retention/ingest/url`: keep legacy for now; durable URL ingestion is not built.
- [ ] `POST /retention/query`: keep as legacy compatibility; durable replacement is `POST /v1/recall`.
- [ ] `POST /retention/reinforce`: keep as legacy compatibility; durable replacement is `POST /v1/memories/:id/reinforce`.
- [ ] `PATCH /retention/:id`: keep as legacy compatibility; durable replacement is `PATCH /v1/memories/:id`.
- [ ] `GET /retention/all`: keep as legacy compatibility; durable replacement is `GET /v1/memories`.
- [ ] `GET /retention/:id`: keep as legacy compatibility; durable replacement is `GET /v1/memories/:id`.
- [ ] `DELETE /retention/:id`: keep legacy for now; it hard-deletes memory, vectors, and waypoints, while durable `DELETE /v1/memories/:id` soft-deletes.

## Phase 11: Code Quality And De-AI Pass

### Remaining
- [x] Remove unused `dotenv` dependency after confirming the package uses its custom `.env` loader.
- [ ] Remove tutorial comments, generic "production grade" language, and fake-clean scaffolding.
- [ ] Inline trivial helpers.
- [x] Narrow package root exports to the SDK surface; do not export deferred provider or ingestion surfaces from `src/index.ts`.
- [x] Demote deferred provider SDKs from hard dependencies by using optional dynamic imports.
- [ ] Delete dead providers and unused route modules only after import graph confirms they are unused.
- [ ] Split oversized files only when a stable boundary is proven by tests.
- [ ] Normalize names to framework idioms: `req`, `res`, repository verbs, durable domain nouns.
- [ ] Replace copy/paste error handling with small consistent helpers where repetition is real.
- [ ] Add linting only after the codebase can pass it without masking real work.

## Phase 12: Performance And Reliability

### Remaining
- [ ] Add query plan checks for durable list, recall, explain, and graph traversal.
- [ ] Add memory and CPU baseline for local server startup.
- [ ] Add connection pool configuration tests.
- [ ] Add timeout and cancellation behavior for slow providers.
- [ ] Add retry policy only for safe idempotent operations.
- [ ] Add load smoke for recall and create.

## Phase 13: Packaging And Release

### Remaining
- [ ] Confirm `npm pack` contents.
- [ ] Confirm public SDK exports are server-safe and side-effect-free.
- [ ] Add minimal CLI checks for `opm`.
- [ ] Add release workflow for npm only when package contents are stable.
- [ ] Add versioning policy.
- [ ] Add install-from-GitHub path in README.

## Phase 14: Deferred Product Surfaces

### Deferred Until JS Core Is Stable
- [ ] Dashboard rebuild.
- [ ] VS Code extension.
- [ ] Python SDK.
- [ ] Hosted one-click deploy configs.
- [ ] Broad connector/webhook surfaces.
- [ ] Multi-app UI management.

## Verification Checklist For Every Tranche
- [ ] Update `TODO.md` at start and end.
- [ ] Add failing tests before implementation for new behavior.
- [ ] Run targeted tests for the touched area.
- [ ] Run `npm run build`.
- [ ] Run `npm run test` when practical.
- [ ] Run `git status --short`.
- [ ] Update `docs/ai-context.md` and `docs/decisions.md` for reusable decisions.
