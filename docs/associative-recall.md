<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/associative-recall.md
 usage : documents LongMemory associative recall
-->

# Associative recall

Associative recall is **not strict truth**. It is the mode for pattern matching,
emotional continuity, personalization, and reflection. It may surface superseded
or contradicted memories, but only ever with an explicit status label and only
when the contract allows it. Because it never mutates state, associative recall
can never affect strict truth.

## Signals

`associativeRecall(query, deps)` combines several signals per candidate:

1. **Vector similarity** — cosine between the query embedding and the memory.
2. **Lexical / BM25** — a BM25 score over the admitted corpus, normalised in-set.
3. **Entity overlap** — resolved entities present in the memory.
4. **ACT-R activation** — recency + salience + relevance − contradiction, passed
   through a sigmoid.
5. **Spreading activation** — bounded propagation over associative edges (below).
6. **Emotional residue** — an emotional-facet boost for personalization.

A small status penalty downranks (but never excludes) superseded and
contradicted memories, so strict facts still tend to rank above historical ones.

## Controlled spreading activation

Activation flows over the graph one hop at a time:

$$
\text{activation}_{\text{next}} = (1 - \alpha)\,\text{query\_seed} + \alpha\,(T \cdot \text{activation}_{\text{current}})
$$

where $T$ is the edge transition matrix (edge weight × confidence, row-normalised
on the source). Spreading is **bounded**: it only visits nodes within `maxHops`
(default 2) of a seed and prunes tiny activations. This guarantees that an
irrelevant or disconnected graph neighbourhood can never flood the recall
context.

## Hopfield-style recall

For associative mode only, a modern-Hopfield update pulls a partial cue toward
the nearest stored pattern:

$$
\text{retrieved} = V \cdot \text{softmax}(\beta\,K^{\top} q)
$$

$\beta$ (inverse temperature) controls how sharply retrieval snaps to a single
pattern. This is a **pattern** operation, not a truth operation — it returns the
memory whose pattern is most similar, which may well be a superseded or
subjective memory.

## Status labeling

Every returned memory carries a status label:

- `superseded` — the memory was superseded (always labeled — rule 2).
- `contradicted` — the memory is contradicted (always labeled — rule 3).
- `emotional_residue` — emotional memory usable for personalization (rule 4).
- `weak_pattern` — low-confidence associative match.
- `active` — a current, confident memory.

## Rules

1. Associative recall cannot update strict truth (it is read-only).
2. Superseded memories must be labeled `superseded`.
3. Contradicted memories must be labeled `contradicted`.
4. Emotional residue may be used for personalization / emotional context.
5. Graph expansion must be bounded (`maxHops`, activation pruning).

## Example

An old emotional memory — "I felt joy at the beach with my dog" — surfaces
associatively for the cue "beach dog" with the label `emotional_residue`, even
though it is years old and would never pass strict recall. A superseded
preference still appears, but tagged `superseded`, and running associative recall
never changes what strict recall returns.
