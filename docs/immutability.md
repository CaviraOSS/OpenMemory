<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/immutability.md
 usage : documents LongMemory immutability
-->

# Why the substrate is immutable

Hydrograph memory is built from immutable, content-addressed `HydroNode`s and
executable `HydroEdge`s. Durable nodes are never edited in place. New knowledge
is expressed as new nodes plus edges (supersession, contradiction, grounding),
not as mutation of existing nodes.

Immutability is a product constraint, not an implementation detail. It exists
for four reasons.

## Prevents silent memory rewrite

If a durable fact could be edited in place, a later write could quietly change
what the system "remembers" having known, with no trace. Immutability makes that
impossible: changing content produces a different content hash and therefore a
different node. The original remains.

## Supports audit

Every durable node is content-addressed and carries provenance (who created it,
how it was extracted, and its source trace). Because nodes cannot change, the
audit trail is stable: a hash uniquely identifies exact content, and provenance
explains where it came from.

## Enables historical reconstruction

Every durable fact is bitemporal (valid-time and transaction-time). Combined
with immutability, this lets the system reconstruct both what was true at a past
moment and what the system believed at a past moment, without losing superseded
truths.

## Supports dedupe and versioning

Content addressing means identical content hashes to the same value, so the
graph deduplicates naturally. Divergent content produces a new hash, so
versioning is expressed as distinct nodes linked by edges rather than as
destructive overwrites. A Merkle root over all node hashes provides a single
integrity check that detects any tampering across the durable set.

## What is and isn't hashed

The content hash covers durable content: `content`, `facets`, `world`, and the
durable fact onset (`valid_from`, `observed_at`). Grounding, contract, and
provenance are hash-relevant only when the hash policy opts in. Mutable runtime
state (`state`, `vectors`, `grounding`), MVCC bookkeeping (`valid_to`,
`superseded_at`), and the transaction timestamp (`recorded_at`) are never
hashed, so a node's identity stays stable while it is superseded, grounded,
supported, and its activation, confidence, and decay evolve.
