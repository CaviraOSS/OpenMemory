<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/decisions.md
 usage : documents LongMemory decisions
-->

# Decisions

## 1.0 release surface

- Remove active unit/integration test suites and Vitest from the release tree;
  reject future test artifacts in `tools/check-release-files.mjs`.
- Preserve deterministic validation through typechecks, official n8n/Claude
  checks, manifest parsing, benchmark smoke gates, dashboard audit/build, clean
  npm tarball inspection, and live API/MCP health checks.
- Ship a root non-root Docker image and platform manifests for Compose, Heroku,
  Railway, Render, DigitalOcean, and Vercel dashboard hosting. Stateful API
  platforms must persist `/data` and accept `PORT` when assigned by the host.
- Publish `longmemory@1.0.0` under Apache-2.0 with npm provenance; publish the
  n8n package under validator-required MIT and the VS Code extension with its
  Apache license included.

## LongMemory product rename

- Rename product text, package/bin identifiers, environment prefixes, command
  namespaces, routes, integration IDs, filenames, and active directories from
  the former name to LongMemory without preserving compatibility aliases.
- Enforce the rename and language-aware Cavira headers with
  `pnpm branding:check`; keep the migration idempotent in `tools/branding.mjs`.
- Do not inject comments into strict JSON, binary/generated metadata, binary
  assets, or n8n's byte-exact ESLint config. Preserve historical `tmp/` archives
  unchanged so benchmark and implementation comparisons remain reproducible.

## VS Code AI change capture

- Use user-declared explicit sessions as the authoritative attribution path.
- Keep installed-extension heuristics opt-in, low-confidence, and review-only.
- Snapshot eligible workspace text only in memory during an explicit session;
  persist only a bounded redacted patch and structured provenance.
- Capture editor-buffer and direct file-system writes through one session model.

## Agent asset parity

- Model reusable Skills as immutable project nodes with superseding versions,
  trigger matching, validation/resources, and agent bindings.
- Derive callers, callees, and impact paths from connector symbol snapshots;
  do not introduce a separate code-index service.
- Import provider-neutral past sessions as validated raw turns in the project
  `agent_sessions` world with original order, timestamps, and provenance.

## Governed four-asset catalog

- Register Chat Memory, Skill, LLM-Wiki, and CodeGraph in one immutable project
  catalog; keep asset governance out of ordinary recall evidence.
- Auto-created conversation/document/code assets begin `candidate`; explicitly
  authored Skills begin `approved`.
- Resolve loadouts by authenticated user/team/role/agent/task/framework identity
  with deny-first ACLs, target bindings, injection modes, expiry, and budgets.
- Use MCP resources/tools for model context discovery and an optional A2A 1.0
  Agent Card for capability discovery; do not claim a full A2A task server.

## CLI session porter

- Keep the provider-neutral hub-and-spoke import engine, but do not mirror another
  product's screen sequence, labels, visual identity, or interaction choreography.
- Detect and read Claude Code, Codex, and OpenCode stores without mutating them;
  do not cross-write proprietary harness formats.
- Use immutable asset revisions as the single idempotency authority: create,
  skip unchanged, update changed/grown sessions, and isolate per-session errors.
- Preserve one-document JSON automation; make progress streaming explicit with
  `--jsonl`; present interactive import as an original three-phase desktop utility:
  Library, Review, and Transfer.
- Translate the split memory-grid brand mark into a compact terminal glyph; keep
  traffic-light chrome, factual workflow metadata, stable timestamps, and concise
  receipts. Do not use an oversized ASCII wordmark above the utility.
- Resolve terminal homes and VS Code-compatible editor storage on Windows,
  macOS, and Linux; every source also has an explicit environment override.
- Support Gemini CLI, Copilot Chat, Cline, and raw DeepSeek Harness records in
  addition to Claude Code, Codex, and OpenCode. Detect but reject DeepSeek's
  concatenated Zstandard frames until a complete frame walker is implemented.
- Materialize selected conversations as deterministic Markdown `llm_wiki`
  assets; revision hashes drive create/skip/update and optional direct binding.

## LongMemory benchmark scorecard

- Keep the public benchmark target LongMemory-only and make K=5 the headline
  cutoff for one stable product scorecard.
- Publish LongMemEval/LoCoMo only from complete judged runs. Derive retrieval,
  direct-fact, update, event-order, abstention, and anti-stale contradiction
  metrics from explicit dataset categories and evidence annotations.
- Report BEAM and historical-fact accuracy as N/A until their dedicated public
  datasets are implemented; never substitute smoke or synthetic scores.
- Calculate dollar costs only from an explicit embedding input price. Every
  scorecard field carries value, unit, numerator, denominator, or an N/A reason.
- Do not restore the pre-phase1 HSG as the production retriever. On the same
  33-question sample, Ollama model, K=5 answerer, and judge, it scored 36.4%
  overall versus 66.7% current, with Hit@5 60.0% versus 73.3%, context recall
  38.1% versus 60.9%, and p95 retrieval 1,746 ms versus 774 ms.
- Preserve two archive lessons as targeted experiments: return lossless source
  text alongside derived claims, and add contrast/exception-oriented retrieval
  for questions such as whether all instances succeeded. Do not restore
  query-time mutation, wall-clock decay ranking, or unbatched sector embeddings.
- Replace dense additive graph scoring incrementally: query-calibrate a feature
  matrix, remove covariance before fusion, use entity identity as a gate, seed
  typed relation matrices sparsely, and optimize the final evidence set for
  aspect coverage, redundancy, polarity, and token cost. Keep this work behind
  retrieval A/B gates until it beats the current complete scorecard.
- The matrix path is now targeted to universal/exception queries after global
  application reduced recall. Deterministic A/B improved context recall from
  60.9% to 62.6% and precision from 49.6% to 50.4% with no case regression;
  Dave's restoration counterexample moved from absent to top five. Keep the
  legacy path available through `OM_MATRIX_RETRIEVAL=0`.
- Do not tune retrieval against a single Copilot CLI judged run. Repeated runs
  with identical evidence materially changed LongMemEval and update verdicts;
  require repeats or a deterministic evaluation endpoint for release claims.

## Installed CLI and extension shell

- Canonicalize CLI module and argv paths before main detection so npm junctions
  and symlinked development installs execute instead of silently returning.
- Route bare interactive `longmemory` to the five-step TUI; retain bare non-TTY
  status JSON and explicit `status` for automation.
- Activate the CaviraOSS extension at startup and keep an always-visible
  right-side Memory manager; show recording/review activity separately.
- Remove the obsolete Nullure extension because duplicate `longmemory.quickNote`
  commands and shared settings prevent deterministic activation.

## External plugins

- Ship a native `n8n-nodes-*` community package for n8n, built by the official
  `n8n-node` CLI and using n8n's credential store. Make it usable as an AI tool.
- Ship OpenClaw integration as a portable Agent Plugins 1.0 bundle containing
  strict `plugin.json`, `mcp.json`, and an LongMemory Skill. Prefer the bundle's
  narrower trust boundary over arbitrary in-process plugin code.
- Use native MCP client surfaces for Dify, Flowise, LangGraph, CrewAI, AutoGen,
  and other compatible hosts. Do not invent a run-assimilation protocol or
  duplicate LongMemory storage inside each host.
- Keep framework examples thin and runnable: use each framework's MCP lifecycle,
  launch `longmemory mcp --project current` over stdio for local use, resolve the
  Windows npm shim explicitly, and keep model credentials outside artifacts.
