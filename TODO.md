# TODO

## Active

- [ ] Add durable pending consolidation endpoint.

## Next

- [ ] Keep `/retention/*` routes on legacy HSG until parity is proven.

## Done

- [x] Add durable repository with transactional memory + audit writes.
- [x] Add tests for strict/historical/associative durable recall query shape.
- [x] Add durable recall repository over `memories`, `provenance`, `contradictions`, and bitemporal columns.
- [x] Move `/v1/recall` to durable repository when Postgres is configured.
- [x] Add durable explain repository over memories, provenance, contradictions, inferences, audit log, and bitemporal columns.
- [x] Move `/v1/memories/:id/explain` to durable repository when Postgres is configured.
- [x] Fix durable `/v1` executor so SELECT returns rows and transactions use the connection transaction helper.
- [x] Add structured entity, memory-entity link, and edge writes to durable `/v1/memories`.
- [x] Align durable explain inference query with the actual durable `inferences` schema.
- [x] Add opt-in Postgres integration harness for durable `/v1` routes using `OM_TEST_POSTGRES_URL`.
- [x] Add append-only `memory_versions` writes for durable `/v1/memories`.
- [x] Include durable memory version history in `/v1/memories/:id/explain`.
- [x] Add durable soft-delete endpoint `DELETE /v1/memories/:id` with audit and recall exclusion.
- [x] Add durable `/v1` lifecycle endpoints for get, list, update, and reinforce.
- [x] Enforce durable memory contracts in strict `/v1/recall`.
- [x] Add durable explain score components for confidence, salience, provenance, contradiction, and contract state.
- [x] Add durable contradiction resolution endpoint.
- [x] Remove stale SQLite/local-mode TODO gating after adding the Postgres harness.
- [x] Add tests for audit row creation on durable memory writes.
- [x] Move `/v1/memories` to durable repository when Postgres is configured.
- [x] Add `/v1` route contract test.
- [x] Add `/v1/memories`, `/v1/recall`, and `/v1/memories/:id/explain` adapters.
- [x] Verify `/v1` adapter with live server smoke.
- [x] Verify root build/test after `/v1` adapter.
- [x] Add durable schema contract test.
- [x] Add durable migration module for Postgres durable core tables.
- [x] Wire durable schema migration into JS migrate command.
- [x] Verify root build/test after durable migration foundation.
- [x] Add root npm workspace scripts for `dev`, `build`, `start`, `test`, and `migrate`.
- [x] Verify root `npm run build`.
- [x] Verify root `npm run test`.
- [x] Verify root `npm run start` with a `/health` smoke test.
