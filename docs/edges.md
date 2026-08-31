<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/edges.md
 usage : documents LongMemory edges
-->

# Executable edges

In Hydrograph, a `HydroEdge` is not a passive label between two nodes. Each edge
type has semantics, and inserting an edge runs a handler that maintains the
graph's truth state, contradiction state, grounding state, confidence, and
entity identity (invariant 4: edges are executable).

## Why passive graph labels are banned

A passive label like `A --supersedes--> B` records that a relationship exists
but does nothing. Some other component must later interpret the label and update
state, and every such component can interpret it differently. That leads to:

- **Truth drift**: a "supersedes" label that never closes the old fact's validity
  leaves stale truth readable by strict recall.
- **Silent inconsistency**: contradiction labels with no pressure accounting let
  conflicting facts both be treated as confident.
- **Ungoverned grounding**: a "grounds" label with no score update cannot tell
  strict grounded recall whether a fact is actually confirmed.
- **Scattered logic**: the meaning of an edge ends up duplicated across readers.

Executable edges fix this by making the edge the single place its semantics
live. Inserting the edge _is_ the state transition.

## The single entry point

All edge insertion goes through `insertEdge(edge, context)`. The runtime:

1. validates the edge,
2. finds the handler for the edge type,
3. runs the handler atomically (snapshot → run → rollback on failure),
4. updates affected nodes (as new frozen versions with stable ids/hashes),
5. writes an audit entry,
6. returns an `EdgeExecutionResult`.

If a handler throws, every change is rolled back and the error propagates.
Unknown edge types throw a clear error rather than being silently ignored.

## Edge types and their handlers

| Type             | from → to            | Effect                                                                |
| ---------------- | -------------------- | --------------------------------------------------------------------- |
| `contains`       | parent/world → child | adds child to parent, recomputes parent world Merkle hash             |
| `refers_to`      | node → node          | records a lightweight reference (no node mutation)                    |
| `same_as`        | alias → canonical    | links alias to canonical in resolver; keeps historical mentions       |
| `supports`       | evidence → target    | raises target confidence via evidence update, records the source      |
| `contradicts`    | node ↔ node          | creates an unresolved contradiction, raises pressure, marks both      |
| `supersedes`     | new → old            | closes old validity/transaction, marks superseded, transfers salience |
| `derived_from`   | derived → source     | links derived memory to source, preserves the provenance chain        |
| `grounds`        | endocortex → world   | links subjective memory to world truth, raises grounding score        |
| `semantic_shift` | earlier → later      | records meaning drift; does not overwrite entity identity             |

## Atomicity and immutability

Handlers never mutate durable nodes in place. Each update produces a new frozen
node version that keeps the same id and content hash — only envelope fields
(state, grounding, temporal bookkeeping, provenance trace) change. Because the
runtime snapshots the working state before running a handler, a partial handler
failure leaves the graph exactly as it was.
