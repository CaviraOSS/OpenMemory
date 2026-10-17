<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ----------------------------------------------------------
 file  : CHANGELOG.md
 usage : records the complete OpenMemory-to-LongMemory project history
-->

# Changelog

All notable changes to LongMemory are documented here. The current project
follows Semantic Versioning. The archived pre-rewrite releases are retained at
the end of this file for historical context.

## [Unreleased]

### Documentation

- Added an opt-in Claude Code workflow pairing Parallel Search MCP with LongMemory
  for web research, approved source-attributed observations, and later recall.

### Python SDK and package registry migration

- Added `packages/longmemory-py`, a zero-runtime-dependency Python HTTP client
  for the self-hosted LongMemory service.
- Added synchronous `LongMemory` and asynchronous `AsyncLongMemory` clients.
- Added typed convenience methods for health, ingest, recall, explain, worlds,
  entities, timeline, statistics, runtime information, and arbitrary API calls.
- Added structured `LongMemoryError` and `LongMemoryConnectionError` failures
  that preserve API status, error code, and response metadata.
- Kept the Hydrograph engine in TypeScript. The Python package is intentionally
  a transport client and does not duplicate persistence, retrieval, temporal,
  lifecycle, or governance logic.
- Selected the PyPI distribution name `longmemory-sdk` because the unrelated
  `longmemory` project name is already registered by another organization. The
  Python import remains `from longmemory import LongMemory`.
- Added a deprecated `openmemory-py` compatibility distribution that depends on
  `longmemory-sdk` and forwards the former Python import namespace.
- Added a deprecated `openmemory-js` npm bridge that depends on and re-exports
  `longmemory`, while forwarding the former `opm` command to the new CLI.
- Added migration documentation for npm and PyPI users moving from the former
  package names.
- Expanded package publication automation for npm, PyPI, n8n, VS Code, and
  compatibility bridge releases.

### Registry status

- Reserved `longmemory` as the primary npm package name.
- Preserved the existing `openmemory-js` npm channel as a migration bridge for
  users of the former JavaScript package.
- Preserved the existing `openmemory-py` PyPI channel as a migration bridge for
  users of the former Python package.
- Did not claim the unrelated `longmemory` PyPI project. New Python installs use
  `longmemory-sdk`.

### Fixes

