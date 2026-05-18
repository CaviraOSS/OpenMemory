# TODO

## Active

- [ ] Continue product hardening on the durable Postgres `/v1` runtime.

## Next

## Done

- [x] Rename active embedding internals from sector wording to facet wording and delete unused multi-sector embedding helpers.
- [x] Remove legacy `OM_TIER` embedding mode so `OM_EMBEDDINGS` directly controls provider behavior.
- [x] Make package builds clean `dist` before TypeScript emit so deleted source surfaces cannot ship as stale compiled files.
- [x] Delete stale legacy SDK/request type definitions for removed retention, IDE, and LangGraph surfaces.
- [x] Delete unused chunking, keyword, and vector utility leftovers from removed retention/vector paths.
- [x] Remove impossible non-Postgres branches and `OM_METADATA_BACKEND` selection from active `/v1` runtime code.
- [x] Normalize malformed JSON request bodies to `{}` in the HTTP adapter so route validation owns the response.
- [x] Delete legacy HSG, MCP, provider, document-ingest, temporal graph, and old CLI source surfaces from the package source tree.
- [x] Move active embedding code out of `src/retention` into `src/embeddings`.
- [x] Replace the old custom `api/server.js` wrapper with a small TypeScript HTTP adapter.
- [x] Remove SQLite runtime/migration branches and make database access Postgres-only.
- [x] Delete legacy vector store abstractions and Valkey/SQLite vector compatibility code.
- [x] Remove `sqlite3`, `ioredis`, and direct `ws` dependencies from the package.
- [x] Trim dead config/env fields for removed compression, reflection, Valkey, IDE, LangGraph, decay, and summary features.
- [x] Remove `Memory.source()` so the package root no longer exposes deferred connector ingestion.
- [x] Move `opm` add/query/list/delete commands to durable `/v1` routes and stop advertising users/stats/MCP commands.
- [x] Remove deleted MCP/document-ingest dependencies from package manifests and lockfiles.
- [x] Remove `/retention/*`, `/users/*`, `/sectors`, MCP, and HSG background jobs from default server registration.
- [x] Remove non-Postgres `/v1` fallback behavior after Postgres became the only active backend.
