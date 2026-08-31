<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/consolidation.md
 usage : documents LongMemory consolidation
-->

# Consolidation

Consolidation converts clusters of raw episodic memories into higher-order
semantic, procedural, reflective, or corrected grounded memories. Source
memories are immutable and are never deleted. Every derived memory is linked to
every source with a `derived_from` edge and carries the source provenance trace.

## Trigger

A detected pattern consolidates when:

$$
\text{repetition} + \text{salience} + \text{grounding} + \text{utility}
+ \text{confidence} - \text{contradiction} - \text{noise}
\geq \text{threshold}
$$

The default threshold is `0.5` and can be overridden per run. Candidate
formation is bounded to four explicit cases: a repeated episodic cluster, an
unresolved contradiction component, or an explicit external world correction.
This keeps a low reflection threshold from turning unrelated memories into
derived noise.

`utility` reuses the core memory utility function. `noise` is the inverse of
lexical cluster coherence. The result exposes every signal and the final score
for auditability.

## API

`consolidateMemories(sources, context)` returns:

- `memories` — new frozen, content-addressed higher-order nodes.
- `edges` — one immutable `derived_from` edge per derived/source pair.
- `patterns` — every detected pattern and trigger breakdown.
- `skipped` — below-threshold or stale world corrections with reasons.
- `source_count` — confirms that the source set was retained.

The context accepts contradictions, explicit `world_corrections`, a WorldDB
adapter, a configurable threshold, and contract overrides.

## Consolidation forms

### Episodic to semantic

Repeated statements become stable semantic memory. Preferences remain
subjective and do not acquire artificial grounding. Factual clusters preserve
their grounding requirement.

### Episodic to procedural

Repeated failures, fixes, retries, or successful actions become a procedural
lesson via `buildProcedureMemory`.

### Contradictions to reflection

Connected unresolved contradiction clusters become reflective summaries via
`buildReflectionMemory`. Reflection contracts disable strict reasoning and
prediction because the underlying claims are not settled truth.

### World update to corrected belief

An explicit world correction creates a bitemporal semantic memory grounded to
the current external fact. Its valid-time comes from that fact. Corrections that
are already stale are skipped.

## Contracts and time

Every consolidated memory has a conservative contract derived from all sources:
the most restrictive privacy level wins, source provenance is required, and
grounding requirements are preserved. Factual outputs carry valid-time and
recorded-time. A repeated factual cluster whose sources or WorldDB fact are
stale is emitted only as `superseded`, so strict recall rejects it.

## Recall quality

Consolidation reduces repeated episodic noise by adding one current, stable,
high-confidence summary. The Phase 15 acceptance benchmark runs the existing
`qualityReport` before and after consolidation and requires MRR to improve while
recall is preserved or improved. Stale-fact leakage is checked separately by
running the consolidated set through strict recall.

## Rules

1. Source memories are never mutated or deleted.
2. Every derived memory links to all sources with `derived_from` edges.
3. Every derived memory has a contract and full provenance.
4. Factual outputs are bitemporal.
5. Stale corrections are skipped; stale factual clusters cannot enter strict
   recall as current truth.
6. Consolidation must improve or preserve benchmark recall quality.
