<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/reconsolidation.md
 usage : documents LongMemory reconsolidation
-->

# Reconsolidation

A durable node is immutable. But what a memory _means_ changes as the world moves
on — it may be superseded, contradicted, or grounded to a fact that is no longer
true. Reconsolidation reinterprets a memory **at recall time** against the current
truth, grounding, contradiction state, and historical trace, and emits a corrected
recall object. The original node is never mutated; the view is a derived object,
optionally persisted via a `derived_from` edge.

## API

`reconsolidateMemory(node, context)` orchestrates the pieces:

- `followSupersessionChain(node, ctx)` — walk `supersedes` edges to the current
  corrected truth (convention: `from` = new supersedes `to` = old).
- `checkContradictionStatus(node, ctx)` — is the memory (still) contradicted, and
  what is the warning?
- `checkCurrentGrounding(node, ctx)` — recompute grounding **live** against the
  current world; a fact whose valid-time has closed is no longer `still_valid`.
- `preserveHistoricalTrace(node)` — the immutable historical residue (content,
  temporal envelope, emotional residue, provenance).
- `createReconsolidatedView(node, currentState)` — assemble the corrected object.
- `createDerivedFromEdge(summaryId, originalId, at)` — optionally persist a
  summary linked back to its origin.

## Output

A `ReconsolidatedView` always includes:

- `original_id` — the original memory id.
- `current_status` — the original node's status.
- `current_truth` — the corrected current truth when superseded.
- `historical_residue` — the preserved immutable trace.
- `contradiction` — contradiction state (with warning).
- `grounding` — the live grounding trace.
- `recommended_mode` — the safe recall mode to use this memory in.
- `warnings` and `provenance` (preserved verbatim from the original).

## Recommended mode

| Situation                         | Recommended mode                             |
| --------------------------------- | -------------------------------------------- |
| Unresolved contradiction          | `associative` (never current truth)          |
| Superseded                        | `historical` (with pointer to current truth) |
| Grounded, still valid, confirmed  | `world_grounded`                             |
| Grounded but no longer valid      | `associative` (emotional) / `historical`     |
| Requires grounding but ungrounded | `associative`                                |
| Current, plain fact               | `strict`                                     |

## Examples

1. **Old wrong belief** — "the earth is flat" is superseded by "the earth is
   round". Reconsolidation returns it as a _historical belief_ with a pointer to
   the current truth, never as current fact.
2. **Fear grounded to a tiger** — while the tiger fact is valid, the memory is
   `world_grounded` and confirmed. Once the tiger leaves (the fact expires), the
   view flips: the tiger is _not_ treated as currently present, but the fear is
   preserved as historical emotional residue (`associative`).
3. **Superseded preference** — an old preference is offered only in
   historical/associative mode, with a pointer to the current preference.

## Rules

- The original immutable node is never mutated; reconsolidation is read-only.
- Superseded and contradicted memories are labeled and downgraded out of strict
  truth.
- Grounding is recomputed live, so a world update changes the reconsolidated view.
- Provenance and historical residue are always preserved.
