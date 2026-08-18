# OpenMemory Bench

A terminal-first benchmark runner for memory systems. It evaluates real OpenMemory, the hosted Supermemory, Mem0 Platform, and Zep Cloud APIs, and self-hosted Cognee through one provider lifecycle and one evidence-grounded dataset contract.

## Pipeline

```text
load cases -> health -> isolate -> ingest -> index -> search -> retrieval evaluation
														-> answer per cutoff -> AI judge per cutoff
														-> checkpoint -> report
```

Every run writes:

- `checkpoint.json` for phase-level resume
- `report.json` with per-case evidence and timings
- `report.md` for review and publishing
- a terminal scoreboard with quality, latency, token cost, and failures

## Commands

```powershell
pnpm bench
pnpm bench:ci
pnpm bench:data
pnpm bench:compare --providers=openmemory,mem0 --datasets=smoke
pnpm bench:judge
pnpm bench:test
pnpm bench:typecheck
```

`pnpm bench` runs the embedded production OpenMemory engine against the deterministic smoke dataset. No server or API key is required. Smoke is a wiring and regression sanity suite with tiny, near-verbatim cases; its score is not comparative evidence and must not be used as a headline accuracy claim.

`pnpm bench:compare` downloads/uses official LongMemEval and LoCoMo data, evaluates one case per category across configured providers, and requires an answerer plus AI judge. Configure services with `BENCH_<PROVIDER>_URL`, `BENCH_<PROVIDER>_API_KEY`, `BENCH_<PROVIDER>_TIMEOUT_MS`, and optional JSON `BENCH_<PROVIDER>_ROUTES`.

Supermemory is benchmarked through `https://api.supermemory.ai`; local Supermemory is not installed or started. Create a key at <https://console.supermemory.ai> and set either `SUPERMEMORY_API_KEY` or `BENCH_SUPERMEMORY_API_KEY`.

Mem0 is benchmarked through Mem0 Platform at `https://api.mem0.ai`. Set `MEM0_API_KEY` or `BENCH_MEM0_API_KEY`. Zep is benchmarked through its graph API at `https://api.getzep.com/api/v2`; the CLI provider name remains `graphiti` for compatibility. Set `ZEP_API_KEY` or `BENCH_GRAPHITI_API_KEY`.

Large historical corpora use provider-native batching. Mem0 groups ordered messages by session and chunks them to 20 turns so opaque provenance metadata remains below Mem0's 2,000-character metadata ceiling. Zep uses the current `/batches` API, adds up to 350 graph episodes per call, processes one asynchronous batch per corpus, and polls the batch summary before search. Recommended hosted timeouts are 900,000 ms for official corpora.

Hosted evaluation accounts may impose processing throughput below full LoCoMo scale. A provider that cannot finish indexing within the configured official timeout is reported unavailable/partial; its completed subset must not be compared as if it covered the full case set. In particular, unclaimed Mem0 Agent Mode keys should be claimed before large comparative runs (`mem0 init --email <your-email>`) so account capacity and ownership are explicit.

The earlier local services were checked on this development machine and were not runnable: Docker is unavailable, local Graphiti needs Neo4j or FalkorDB, and the Mem0 REST server needs its own vector database and model setup. Local adapters remain available as explicit compatibility profiles with `BENCH_MEM0_PROFILE=oss` and `BENCH_GRAPHITI_PROFILE=local`; they are not the defaults.

## AI Answer And Judge

AI evaluation is optional. Supply both models using `provider:model` specs:

```powershell
pnpm exec tsx benchmarks/src/cli.ts run `
	--providers=openmemory,mem0 `
	--datasets=longmemeval,locomo `
	--cutoffs=1,5,10,20 `
	--answerer=codex:gpt-5.4-mini `
	--judge=codex:gpt-5.6-terra
```

For every question and every cutoff, the runner:

1. slices the provider results to top-K;
2. builds a grounded answer prompt from that context;
3. generates a fresh hypothesis with the answerer model;
4. selects an abstention, temporal, preference, knowledge-update, or general judge rubric;
5. asks a separate judge model for structured `correct`/`incorrect` output;
6. records answer accuracy, answer/judge latency, prompt/context/completion tokens, explanation, and raw verdict.

Supported model providers are:

- `openai`, `anthropic`, `google`, and `openai-compatible` over native HTTP APIs;
- `ollama` over the local `/api/chat` endpoint;
- `codex` through the installed Codex app's non-interactive `codex exec` command;
- `claude-code` through `claude --print --output-format json`.

Configure hosted keys with `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`; see `comparative.env.example` for endpoint, executable, timeout, and retry settings.

Local examples:

```powershell
# Ollama: pull a generative/chat model first
ollama pull qwen3:8b
pnpm exec tsx benchmarks/src/cli.ts run `
	--providers=openmemory --datasets=smoke `
	--answerer=ollama:qwen3:8b --judge=ollama:qwen3:8b --no-resume

# Codex desktop app/CLI authentication, packaged Windows executable auto-detected.
# Name an explicit model because benchmark safe mode ignores user config.
codex update
pnpm exec tsx benchmarks/src/cli.ts run `
	--providers=openmemory --datasets=smoke `
	--answerer=codex:<supported-model> --judge=codex:<supported-model> --no-resume

