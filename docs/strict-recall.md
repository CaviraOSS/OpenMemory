<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/strict-recall.md
 usage : documents LongMemory strict recall
-->

# Strict recall

Strict recall answers factual questions. It is deliberately **not** semantic
search: an embedding match is only one signal, and it can never override the
validity gates. A memory that is superseded, contradicted, ungrounded (when
grounding is required), or low-confidence is rejected no matter how well its
vector matches the query.

## The flow

`strictRecall(query, deps)` runs a fixed pipeline:

1. Accept the `RecallQuery`.
2. Parse query intent (terms + entity mentions).
3. Resolve entities (read-only against the entity resolver).
4. Select candidate worlds (a world subtree, or all active nodes).
5. Retrieve candidates from the **active index only** — cold logs are never
   scanned.
6. Apply bitemporal validity.
7. Apply the memory contract gate.
8. Apply the contradiction gate.
9. Apply the grounding gate when grounding is required.
10. Score the survivors.
11. Build a context packet under the token budget.
12. Return an explain trace.

Steps 6-9 are the strict contract gate from the recall gates phase. Only
candidates that pass every gate reach step 10.

## Scoring

Among valid candidates, ranking uses a weighted blend of signals:

```
score = w_vector      * semantic_similarity
      + w_lexical     * lexical_score
      + w_entity      * entity_match
      + w_temporal    * temporal_relevance
      + w_confidence  * confidence
      + w_grounding   * grounding_score
      + w_provenance  * provenance_quality
      + w_utility     * utility
      - w_contradiction * contradiction_pressure
      - w_staleness   * staleness
```

Embeddings contribute `semantic_similarity` only. Because scoring happens after
gating, a high embedding score cannot resurrect an invalid memory.

## Not-cold-log guarantee

Candidate retrieval reads a hot/active index. The in-memory index exposes a
`coldScans` counter that stays at `0` during strict recall, so tests can prove
the cold store was never touched — strict recall stays fast and bounded.

## Explain trace

Every strict recall returns an `ExplainTrace`: which entities were resolved,
which worlds were selected, how many candidates were retrieved/accepted/rejected,
the reasons each rejected candidate failed its gate, each accepted candidate's
score, whether it made it into the context packet, and the cold-scan count. This
makes a factual answer auditable end to end.

## Context budget

The context builder packs the highest-scoring accepted candidates while keeping
`tokensUsed <= budget`. A factual answer never silently blows past its context
window.
