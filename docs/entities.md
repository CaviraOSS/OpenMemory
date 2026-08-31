<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/entities.md
 usage : documents LongMemory entities
-->

# Entities and conservative resolution

Hydrograph memory depends on canonical entities. A memory graph with bad entity
resolution is worse than no graph: a single wrong merge corrupts every memory
that references the merged identity. The resolver is therefore conservative — it
merges only under high confidence, creates a candidate when uncertain, never
forces an unsafe merge, and records meaning drift instead of overwriting it.

## The score

```
score = w_name    * name_similarity
      + w_vector  * vector_similarity
      + w_context * context_overlap
      + w_temporal* temporal_compatibility
      - w_conflict* conflict_penalty
```

Every term is deterministic and in `[0,1]`, so the same inputs always produce
the same decision. The conflict penalty is subtracted so a strong conflict (a
type mismatch or a disambiguator/domain mismatch) can block a merge even when
names are identical.

## Decisions

| Condition                                         | Action                         |
| ------------------------------------------------- | ------------------------------ |
| `score >= merge_threshold` and no strong conflict | resolve to canonical           |
| `candidate_threshold <= score < merge_threshold`  | create a candidate             |
| `score < candidate_threshold`                     | create a new entity            |
| strong conflict present                           | never merge (candidate or new) |

## Examples

### Alias

`Alice Chen` is registered with alias `A. Chen`. A later mention of `A. Chen`
resolves directly to Alice via the alias index — no scoring needed.

### Same name, different context (unsafe merge prevention)

`John` in a `school` domain and `John` in a `hosting` domain share a name but
carry a domain mismatch. The conflict penalty drives the score down and
`preventUnsafeMerge` returns true, so they stay distinct entities.

### Candidate

`Alicia Chen` is similar to `Alice Chen` but not certain. The score lands
between the candidate and merge thresholds, so the resolver creates a
`MergeCandidate` linking the new entity to Alice — it does not merge them. A
human or a higher-confidence signal can later confirm the merge with a
`same_as` edge.

### Semantic drift

`Project Alpha` starts as a weekend hobby and later becomes production
infrastructure. Instead of overwriting the entity, the resolver records a
`semantic_shift` edge and appends a `drift_history` entry. The original meaning
remains queryable; the drift is an addition, not a rewrite.

## Manual merge

Confirming a candidate calls `createSameAsEdge(candidate, canonical)`, which
emits an executable `same_as` edge and updates the alias index so future
mentions of the candidate's name resolve to the canonical entity.
