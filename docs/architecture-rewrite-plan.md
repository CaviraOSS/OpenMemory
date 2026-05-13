# OpenMemory JS-Only Architecture Rewrite Plan

## Goal

Make OpenMemory a durable, JavaScript/Node-first memory server that can be installed from npm or forked from GitHub, then started with `npm run start`.

Near-term scope is the server and JS package. Python, VS Code, dashboards, and secondary integrations are deferred unless needed to keep the server usable.

## Planning Inputs

- Attached architecture document: target architecture is a bitemporal, append-only cognitive graph with facets, provenance, contracts, contradictions, recall modes, explainability, consolidation, and Postgres + pgvector first.
- FigJam board `cHvNZ1CU304RAH4ccuADBv`: input event -> working memory -> ingestion pipeline -> durable cognitive graph -> executable edge runtime -> consolidation -> memory tiers -> recall engine -> explain API -> app response, with append-only audit log.
- Initial repo scan found multiple deferred surfaces. The cleanup pass removed them from the active tree so the JS package is the primary implementation path.

## Recommended Approach

Use a strangler rewrite inside the JS package:

1. Keep `packages/openmemory-js` as the product package.
2. Create a clean `src/durable/*` core beside the current HSG implementation.
3. Put the new server API on the target architecture.
4. Keep legacy endpoints only as thin compatibility adapters during transition.
5. Delete Python and stale surfaces once the JS server has parity for core remember/recall/explain flows.

This avoids a blank rewrite while still forcing clean boundaries.

## Step-By-Step Plan

### Phase 0: Freeze Scope and Define the Product Shape

1. Declare `packages/openmemory-js` the canonical product.
2. Add a root `package.json` workspace so a fresh fork can run:
   - `npm install`
   - `npm run start`
3. Make root `npm run start` delegate to the JS package server.
4. Define the supported near-term commands:
   - `npm run start`: build if needed and start server.
   - `npm run dev`: run server from TypeScript for local work.
   - `npm run test`: run JS tests only.
   - `npm run migrate`: run JS/Postgres migrations.
5. Treat TypeScript as acceptable JS ecosystem code unless the product requirement becomes literal `.js` only.

### Phase 1: Remove Python From the Product Path

1. Remove or archive secondary SDKs, old examples, migration utilities, related docs, and non-JS CI/publish workflows.
2. Replace Python migration providers with JS-only migration modules where still needed.
3. Remove Python references from README, docs, Makefile, Docker, deploy templates, and CI.
4. Remove build-time Python dependencies by making Postgres + pgvector the default and eliminating `sqlite3` from the first supported server path.
5. Keep any removed behavior documented in a short migration note, not as live code.

### Phase 2: Make the JS Server Start Reliably

1. Split package imports from server startup:
   - `src/index.ts` exports SDK/client APIs only.
   - `src/server/entry.ts` starts the HTTP server.
   - Importing `openmemory-js` must not start a server.
2. Replace or isolate the custom `server.js` wrapper.
   - Preferred: use a boring HTTP framework with schema validation and predictable middleware.
   - Minimum: keep the wrapper temporarily but hide it behind a small app adapter.
3. Add `/health` as the first contract.
4. Add clear startup validation:
   - Node version
   - required Postgres settings
   - pgvector availability
   - embedding provider configuration
5. Ensure fresh fork path works without generated artifacts checked in:
   - `npm run start` runs build then `node dist/server/entry.js`.

### Phase 3: Build the Durable Storage Core

1. Replace inline schema creation in `core/db.ts` with versioned JS SQL migrations.
2. Make Postgres + pgvector the default production store.
3. Create the target tables:
   - `memories`
   - `memory_versions`
   - `entities`
   - `memory_entities`
   - `edges`
   - `contradictions`
   - `provenance`
   - `inferences`
   - `working_memory`
   - `consolidations`
   - `audit_log`
4. Store facets and contracts as typed JSONB with database-level defaults.
5. Add bitemporal columns:
   - `valid_from`
   - `valid_to`
   - `observed_at`
   - `recorded_at`
   - `superseded_at`
6. Require every durable write to emit an audit row in the same transaction.

### Phase 4: Replace Sectors With Facets

1. Keep old sector names only as compatibility input.
2. Introduce `memory_facets`:
   - episodic
   - semantic
   - procedural
   - emotional
   - reflective
3. Implement a deterministic facet extractor first.
4. Add optional LLM-assisted extraction later, behind a provider interface.
5. Convert `primary_sector` scoring to facet-aware scoring.
6. Store multiple embeddings or embedding metadata only where it improves recall quality.

### Phase 5: Create the Ingestion Pipeline

