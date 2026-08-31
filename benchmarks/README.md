<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : benchmarks/README.md
 usage : supports LongMemory benchmark readme
-->

# LongMemory Bench

An LongMemory-only, evidence-grounded benchmark runner. The primary artifact is
a product scorecard covering memory quality, retrieval, temporal behavior,
reliability, latency, context size, and explicitly configured embedding costs.

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
pnpm bench:quality
pnpm bench:judge
pnpm bench:typecheck
```

`pnpm bench` runs the embedded production LongMemory engine against the deterministic smoke dataset. No server or API key is required. Smoke is a wiring and regression sanity suite with tiny, near-verbatim cases; its score is not comparative evidence and must not be used as a headline accuracy claim.

`pnpm bench:quality` loads `benchmarks/comparative.env`, then runs LongMemory
against official LongMemEval and LoCoMo,
uses K=5 for the headline scorecard, and requires an answerer plus a distinct AI
judge. `bench:compare` is retained as a compatibility alias for this command;
external-provider comparison is no longer part of the public benchmark path.

The scorecard reports `N/A` rather than zero when a metric has no valid dataset,
an official dataset run is incomplete, or cost pricing was not configured.
`report.json` includes numerator, denominator, unit, and reason for every field.

### Scorecard mapping

- LongMemEval and LoCoMo: judged Answer@5, only for complete dataset runs.
- Context recall/precision: macro evidence retrieval at K=5.
- Evidence completeness: questions retrieving every required evidence item at K=5.
- Current fact: direct `information-extraction` and `single-hop` questions.
- Update accuracy: `knowledge-update`; event order: `temporal-reasoning`.
- Abstention: `abstention` and `adversarial` questions.
- Contradiction resolution: correct latest answer with no forbidden stale evidence.
- Historical facts: `N/A` until a dedicated historical-fact dataset is added.
- BEAM-1M/10M: judged Answer@5 when the BEAM buckets are downloaded via
  `pnpm bench:data` and selected with `--datasets=beam-1m` or `beam-10m`;
  `--per-category` selects conversations per bucket (20 questions each).
  BEAM questions carry no turn-level evidence, so retrieval metrics exclude
  them and quality is judged from retrieved context only.
- Dollar costs: list-price estimates calculated only when
  `BENCH_EMBEDDING_INPUT_COST_PER_MILLION_USD` is set. Gemini Embedding 001 is
  configured at $0.15 per 1M input tokens; a free quota may bill less.

## AI Answer And Judge

AI evaluation is optional. Supply both models using `provider:model` specs:

```powershell
pnpm exec tsx benchmarks/src/cli.ts run `
	--providers=longmemory `
	--datasets=longmemeval,locomo `
	--cutoffs=5 `
	--answerer=copilot-answerer:gpt-5.6-luna `
	--judge=copilot-judge:gpt-5.6-luna
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
- `claude-code` through `claude --print --output-format json`;
- `copilot` through `copilot --prompt --output-format json`; the official pair uses separate `copilot-answerer` and `copilot-judge` sessions.

Configure hosted keys with `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`; see `comparative.env.example` for endpoint, executable, timeout, and retry settings.

Local examples:

```powershell
# Ollama: pull a generative/chat model first
ollama pull qwen3:8b
pnpm exec tsx benchmarks/src/cli.ts run `
	--providers=longmemory --datasets=smoke `
	--answerer=ollama:qwen3:8b --judge=ollama:qwen3:8b --no-resume

# Copilot CLI runs the official answerer and judge roles in isolated sessions.
# Name an explicit model because benchmark mode ignores user defaults.
copilot update
pnpm exec tsx benchmarks/src/cli.ts run `
	--providers=longmemory --datasets=smoke `
	--answerer=copilot-answerer:gpt-5.6-luna --judge=copilot-judge:gpt-5.6-luna --no-resume