# Distinct Codex answerer and judge models
pnpm bench:judge:codex
```

Codex runs ephemerally in a temporary empty directory with a read-only sandbox, ignored user configuration and project rules, structured-output schema for judging, and the final response captured from `--output-last-message`. An explicit Codex model is required and older app builds may need `codex update`. Claude Code runs in safe mode with no tools, no session persistence, `dontAsk` permissions, JSON output, and JSON Schema for judging. Both processes are terminated on timeout and never receive write access to this repository.

AI mode performs `questions × cutoffs` answer calls and the same number of judge calls. For the 11-case smoke dataset at four cutoffs, that is 44 answer calls plus 44 judge calls and may consume local compute or paid subscription/API quota.

Deterministic evidence retrieval metrics always run, including in AI mode. Default `pnpm bench:ci` deliberately stays retrieval-only so repository CI never depends on paid model APIs.

## Datasets

- `smoke`: eleven tiny deterministic wiring checks covering extraction, preference, multi-session, temporal reasoning, knowledge update, abstention, single-hop, multi-hop, open-domain, adversarial, and summary retrieval. It is intentionally easy and not a comparative benchmark.
- `longmemeval`: official LongMemEval oracle JSON.
- `locomo`: official LoCoMo JSON.

Download official files explicitly with `pnpm bench:data`. Benchmark execution never downloads data implicitly.

Dataset evidence IDs are evaluator-only. Providers receive plain event text, event time, and neutral dataset/session metadata; they never receive evidence labels through IDs, metadata, custom fields, or text. Retrieval attribution uses opaque source provenance first and documented lexical overlap only as a fallback. The benchmark reports retrieval metrics separately from answer correctness; use official LongMemEval/LoCoMo with an answerer and AI judge for substantive comparisons.

Provider-visible `source_ref` values are opaque SHA-256 provenance references derived from a source turn. They contain no dataset ID, session ID, question ID, answer marker, or relevance label. The evaluator maps them back to source turns only after retrieval, preventing near-duplicate dialogue turns from corrupting provenance metrics without revealing gold evidence.

Official runs are rejected unless both `--answerer` and `--judge` are configured. All providers ingest the same plain conversation turns. OpenMemory preserves raw turns internally for immutable provenance, but benchmark search renders the structured claims stored during production ingestion under a 2,048-token context budget; it does not return raw stored turns directly.

During retrieval engineering, `--retrieval-diagnostic` permits LongMemEval/LoCoMo without AI calls. Reports are labelled `retrieval diagnostic`, cannot be confused with official answer accuracy, and still require a real semantic embedding profile for OpenMemory.

Use `--sample-offset=<n>` for deterministic holdouts. LoCoMo sampling maximizes distinct conversations across task categories, and questions sharing one corpus reuse a single ingestion/indexing pass. Development diagnostics and final Codex validation must use different offsets.

Official OpenMemory runs require a semantic embedding profile. The validated local profile is `OPENMEMORY_EMBEDDING_PROVIDER=ollama`, `OPENMEMORY_EMBEDDING_TIER=deep`, `OPENMEMORY_EMBEDDING_DIMENSION=768`, and `OPENMEMORY_OLLAMA_EMBEDDING_MODEL=embeddinggemma:latest`.

Gemini is also supported with `OPENMEMORY_EMBEDDING_PROVIDER=gemini`, `OPENMEMORY_GEMINI_EMBEDDING_MODEL=gemini-embedding-001`, and `OPENMEMORY_GEMINI_INPUTS_PER_MINUTE=90`. Free-tier Gemini projects may still hit a 1,000-input daily cap on full LoCoMo; such runs remain partial and never fall back silently.

OpenMemory stores exact source text for immutable provenance alongside structured claims and a bounded derived summary. Recall ranks with semantic similarity, corrected BM25 IDF, entity overlap, temporal activation, conversation adjacency, role attribution, and query-conditioned preference/emotion signals. Returned benchmark context is rendered from stored claims, not reparsed or copied raw turns, and every provider is constrained by the same 2,048-token budget.

The validated Codex evaluation pair is `codex:gpt-5.4-mini` for answers and `codex:gpt-5.6-terra` for judging. Model availability is account-specific and must be preflighted through the same JSON-schema transport before a long run.

`pnpm bench:full`, `pnpm bench:ci:full`, and `pnpm bench:compare` require explicit, distinct model specs through `BENCH_OFFICIAL_ANSWERER` and `BENCH_OFFICIAL_JUDGE`. The validated pair is `codex:gpt-5.4-mini` and `codex:gpt-5.6-terra`. Official runs reject using the same provider/model as both answerer and judge. Exact required `I don't know` abstentions are scored deterministically before AI judgment.

## Flags

| Flag                                                      | Meaning                                          |
| --------------------------------------------------------- | ------------------------------------------------ |
| `--providers=openmemory,supermemory,mem0,graphiti,cognee` | Provider set                                     |
| `--datasets=smoke,longmemeval,locomo`                     | Dataset set                                      |
| `--per-category=2`                                        | Maximum official cases per category              |
| `--cutoffs=1,5,10,20`                                     | Retrieval cutoffs                                |
| `--run-id=<id>`                                           | Stable checkpoint identity                       |
| `--out=<directory>`                                       | Artifact directory                               |
| `--answerer=<provider:model>`                             | Generate a fresh answer at each cutoff           |
| `--judge=<provider:model>`                                | Judge each cutoff answer with category rules     |
| `--no-resume`                                             | Replace an existing checkpoint                   |
| `--require-all`                                           | Fail when any provider is unavailable or partial |
| `--gate`                                                  | Apply configured quality gates                   |
| `--no-color`                                              | Disable terminal colors                          |

A resume is accepted only when its secret-free manifest matches datasets, cases, cutoffs, providers, endpoints, routes, runtime environment, answerer, and judge configuration. API keys are never persisted. Completed checkpoints can render reports while providers are offline. Run latency benchmarks without concurrent builds or tests.
