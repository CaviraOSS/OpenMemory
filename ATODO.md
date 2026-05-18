# Architecture TODO

## Purpose
- Track the full OpenMemory architecture rewrite as repository state, not chat state.
- Keep the near-term product path JS-only: `packages/openmemory-js`, npm install/fork, `npm run start`.
- Make `/v1/*` the durable product API.
- Keep legacy compatibility out of the default runtime unless explicitly revived.

## Current State
- Active package: `packages/openmemory-js`.
- Production direction: Postgres plus pgvector.
- SQLite behavior is removed from the active runtime and migration path.
- Default runtime surface: `/health` and durable `/v1`.
- Durable `/v1` currently covers remember, get, list, update, reinforce, recall, explain, soft delete, contradiction resolve, and pending consolidation requests.
- Durable `/v1/ingest` persists raw working-memory events in Postgres mode. Candidate accept/reject routes are registered, but automatic extraction is still disabled.

## Non-Negotiables
- No Python product path in this rewrite phase.
- No dashboard, VS Code extension, hosted deploy templates, or broad connector rebuild until the JS server is stable.
- Importing the package must not start a server.
- Root `npm run build`, `npm run test`, and `npm run start` must keep working. `npm run test` is currently build-only because package test files were deleted by request.
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
- [x] Replace the old custom `api/server.js` wrapper with a small TypeScript HTTP adapter.
- [x] Remove SQLite and Valkey compatibility from the active runtime and migration path.

### Remaining
- [x] Recheck stale references after each major deletion: Python, dashboard, VS Code, `SDK/JS`, `SDK/PY`, `backend`, Railway, Render, Vercel.
- [x] Decide whether any remaining non-core dependencies can be removed from `packages/openmemory-js/package.json`.
- [x] Keep README aligned with the actual JS-only runtime.

## Phase 1: Durable Schema Foundation

### Done
- [x] Add durable schema migration for Postgres.
- [x] Create core durable tables for memories, versions, entities, edges, provenance, contradictions, inferences, audit, and consolidation.
- [x] Add schema contract tests.
- [x] Wire durable migration into the JS migrate command.

### Remaining
- [x] Add migration idempotency tests against real Postgres.
- [x] Add downgrade or forward-only migration policy.
- [x] Verify pgvector index strategy with realistic cardinality.
- [x] Add required indexes for tenant and project filters after query plans are measured.

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
- [x] Add optimistic concurrency using memory version or updated timestamp.
- [x] Decide whether delete should support reason metadata and actor identity.

## Phase 3: Durable Recall

### Done
- [x] Move `/v1/recall` to durable repository in Postgres mode.
- [x] Remove SQLite/local fallback after deleting legacy HSG.
- [x] Add strict, historical, and associative recall query contract tests.
- [x] Enforce current validity, provenance visibility, superseded exclusion, contradiction exclusion, and `contracts.recall_allowed !== false`.
- [x] Include global project records where project visibility permits it.

### Remaining
- [x] Replace placeholder scoring with measured scoring policy.
- [x] Add vector search path using pgvector embeddings.
- [x] Add query mode validation.
- [x] Add recall result provenance summaries.
- [x] Add recall latency budget and benchmark harness.
- [x] Confirm project-global visibility rules with integration tests.

## Phase 4: Explain API

### Done
- [x] `GET /v1/memories/:id/explain` reads durable memory, provenance, contradictions, inferences, audit, versions, and score components.
- [x] Align inference query with actual durable schema columns.

### Remaining
- [x] Add explain output schema test.
- [x] Add human-readable reason fields without fake narrative.
- [x] Include recall score inputs when explanation follows recall.
- [x] Hide internal audit fields that should not be public.
- [x] Add redaction rules for sensitive provenance metadata.

## Phase 5: Contradictions

### Done
- [x] Add durable contradiction resolution endpoint.
- [x] Write `contradiction.resolve` audit events.
- [x] Exclude unresolved contradictions from strict recall where required.
- [x] Add tests for unresolved, resolved, superseded, and cross-project contradictions.
- [x] Add actor and reason fields to resolution.

### Remaining
- [x] Add contradiction creation path from ingestion and manual API.
- [x] Add conflict grouping and resolution policy.

## Phase 6: Consolidation

### Done
- [x] Add `POST /v1/consolidations` for pending durable consolidation requests in Postgres mode.
- [x] Write `consolidation.request` audit events.

### Remaining
- [x] Build consolidation worker contract before implementation.
- [x] Define consolidation states: pending, running, completed, failed, canceled.
- [x] Add consolidation result records and links to source memories.
- [x] Add idempotency key support.
- [x] Add scheduler or explicit admin trigger.
- [x] Add evals to prove consolidation improves recall before enabling automatic consolidation.

## Phase 7: Ingestion Pipeline

### Remaining
- [x] Design input event model for text, document, URL, provider event, and manual memory in `docs/durable-ingestion-design.md`.
- [x] Add working memory buffer event tables and repository.
- [x] Add extraction candidate repository for explicit facets, entities, edges, provenance-adjacent metadata, and contracts.
- [x] Add explicit promotion path that turns accepted extraction candidates into durable memories.
- [x] Add route/API contract for accepting or rejecting extraction candidates.
- [x] Add opt-in real Postgres integration coverage for durable ingestion event and audit writes.
- [x] Keep automatic NLP extraction disabled until outputs are testable.
- [x] Move `/retention/ingest` and `/retention/ingest/url` only after durable ingestion parity exists.
- [x] Add replayable durable ingestion event and candidate tests from fixed fixtures.
- [x] Add durable ingestion promotion tests from fixed fixtures.

## Phase 8: Cognitive Graph And Executable Edges