- Embedded project-scoped writes. `longmemory_ingest` with a `project_id`,
  `longmemory_remember_decision` and connector imports go through
  `applyImportPlan`, which stored every node without a semantic vector, so
  those memories never received a vector score in recall (#216).

## [1.0.0] - 2026-08-31

LongMemory 1.0 is a ground-up architecture rewrite rather than an incremental
rename of the archived OpenMemory implementation. It consolidates the product
around one immutable TypeScript Hydrograph engine shared by every supported
surface.

### Product rename and release identity

- Renamed the product from OpenMemory to LongMemory.
- Renamed the npm package and executable to `longmemory`.
- Renamed public environment variables to the `LONGMEMORY_*` namespace.
- Renamed workspace state from `.openmemory/` to `.longmemory/`.
- Renamed dashboard routes, VS Code command IDs, MCP names, plugin IDs,
  integration folders, package metadata, assets, and documentation.
- Moved the canonical repository to
  `https://github.com/CaviraOSS/LongMemory`.
- Added an idempotent branding and file-header migration/checking tool.
- Added canonical CaviraOSS file headers to every comment-capable active file,
  with explicit exceptions for strict JSON, binary assets, generated metadata,
  license texts, and host-owned byte-exact files.
- Licensed the repository and primary packages under Apache License 2.0.
- Retained MIT only for the separately published n8n community package because
  n8n's strict validator requires it.

### Architecture: pre-phase HSG to immutable Hydrograph

#### Before the rewrite

The archived pre-phase implementation contained separate Python and JavaScript
SDKs, HSG memory sectors, direct framework adapters, multiple storage backends,
and a permissive five-tool MCP server. Important behavior was spread across
package-specific implementations and asynchronous wrappers.

Observed pre-phase limitations included:

- Separate Python and Node engine paths with behavior drift.
- Query-time cache and lifecycle mutation.
- Wall-clock-sensitive ranking and decay behavior.
- Unbatched or per-document embedding requests in several paths.
- Direct framework adapters with incomplete asynchronous lifecycle handling.
- Model-supplied user identifiers in MCP calls instead of server-bound identity.
- Destructive MCP operations without the current deny-by-default allowlist.
- Incomplete session isolation in conversational integrations.
- Retrieval that could return derived claims without the original source text.
- Dense additive graph scoring that diluted strong lexical, vector, or entity
  evidence when applied universally.

#### After the rewrite

- Replaced the HSG implementation with one immutable Hydrograph substrate.
- Made memory content, vectors, content hashes, provenance, valid-time history,
  and identity immutable after ingest.
- Separated mutable activation and lifecycle envelopes from source truth.
- Made library, CLI, HTTP, MCP, benchmark, dashboard, and editor surfaces call
  the same engine instead of maintaining parallel implementations.
- Standardized all durable storage around an in-memory store or SQLite.
- Separated recorded time from valid time throughout ingest, recall, history,
  supersession, and conflict handling.
- Added executable typed edges, world hierarchy, entities, grounding,
  contracts, conflict reporting, and explainable ingest/recall traces.
- Bound tenant, user, project, team, role, agent, task, and framework identity at
  trusted runtime boundaries rather than accepting model impersonation.
- Kept recall finite, read-only, permission-aware, and token bounded.

### Rewrite phase history

The new system was developed in explicit capability phases. Each phase extended
the same shared substrate instead of creating a new parallel engine.

#### Foundation and temporal substrate

- **Phase 1 - package foundation:** established the TypeScript package, public
  entry points, shared engine rule, CLI/server shells, and invariant documents.
- **Phase 2 - memory substrate:** added immutable nodes, content identity,
  facets, state envelopes, provenance, working memory, and core stores.
- **Phase 3 - temporal model:** added recorded time, observed time, valid-time
  intervals, point-in-time filtering, supersession, and timeline reconstruction.
- **Phase 4 - executable edges:** introduced typed edge handlers for support,
  contradiction, containment, derivation, grounding, equivalence, supersession,
  and semantic shift.
- **Phase 5 - entities:** added conservative entity resolution, aliases,
  candidate indexing, merge/create decisions, and temporal entity identity.
- **Phase 6 - worlds:** introduced endocortex/exocortex worlds, parent-child
  hierarchy, zones, containment, and scoped retrieval.
- **Phase 7 - grounding:** added source-backed facts, reliability, freshness,
  grounding thresholds, and world-grounded evidence gates.
- **Phase 8 - contracts:** added memory contracts, required/forbidden evidence,
  contradiction policy, confidence rules, and validation boundaries.
- **Phase 9 - mathematical primitives:** added activation, salience, decay,
  Hopfield/Oja-style updates, sketches, similarity, and scoring formulas.

#### Recall and memory evolution

- **Phase 10 - strict recall:** combined temporal validity, confidence,
  contracts, contradictions, grounding, entities, and bounded ranking.
- **Phase 11 - historical recall:** preserved superseded facts and enabled
  point-in-time reconstruction without mutating current truth.
- **Phase 12 - world-grounded recall:** required current external evidence for
  answers that depend on live world state.
- **Phase 13 - associative recall:** added BM25, semantic vectors, entities,
  activation, graph spread, session signals, diversity, and context assembly.
- **Phase 14 - reconsolidation:** added explicit, immutable memory revision and
  supersession rather than in-place content rewriting.
- **Phase 15 - consolidation:** added bounded combination of related memories,
  provenance preservation, and opt-in maintenance.
- **Phase 16 - compression:** added deterministic summaries and layered context
  compression while preserving lossless source text.
- **Phase 17 - ingest pipeline:** implemented the production staged ingest path,
  extraction, identity, graph updates, entities, temporal state, and traces.

#### Persistence and public surfaces

- **Phase 18 - SQLite:** added durable nodes, edges, worlds, entities, grounded
  facts, sketches, lifecycle state, migrations, integrity, and atomic updates.
- **Phase 19 - public API:** stabilized `createMemory`, ingest, recall, explain,
  world/entity access, timeline, stats, decay, reinforcement, and shutdown.
- **Phase 20 - HTTP server:** added dependency-light authenticated API routes,
  response envelopes, validation, rate limiting, concurrency limits, CORS,
  telemetry, health, and `Server-Timing`.
- **Phase 21 - CLI:** added stable JSON automation, interactive TUI behavior,
  project scoping, ingest/recall/maintenance commands, and server management.
- **Phase 22 - legacy migration:** added SQLite/JSON/JSONL import, duplicate and
  corruption handling, relation restoration, integrity checks, and reports.

#### Intelligence, projects, and interoperability

- **Phase 23 - connector intelligence:** added normalized source documents,
  permissions, provenance, cursors, rate limits, and import plans.
- **Phase 24 - connector catalog:** added GitHub, local files, Markdown, web,
  feeds, cloud documents, and extensible transport/mapper registries.
- **Phase 25 - project memory:** added tenant/organization/project worlds,
  architecture, decisions, tasks, conventions, failures, handoffs, and code
  impact tied to persisted source snapshots.
- **Phase 26 - multilingual memory:** added script/language detection,
  code-switch handling, multilingual tokenization, transliteration,
  cross-script aliases, and optional provenance-marked translation.
- **Phase 27 - MCP:** added stdio and authenticated Streamable HTTP transports,
  13 governed tools, readable resources, prompts, audit logging, read-only mode,
  and a deny-by-default tool allowlist.
- **Phase 28 - recovered features:** selectively restored useful archived
  behavior without restoring query-time mutation or duplicate engines.
- **Phase 29 - environment embeddings:** added OpenAI-compatible, Gemini, AWS
  Bedrock, Ollama, Siray, local HTTP, and deterministic fallback stacks with
  dimensions, tiers, retries, timeouts, and batched embedding support.
- **Phase 30 - performance hardening:** added bounded ingest/recall checks,
  cached immutable preparation, entity indexes, and large-world regression gates.
- **Phase 31 - retrieval quality:** added lossless evidence text, targeted
  matrix retrieval, calibrated feature fusion, aspect-aware evidence selection,
  polarity/exception coverage, and deterministic retrieval diagnostics.

### Retrieval redesign and measured outcomes

- Split speaker identity from ordinary body terms so common participant names no
  longer dominated BM25 ranking.
- Unified query and document token analysis to remove asymmetric stemming and
  tokenization behavior.
- Added lightweight stemming and lexical length calibration.
- Disabled RM3 expansion by default after controlled runs showed query drift and
  lower evidence quality when the initial top results were wrong.
- Added a bounded lexical coverage/phrase reranker for shortlist refinement.
- Replaced quadratic repeated MMR similarity scans with incremental cached
  maximum-similarity tracking.
- Added lossless evidence reconstruction so answers receive original source text
  alongside derived facets and claims.
- Added matrix-assisted retrieval for universal, contrast, and exception-style
  questions. Kept it targeted after global application reduced recall.
- Preserved the legacy linear calibrated signal blend after RRF experiments
  degraded Hit@K and MRR by discarding useful score magnitude.
- Reduced recall hot-path CPU by adding ASCII script fast paths, eliminating
  repeated script detection, hoisting tokenizer expressions, avoiding token
  object materialization, and caching node token counts.
- In measured LoCoMo profiling, recall compute at `k=20` fell from roughly
  147 ms to roughly 89 ms, and ingest CPU fell from 14-46 ms per node to about
  10 ms per node without changing retrieval outputs in the controlled check.
- The complete official comparison made LongMemory the only evaluated provider
  to complete all selected LongMemEval and LoCoMo cases in that run; competitor
  failures and incomplete denominators remained explicit rather than being
  rendered as zero scores.

### Deterministic memory lifecycle

- Replaced destructive/archive-style decay with deterministic envelope-only
  decay.
- Added hot, warm, and cold base rates adjusted by salience, confidence,
  grounding, retention, procedural/emotional value, contradiction, source
  support, and reinforcement.
- Made associative recall project decay without persisting it.
- Added explicit cursor-bounded `runDecay()` maintenance for persistence.
- Added monotonic, diminishing explicit reinforcement.
- Guaranteed that decay and reinforcement never rewrite content, summaries,
  vectors, provenance, IDs, hashes, or temporal truth.
- Added SQLite atomicity and audit records for persisted maintenance.

### Governed project and agent memory

- Added project world hierarchies and project-isolated connector sync, recall,
  timelines, decisions, tasks, failures, and context handoffs.
- Added immutable reusable Skills with versions, triggers, instructions,
  validation, resources, archives, and agent bindings.
- Added snapshot-derived CodeGraph symbol search, callers, callees, and reverse
  impact paths.
- Added provider-neutral past-agent session import with original role, order,
  timestamp, tool-call, provider, and source provenance.
- Added governed Chat Memory, Skill, LLM-Wiki, and CodeGraph assets.
- Added candidate/approved/deprecated/archived/failed lifecycle states.
- Added private/project/team/restricted/agent/task visibility and deny-first
  ACLs for user, team, role, agent, task, and framework identities.
- Added deterministic token-budgeted loadouts with direct, summary, tool, and
  reference injection modes.
- Added portable manifests with MCP discovery URIs and optional A2A-compatible
  Agent Card metadata without claiming a complete A2A task server.

### Session porter and AI Wiki

- Added read-only discovery and import adapters for Claude Code, Codex,
  OpenCode, Gemini CLI, VS Code Copilot Chat, Cline, and raw DeepSeek Harness
  records.
- Added portable session IR, preview, select, port, verify, and interactive TUI
  workflows.
- Made import idempotency depend on source harness plus native session ID and an
  immutable revision hash.
- Made changed sessions create new immutable revisions; unchanged sessions skip.
- Isolated per-session failures and included them in structured summaries.
- Added explicit `--jsonl` progress while preserving one-document JSON for
  ordinary automation.
- Added deterministic conversation-to-Markdown LLM-Wiki conversion with source
  provenance and optional agent binding.
- Explicitly rejected unsupported compressed DeepSeek records rather than
  silently parsing partial concatenated Zstandard frames.

### CLI and developer experience

- Added a native terminal application with Library, Review, and Transfer views.
- Added `init`, `status`, `memory list`, `ingest --stdin`, recall, explain,
  timeline, worlds, entities, migration, maintenance, project, Skill, asset,
  CodeGraph, agent, session, connector, and benchmark commands.
- Added stable non-interactive JSON and optional JSONL progress.
- Added workspace-aware `.longmemory/project.db` defaults and global overrides
  for database, project, user, and working directory.
- Canonicalized executable and module paths so linked npm shims work on Windows,
  macOS, and Linux.
- Kept prompting exclusive to explicitly interactive workflows.

### HTTP API and operational controls

- Added `/health`, `/v1/ingest`, `/v1/recall`, `/v1/explain/:id`,
  `/v1/worlds`, `/v1/worlds/:id`, `/v1/entities/:id`, `/v1/timeline`,
  `/v1/stats`, and `/v1/runtime`.
- Added consistent `{data, meta}` success envelopes and structured errors.
- Added optional bearer or `X-API-Key` authentication.
- Added maximum payload, active request, fixed-window rate limit, CORS, auth
  logging, runtime telemetry, and graceful close controls.
- Added platform-assigned `PORT` support while preserving local port `7331`.
- Added server-side-only dashboard credentials and removed client-bundled API
  secrets.

### MCP and integrations

- Added local stdio and authenticated Streamable HTTP MCP transports.
- Added 13 high-level tools for context, recall, ingest, decisions, tasks,
  explanation, conflicts, connectors, Skills, CodeGraph, and governed assets.
- Added project resources, prompts, tool filtering, read-only mode, and JSONL
  audit logs.
- Removed the experimental assimilation protocol and all duplicate integration
  engine wrappers.
- Added a strict n8n community node with Recall, Store, Explain, and Stats
  operations and `usableAsTool` support.
- Added an Agent Plugins 1.0 bundle for OpenClaw and compatible hosts.
- Added native Claude Code, Codex/ChatGPT desktop, and Gemini CLI packages.
- Added Cline, Continue, and LibreChat MCP configuration packs.
- Added runnable native-MCP examples for CrewAI, AutoGen, LangGraph/LangChain,
  OpenAI Agents SDK, and PydanticAI.
- Documented native MCP attachment for Dify, Flowise, and other compatible hosts.

### Dashboard and VS Code

- Added a production Next.js dashboard for health, memory browsing, ingest,
  project selection, activity, search, timelines, decay, settings, and chat.
- Added a same-origin server proxy so API credentials stay server-side.
- Removed dashboard controls that attempted to mutate immutable memory content.
- Added a native VS Code activity view, status indicators, quick note and
  selection ingest, recall, project context, explanation, reinforcement, decay,
  and session import.
- Added explicit AI-change sessions that capture bounded, redacted patches from
  editor buffers and direct workspace writes.
- Kept extension-detection heuristics opt-in, low confidence, review-only, and
  never automatically persisted.
- Added process tracking and Windows process-tree shutdown for CLI subprocesses.
- Packaged the extension as `longmemory-vscode` with its Apache license.

### Connectors and documents

- Added a unified connector contract with inspection, preview, dry-run,
  permissions, provenance, source versions, cursors, rate limits, updates, and
  deletions.
- Added repository and local filesystem intelligence, GitHub transport, Markdown,
  websites, feeds, cloud services, communication tools, project systems, and
  data connectors.
- Added extraction for PDF, DOCX, HTML, Markdown, plain text, source code, audio
  transcripts, and video-derived audio.
- Added atomic import plans instead of allowing connectors to write arbitrary
  memory chunks directly.

### Embedding providers

- Added OpenAI and OpenAI-compatible endpoints.
- Added Gemini Embedding 001 with required truncation renormalization.
- Added AWS Bedrock Titan, Ollama, Siray, local HTTP, OpenRouter-compatible, and
  DashScope-compatible configurations.
- Added environment-driven fast, smart, deep, and hybrid tiers.
- Added timeout, retry, dimension, model, batch size, and ordered fallback
  controls.
- Added batched Gemini embedding requests and provider-specific benchmark batch
  sizes.
- Made official semantic benchmark runs fail closed when a fallback provider was
  actually used.

### Benchmark and release engineering

- Replaced the archived benchmark scripts with a manifest-driven TypeScript
  runner and deterministic checkpoint/resume model.
- Added LongMemEval, LoCoMo, BEAM-1M, BEAM-10M, and deterministic smoke datasets.
- Added answer-at-every-cutoff evaluation with distinct answerer and judge roles.
- Added evidence Hit@K, recall, rank-weighted precision, MRR, nDCG, answer
  accuracy, temporal categories, abstention, stale-evidence, latency, context,
  and optional cost metrics.
- Added explicit incomplete-run accounting and `N/A` values instead of silently
  converting missing evidence or judgments to zero.
- Added comparative adapters for Mem0, Zep/Graphiti, Cognee, and Supermemory.
- Added a stable public K=5 scorecard and benchmark release gates.
- Added clean npm package builds that remove stale `dist` files before emission.
- Added package-content inspection to prevent test, legacy, or removed artifacts
  from reaching npm.
- Added Docker, Compose, Heroku, Railway, Render, DigitalOcean, and Vercel
  dashboard deployment files.
- Added npm, n8n, VS Code, container, and trusted-publisher workflow definitions.
- Added dependency auditing and a zero-vulnerability dashboard release lockfile.
- Added release validation without shipping active test suites or Vitest.

### Breaking changes from pre-phase OpenMemory

- The product and repository are now LongMemory.
- The primary JavaScript package changed from `openmemory-js` to `longmemory`.
- The primary CLI changed from `opm`/`openmemory-js` to `longmemory`.
- Environment variables changed from `OM_*`/`OPENMEMORY_*` to
  `LONGMEMORY_*`, with only selected internal configuration aliases retained.
- The default network port changed from `8080` to `7331`.
- The default workspace database moved to `.longmemory/project.db`.
- The former embedded Python engine was removed. Python now accesses the single
  TypeScript engine through the self-hosted HTTP API.
- Postgres, Valkey, Qdrant, and separate Python-engine storage claims from the
  archived line are not part of the LongMemory 1.0 public contract.
- Direct LangChain/CrewAI/AutoGen memory wrappers were replaced by official MCP
  client surfaces and thin examples.
- The former permissive MCP query/store/get/delete/list interface was replaced
  by governed high-level tools with server-bound identity and audit policy.
- Destructive delete and model-selected identity are not exposed through the new
  MCP surface.
- Query-time mutation, implicit wall-clock decay, and hidden maintenance timers
  were removed.
- Compatibility is delivered through temporary registry bridge packages, not by
  preserving old runtime namespaces throughout the engine.

### Migration guidance

JavaScript:

```bash
npm uninstall openmemory-js
npm install longmemory
```

Python:

```bash
pip uninstall openmemory-py
pip install longmemory-sdk
```

Data:

```bash
longmemory migrate \
  --from ./legacy.db \
  --to ./longmemory.db \
  --report ./migration-report.json
```

See [`MIGRATION.md`](MIGRATION.md) and [`docs/migration.md`](docs/migration.md)
for package, database, and session migration details.

## Archived pre-phase lineage

The following entries describe the archived OpenMemory implementation and are
not statements about the LongMemory 1.0 public contract.

## [OpenMemory 1.3.0] - 2025-12-20

### Added

- Simplified the archived Python SDK to a zero-configuration `Memory()` API.
- Reworked the archived benchmark suite in TypeScript with LongMemEval and
  multi-backend comparison.
- Added `Memory.wipe()` and database reset support for benchmark isolation.
- Added embedding model, vector dimension, database path, and provider
  environment overrides.
- Added additional Postgres vector-store operation logging.

### Fixed

- Corrected Ollama model override and embedding dimension handling.
- Corrected deep-tier semantic embedding configuration.
- Reduced benchmark cross-user contamination through reset handling.
- Corrected benchmark environment loading and dataset path resolution.

### Changed

- Replaced the former `OpenMemory` Python class entry point with `Memory`.
- Moved the benchmark implementation from Python to TypeScript.
- Expanded archived Python and JavaScript SDK documentation.

## [OpenMemory 1.2.2] - 2024-11

- Fixed consolidation edge cases.
- Improved multi-user query isolation.
- Corrected vector dimension handling.

## [OpenMemory 1.2.1] - 2024-11

- Improved large-dataset performance.
- Improved archived sector classification behavior.

## [OpenMemory 1.2.0] - 2024-10

- Added the original multi-sector memory architecture.
- Added the original cognitive decay system.
- Added reflection and consolidation.

## [OpenMemory 1.1.0] - 2024-09

- Added the initial TypeScript SDK.
- Added SQLite vector storage.
- Added basic query and add operations.

## [OpenMemory 1.0.0] - 2024-08

- Published the original Python SDK.
- Established the initial local-first architecture.
- Added basic memory operations.

[Unreleased]: https://github.com/CaviraOSS/LongMemory/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/CaviraOSS/LongMemory/releases/tag/v1.0.0
