<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/benchmarks.md
 usage : documents LongMemory benchmarks
-->

# LongMemory benchmarks

LongMemory uses one terminal-first benchmark pipeline against the embedded
production engine:

```text
dataset -> isolated world -> ingest -> index -> retrieve -> evidence scoring
                                                    -> grounded answer -> judge
                                                    -> scorecard + checkpoint
```

The public benchmark target is only `longmemory`. Historical competitor
adapters remain internal compatibility code, but the CLI and official wrapper
reject comparison-provider selections.

## Scorecard

The headline cutoff is K=5. Every field in `report.json` contains a value,
unit, numerator, denominator, and an optional unavailable reason.

- **LongMemEval / LoCoMo**: judged Answer@5. Incomplete dataset runs are N/A,
  never scored over only their completed subset.
- **Context recall / precision**: macro-averaged evidence retrieval at K=5.
- **Evidence completeness**: fraction of answerable questions for which every
  required evidence turn appears in the top five.
- **Current-fact accuracy**: judged `information-extraction` and `single-hop`
  questions.
- **Update accuracy**: judged `knowledge-update` questions.
- **Event-order accuracy**: judged `temporal-reasoning` questions.
- **Abstention accuracy**: judged `abstention` and `adversarial` questions.
- **Contradiction resolution**: a knowledge-update answer must be correct and
  retrieve no forbidden stale evidence.
- **Historical-fact accuracy**: N/A until a dedicated historical QA dataset is
  implemented.
- **BEAM-1M / BEAM-10M**: judged Answer@5 over the selected BEAM bucket.
  `pnpm bench:data` downloads both buckets from the public BEAM repository;
  `--per-category` selects conversations per bucket. BEAM probing questions
  have no turn-level evidence annotations, so BEAM cases are excluded from
  evidence retrieval metrics (`evidence_unknown`) and scored by judgment.
- **p50 / p95 retrieval**: completed search phase duration.
- **Mean tokens retrieved**: average bounded context tokens per completed case.
- **Write/read cost**: embedding input list-price estimate only. Set
  `BENCH_EMBEDDING_INPUT_COST_PER_MILLION_USD`; otherwise costs are N/A rather
  than assumed to be free. The configured Gemini Embedding 001 rate is $0.15
  per 1M input tokens; free-tier billing may be lower.

## Evaluation integrity

Official LoCoMo and LongMemEval evidence IDs stay only in evaluator state.
LongMemory receives plain turns, timestamps, neutral session metadata, and an
opaque SHA-256 source reference. Attribution uses that reference first and
documented lexical overlap only as a fallback.

The deterministic smoke dataset is wiring coverage, not a publishable quality
claim. Official runs require both an answerer and a distinct judge. The
validated pair is:

```text
answerer: copilot-answerer:gpt-5.6-luna
judge:    copilot-judge:gpt-5.6-luna
```

Both roles use separate Copilot CLI sessions with `gpt-5.6-luna`. Copilot runs
non-interactively in a temporary directory with custom instructions and built-in
MCP disabled; the final `assistant.message` JSON event supplies the verdict. Exact required
`I don't know` answers are scored deterministically before model judgment.

Official LongMemory runs require semantic embeddings with tier `deep` or
`smart`. Gemini uses `gemini-embedding-001`, an explicit dimension, and a
configured input-per-minute limit. Semantic provider fallback fails the run.

## Reproducibility

Checkpoints are written atomically after every phase. Their secret-free manifest
records dataset cases, cutoff, embedding profile, model specs, Node/OS/CPU/RAM,
and cost rate. Incompatible resumes are rejected. API keys are never persisted.

Run latency benchmarks without concurrent builds, tests, or servers unrelated
to the benchmark. Contention invalidates latency percentiles even when quality
is deterministic.

## Commands

```powershell
pnpm bench             # smoke wiring check
pnpm bench:data        # download LongMemEval and LoCoMo
pnpm bench:quality     # official LongMemory K=5 scorecard
pnpm bench:typecheck
pnpm bench:typecheck
pnpm bench:ci
```

Generated checkpoints and reports live under `benchmarks/runs/`.