### Remaining
- [x] Finalize entity schema, edge schema, and allowed relationship types.
- [x] Add edge confidence, provenance, and temporal validity.
- [x] Add graph traversal repository.
- [x] Add executable edge runtime boundary without hidden side effects.
- [x] Add graph explainability and audit trail.
- [x] Add tenant/project isolation tests for graph traversal.

## Phase 9: Contracts, Privacy, And Safety

### Remaining
- [x] Define public contract schema for recall permissions, retention policy, sensitivity, source visibility, and expiry.
- [x] Enforce contracts in create, update, recall, explain, export, and delete.
- [x] Add field-level redaction for explain and recall.
- [x] Add audit actor model.
- [x] Add secure defaults for unauthenticated local development and production mode.
- [x] Denial, redaction, expiry, and source-scoped recall behavior were implemented; package test files were later deleted by request.

## Phase 10: Legacy Route Parity And Migration

### Remaining
- [x] Inventory every `/retention/*` route.
- [x] Classify each `/retention/*` route as keep, move to `/v1`, or delete.
- [x] Legacy add, query, get, list, update, reinforce, and delete behavior was previously covered; package test files were later deleted by request.
- [x] Legacy document and URL ingest behavior was previously covered; package test files were later deleted by request.
- [x] Move compatible behavior onto durable repositories behind `/v1`.
- [x] Keep `/retention/*` responses stable until deprecation is announced.
- [x] Add deprecation warnings using headers only; keep `/retention/*` JSON bodies stable.
- [x] Remove legacy HSG internals that are no longer referenced by exported SDK/provider surfaces.

### Former `/retention/*` Classification
- [x] `POST /retention/add`: removed from default runtime; durable replacement is `POST /v1/memories`.
- [x] `POST /retention/ingest`: removed from default runtime; durable ingestion is `/v1/ingest`.
- [x] `POST /retention/ingest/url`: removed from default runtime.
- [x] `POST /retention/query`: removed from default runtime; durable replacement is `POST /v1/recall`.
- [x] `POST /retention/reinforce`: removed from default runtime; durable replacement is `POST /v1/memories/:id/reinforce`.
- [x] `PATCH /retention/:id`: removed from default runtime; durable replacement is `PATCH /v1/memories/:id`.
- [x] `GET /retention/all`: removed from default runtime; durable replacement is `GET /v1/memories`.
- [x] `GET /retention/:id`: removed from default runtime; durable replacement is `GET /v1/memories/:id`.
- [x] `DELETE /retention/:id`: removed from default runtime; durable replacement is soft-delete `DELETE /v1/memories/:id`.

## Phase 11: Code Quality And De-AI Pass

### Remaining
- [x] Remove unused `dotenv` dependency after confirming the package uses its custom `.env` loader.
- [x] Remove tutorial comments, generic "production grade" language, and fake-clean scaffolding.
- [x] Inline trivial helpers where it clearly reduces code; current shared helpers were kept because inlining would increase churn.
- [x] Narrow package root exports to the SDK surface; do not export deferred provider or ingestion surfaces from `src/index.ts`.
- [x] Demote deferred provider SDKs from hard dependencies by using optional dynamic imports.
- [x] Delete dead providers and unused route modules only after import graph confirms they are unused.
- [x] Remove deferred provider source modules after removing `Memory.source()` from the public SDK.
- [x] Split oversized files only when a stable boundary is proven by tests; no current split was safe enough to justify churn.
- [x] Normalize names to framework idioms: `req`, `res`, repository verbs, durable domain nouns.
- [x] Replace copy/paste error handling with small consistent helpers where repetition is real.
- [x] Rename active embedding internals from sectors to facets and delete unused legacy embedding helpers.
- [x] Remove legacy `OM_TIER` embedding selection so provider behavior follows `OM_EMBEDDINGS` directly.
- [x] Clean `dist` before package builds so deleted source surfaces cannot remain in build artifacts.
- [x] Delete unused legacy request type definitions for removed runtime surfaces.
- [x] Delete unused retention-era chunking, keyword, and vector utility modules.
- [x] Add linting only after the codebase can pass it without masking real work. Prettier check now passes.

## Phase 12: Performance And Reliability

### Remaining
- [x] Query-plan checks for durable list, recall, explain, and graph traversal were implemented; package test files were later deleted by request.
- [x] Add memory and CPU baseline for local server startup.
- [x] Add connection pool configuration tests.
- [x] Add timeout and cancellation behavior for slow providers.
- [x] Add retry policy only for safe idempotent operations.
- [x] Add load smoke for recall and create.

## Phase 13: Packaging And Release

### Remaining
- [x] Confirm `npm pack` contents.
- [x] Confirm public SDK exports are server-safe and side-effect-free.
- [x] Add minimal CLI checks for `opm`.
- [x] Add release workflow for npm only when package contents are stable.
- [x] Add versioning policy.
- [x] Add install-from-GitHub path in README.

## Phase 14: Deferred Product Surfaces

### Deferred Until JS Core Is Stable
- [ ] Dashboard rebuild.
- [ ] VS Code extension.
- [ ] Python SDK.
- [ ] Hosted one-click deploy configs.
- [ ] Broad connector/webhook surfaces.
- [ ] Multi-app UI management.

## Verification Checklist For Every Tranche
- [x] Update `TODO.md` at start and end.
- [x] Test files were deleted by request; use build-only verification until a smaller test strategy is rebuilt.
- [x] Run targeted build/type checks for the touched area.
- [x] Run `npm run build`.
- [x] Run `npm run test` when practical; it is currently build-only.
- [x] Run `git status --short`.
- [x] Update `docs/ai-context.md` and `docs/decisions.md` for reusable decisions.