1. Make all durable writes pass through one pipeline:
   - validate input event
   - update bounded working memory
   - resolve entities
   - extract facets
   - score provenance
   - assign memory contract
   - detect contradictions
   - write memory, entities, edges, provenance, audit
2. Block raw direct database writes from routes.
3. Normalize source records:
   - source kind
   - source URI or ID
   - extraction method
   - trust score
   - observed time
4. Keep document connectors out of the first rewrite unless they feed this same pipeline cleanly.

### Phase 6: Implement Executable Edge Runtime

1. Add transaction handlers for key edge types:
   - `supersedes`: close old validity, mark superseded, transfer partial salience, audit.
   - `contradicts`: create contradiction record, keep both memories, lower strict confidence, audit.
   - `derived_from`: store inference path, inherit provenance confidence with damping, audit.
   - `same_as`: merge entity references without deleting mentions, audit.
2. Do not allow edge writes that bypass handlers.
3. Keep graph traversal bounded and explainable.

### Phase 7: Build Recall Modes

1. Replace generic internal recall with explicit modes:
   - `strict`
   - `historical`
   - `associative`
2. Public API target:
   - `memory.remember({ content, source, metadata })`
   - `memory.recall({ query, mode, at_time, limit })`
   - `memory.explain({ memory_id })`
   - `memory.consolidate({ scope })`
   - `memory.resolve_contradiction({ contradiction_id, resolution })`
3. HTTP API target:
   - `POST /v1/memories`
   - `POST /v1/recall`
   - `GET /v1/memories/:id/explain`
   - `POST /v1/consolidations`
   - `POST /v1/contradictions/:id/resolve`
4. Keep old `/memory/add` and `/memory/query` as adapters until docs and examples are migrated.
5. Enforce contracts at recall time.

### Phase 8: Add Explainability and Trust Controls

1. Return score components:
   - embedding similarity
   - graph support
   - temporal relevance
   - salience
   - confidence
   - provenance
   - contract penalty
   - contradiction penalty
2. Add an explain API that returns:
   - source trail
   - bitemporal state
   - confidence components
   - contradictions
   - inference path
3. Require strict recall to either produce sourced current memory or abstain.

### Phase 9: Consolidation and Memory Tiers

1. Add tiers:
   - active
   - warm
   - cold
   - archived
2. Implement tier movement as accessibility changes, not deletion.
3. Add conservative consolidation jobs:
   - episodes -> patterns
   - patterns -> preferences
   - failures -> procedures
   - conflicts -> reflections
4. Log every consolidation trace.
5. Keep consolidation disabled by default until evals show it reduces noise.

### Phase 10: JS-Only Testing and Evals

1. Use Node test tooling only.
2. Add unit tests for:
   - bitemporal visibility
   - contract filtering
   - contradiction handling
   - edge handlers
   - recall mode behavior
3. Add integration tests against Postgres + pgvector.
4. Add an eval harness for:
   - information extraction
   - multi-session reasoning
   - temporal reasoning
   - knowledge updates
   - abstention
   - contradiction handling
   - long-run degradation
5. CI should run JS build, tests, migrations, and package smoke start.

### Phase 11: Migration From Current Data

1. Write a JS migration from existing schema to durable schema:
   - `primary_sector` -> facet hints
   - `tags` and `meta` -> metadata/facets/contracts
   - `waypoints` -> typed `relates_to` edges
   - `temporal_facts` -> semantic memories with bitemporal fields
2. Do not destructively mutate old databases.
3. Output a migration report with counts, skipped rows, and warnings.

### Phase 12: Documentation and Release Cleanup

1. Rewrite README around one path:
   - `npm install`
   - configure Postgres
   - `npm run start`
   - call remember/recall/explain
2. Remove Python badges, examples, docs, CI, and publish flow.
3. Update Docker image to Node/Postgres-only.
4. Publish `openmemory-js` as the npm package.
5. Add a release smoke test:
   - install package
   - start server
   - hit `/health`
   - remember one memory
   - recall it in strict mode
   - explain it

## Deferred

- VS Code extension rewrite.
- Dashboard rebuild.
- Python SDK compatibility.
- SQLite local mode.
- Deep source connectors.
- Custom graph database.
- Merkle/content-addressed storage.
- Recursive memory worlds.

## First Implementation Milestone

The first useful milestone is not the full architecture. It is:

1. Root `npm run start` works.
2. Python package/docs/workflows are removed from the active product path.
3. Postgres + pgvector migration creates the durable core tables.
4. `POST /v1/memories`, `POST /v1/recall`, and `/health` work.
5. Strict recall respects provenance, contracts, current validity, and audit logging.