# Requested official pair: two isolated Copilot CLI sessions
$env:BENCH_OFFICIAL_ANSWERER="copilot-answerer:gpt-5.6-luna"
$env:BENCH_OFFICIAL_JUDGE="copilot-judge:gpt-5.6-luna"
pnpm bench:quality
```

The official pair uses two isolated Copilot CLI role sessions, both with
`gpt-5.6-luna`. Codex remains an optional compatibility transport and is not
used by `bench:quality`. Copilot runs non-interactively in
a temporary directory with custom instructions and built-in MCP disabled; the
final `assistant.message` JSON event is used as the verdict. Processes are
terminated on timeout and do not receive this repository as their working tree.

AI mode performs `questions × cutoffs` answer calls and the same number of judge calls. For the 11-case smoke dataset at four cutoffs, that is 44 answer calls plus 44 judge calls and may consume local compute or paid subscription/API quota.

Deterministic evidence retrieval metrics always run, including in AI mode. Default `pnpm bench:ci` deliberately stays retrieval-only so repository CI never depends on paid model APIs.

## Datasets

- `smoke`: eleven tiny deterministic wiring checks covering extraction, preference, multi-session, temporal reasoning, knowledge update, abstention, single-hop, multi-hop, open-domain, adversarial, and summary retrieval. It is intentionally easy and not a comparative benchmark.
- `longmemeval`: official LongMemEval oracle JSON.
- `locomo`: official LoCoMo JSON.
- `beam-1m`: BEAM 1M-token bucket (35 conversations, 700 validated questions).
- `beam-10m`: BEAM 10M-token bucket (10 conversations, 200 questions).

Download official files explicitly with `pnpm bench:data`. Benchmark execution never downloads data implicitly. BEAM 1M is ~170 MiB and BEAM 10M is ~500 MiB of JSON; a single 1M conversation is ~2,000 turns and a 10M conversation ~20,000 turns, so BEAM runs are embedding-volume heavy and require a semantic embedding profile with real quota (local Ollama or a paid Gemini tier).

Dataset evidence IDs are evaluator-only. Providers receive plain event text, event time, and neutral dataset/session metadata; they never receive evidence labels through IDs, metadata, custom fields, or text. Retrieval attribution uses opaque source provenance first and documented lexical overlap only as a fallback. The benchmark reports retrieval metrics separately from answer correctness; use official LongMemEval/LoCoMo with an answerer and AI judge for substantive comparisons.

Provider-visible `source_ref` values are opaque SHA-256 provenance references derived from a source turn. They contain no dataset ID, session ID, question ID, answer marker, or relevance label. The evaluator maps them back to source turns only after retrieval, preventing near-duplicate dialogue turns from corrupting provenance metrics without revealing gold evidence.

Official runs are rejected unless both `--answerer` and `--judge` are configured. All providers ingest the same plain conversation turns. LongMemory preserves raw turns internally for immutable provenance, but benchmark search renders the structured claims stored during production ingestion under a 2,048-token context budget; it does not return raw stored turns directly.

During retrieval engineering, `--retrieval-diagnostic` permits LongMemEval/LoCoMo without AI calls. Reports are labelled `retrieval diagnostic`, cannot be confused with official answer accuracy, and still require a real semantic embedding profile for LongMemory.

Use `--sample-offset=<n>` for deterministic holdouts. LoCoMo sampling maximizes distinct conversations across task categories, and questions sharing one corpus reuse a single ingestion/indexing pass. Development diagnostics and final Codex validation must use different offsets.

Official LongMemory runs require a semantic embedding profile. The validated local profile is `LONGMEMORY_EMBEDDING_PROVIDER=ollama`, `LONGMEMORY_EMBEDDING_TIER=deep`, `LONGMEMORY_EMBEDDING_DIMENSION=768`, and `LONGMEMORY_OLLAMA_EMBEDDING_MODEL=embeddinggemma:latest`.

Gemini is also supported with `LONGMEMORY_EMBEDDING_PROVIDER=gemini`, `LONGMEMORY_GEMINI_EMBEDDING_MODEL=gemini-embedding-001`, and `LONGMEMORY_GEMINI_INPUTS_PER_MINUTE=90`. Free-tier Gemini projects may still hit a 1,000-input daily cap on full LoCoMo; such runs remain partial and never fall back silently.

LongMemory stores exact source text for immutable provenance alongside structured claims and a bounded derived summary. Recall ranks with semantic similarity, corrected BM25 IDF, entity overlap, temporal activation, conversation adjacency, role attribution, and query-conditioned preference/emotion signals. Returned benchmark context is rendered from stored claims, not reparsed or copied raw turns, and every provider is constrained by the same 2,048-token budget.

The validated evaluation pair is `copilot-answerer:gpt-5.6-luna` for answers
and `copilot-judge:gpt-5.6-luna` for judging. These aliases create separate
Copilot CLI role sessions; the provider/model suffix alone may still not be
identical as an answerer and judge. Model availability is account-specific and
must be preflighted through the same transport before a long run.

`pnpm bench:full`, `pnpm bench:ci:full`, and `pnpm bench:quality` require
explicit, distinct model specs through `BENCH_OFFICIAL_ANSWERER` and
`BENCH_OFFICIAL_JUDGE`. Official runs reject using the same provider/model as
both roles. Exact required `I don't know` abstentions are scored deterministically.

## Flags

| Flag                                  | Meaning                                          |
| ------------------------------------- | ------------------------------------------------ |
| `--providers=longmemory`              | Benchmark target (LongMemory only)               |
| `--datasets=smoke,longmemeval,locomo` | Dataset set                                      |
| `--per-category=2`                    | Maximum official cases per category              |
| `--cutoffs=1,5,10,20`                 | Retrieval cutoffs                                |
| `--run-id=<id>`                       | Stable checkpoint identity                       |
| `--out=<directory>`                   | Artifact directory                               |
| `--answerer=<provider:model>`         | Generate a fresh answer at each cutoff           |
| `--judge=<provider:model>`            | Judge each cutoff answer with category rules     |
| `--no-resume`                         | Replace an existing checkpoint                   |
| `--require-all`                       | Fail when any provider is unavailable or partial |
| `--gate`                              | Apply configured quality gates                   |
| `--no-color`                          | Disable terminal colors                          |

A resume is accepted only when its secret-free manifest matches datasets, cases, cutoffs, providers, endpoints, routes, runtime environment, answerer, and judge configuration. API keys are never persisted. Completed checkpoints can render reports while providers are offline. Run latency benchmarks without concurrent builds or tests.
