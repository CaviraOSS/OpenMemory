# TODO

## Active

- [ ] Set `OM_PG_USER` and `OM_PG_PASSWORD` to valid local PostgreSQL credentials, then run `npm run migrate` and `OM_RELEASE_SMOKE_FULL=true npm run release-smoke`.

## Next

- [ ] Port old `insp/openmemory-js` features only where they become durable `/v1` source events, extraction candidates, MCP tools, or audited admin jobs.
- [ ] Stage or review current large rewrite diff before starting deferred dashboard/VS Code/connector work.

## Done

- [x] Smoke-test Siray.ai benchmark judge with `x-ai/grok-4.1-fast-reasoning` using an ephemeral runtime key; OpenMemory benchmark run reached `/v1/memories` but is blocked by local PostgreSQL auth.
- [x] Add benchmark preflight validation so real matrix runs require all selected system credentials/services and cannot be confused with fixture smoke tests.
- [x] Audit MemoryAgentBench memory-layer/API integrations method-by-method and align TypeScript benchmark adapters with the exact per-system treatment.
- [x] Turn benchmark competitor support into a real five-system OpenMemory-vs-alternatives matrix runner, modeled after MemoryAgentBench.
- [x] Add benchmark LLM judge providers for Gemini and Siray.ai, plus MemoryAgentBench-style adapters for Mem0, Cognee, Zep, and Supermemory.
- [x] Add real benchmark dataset acquisition and LLM-based evaluation, using MemoryAgentBench-style source manifests.
- [x] Rebuild `benchmark/` around the MemoryAgentBench core runner, config, conversation, results, metrics, and adapter boundary.
- [x] Complete a real MemoryAgentBench-main full-tree intake before touching benchmark code again.
- [x] Expand `benchmark/` into a MemoryAgentBench-style TypeScript structure with configs, data loading, conversation creation, resumable result storage, and CLI runner.
- [x] Replace registry-only benchmark work with TypeScript benchmark runner scaffolding for LongMemEval, LongMemEval-V2, LoCoMo, and TReMu.
- [x] Expand MDRS into separate decay math, retrieval ranking, reinforcement, supersession, and noise cleanup tests.
- [x] Add MDRS benchmark folder and tests for decay quality, stale leakage, and useful forgetting.
- [x] Add active optional vector DB adapters and stronger embedding model routing while keeping Postgres durable metadata as the default source of truth.
- [x] Revisit `insp/openmemory-js` for non-architecture feature ports and choose the next durable-compatible tranche to implement.
- [x] Port Notion, Google Drive/Sheets/Slides, OneDrive, and bounded web crawler adapters through durable source ingestion.
- [x] Design and implement the next durable feature tranche: MCP, multi-format ingestion, and source ingestion without reviving legacy `/retention`, SQLite, HSG, or old connector routes.
- [x] Add explicit `opm mcp` stdio adapter over durable `/v1` tool calls.
- [x] Add `/v1/ingest/document` for text/markdown/HTML/URL/base64 ingestion into durable events and extraction candidates.
- [x] Add `/v1/sources/:source/ingest` with built-in web and GitHub source adapters.
- [x] Re-audit `insp/openmemory-js` for durable-compatible old features and port only code that fits the new architecture.
- [x] Add temporal graph query behavior only after durable graph/bitemporal tests are in place.
- [x] Reintroduce document/media extraction only as optional adapters that create durable extraction candidates.
- [x] Rebuild source connector framework only after durable ingestion source contract is stable.
- [x] Port durable-safe decay as an explicit audited admin job, without background timers.
- [x] Write MCP rebuild design against durable `/v1` before adding MCP code back.
- [x] Port webhook HMAC verification into the active durable source-ingestion boundary when source events are ready.
- [x] Add embedding provider config tests for invalid model names, fallback chains, request timeout, and current Gemini model naming.
- [x] Add multilingual regression coverage for Cyrillic repeated memories and Chinese dedup/recall token overlap.
- [x] Convert every issue/PR audit item into add/defer/reject rewrite intake in `docs/github-rewrite-intake.md`.
- [x] Fetch every public GitHub issue/PR page visible in open and closed history and write the full item-level audit to `docs/github-issues-prs-full-audit.md` plus JSON.
- [x] Complete forensic audit of `insp/openmemory-js` and write file-by-file findings to `docs/insp-openmemory-js-forensic-audit.md`.
- [x] Audit public GitHub issue/PR listings and write rewrite signals to `docs/github-issues-prs-audit.md`.
- [x] Inventory `insp/openmemory-js` and choose durable-safe features to port.
- [x] Port language detection metadata, simhash fingerprinting, and keyword lexical scoring into durable-safe utilities.
- [x] Enrich durable memory/candidate metadata with `language`, `language_script`, `language_confidence`, `simhash`, and `token_count`.
- [x] Blend bounded lexical overlap into durable recall scoring.
- [x] Verify local PostgreSQL is running and document that full durable DB smoke is blocked by invalid `postgres/postgres` credentials.
- [x] Fix shared `.env` loading for root and workspace npm scripts, including inline comment stripping.
- [x] Run final architecture parity verification and review diff/status.
- [x] Implement deterministic durable ingestion candidate creation from `/v1/ingest`.
- [x] Add executable durable edge handlers for supersedes, contradicts, derives_from, and same_as.
- [x] Add durable memory tier movement without deletion.
- [x] Add non-destructive legacy migration report generation.
- [x] Reintroduce focused JS tests for architecture parity and route registration.
- [x] Add package release smoke command with health smoke and optional full durable DB smoke.
- [x] Reviewed current source/runtime alignment against `docs/architecture-rewrite-plan.md`.
- [x] Remove stale `OM_TIER` and `OM_EMBED_MODE` settings from Docker compose.
- [x] Align memory docs with provider-source deletion and active dependency scope.
- [x] Remove stale `OM_PG_TABLE`, unused `openai` package dependency, noisy embedding/telemetry logs, and make the auth cleanup timer non-blocking.
- [x] Verify clean build, focused JS tests, npm pack contents, SDK import safety, and release-smoke health.
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
