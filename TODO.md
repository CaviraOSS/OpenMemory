# TODO

## Active

## Next

- [ ] Keep `/retention/*` routes on legacy HSG until parity is proven.
- [ ] Keep SQLite/local mode on legacy HSG compatibility until Postgres test harness exists.

## Done

- [x] Build durable recall repository and move `/v1/recall` off legacy HSG for Postgres.
- [x] Add tests for strict/historical/associative durable recall query shape.
- [x] Add durable recall repository over `memories`, `provenance`, `contradictions`, and bitemporal columns.
- [x] Move `/v1/recall` to durable repository when Postgres is configured.
- [x] Add durable repository with transactional memory + audit writes.
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
