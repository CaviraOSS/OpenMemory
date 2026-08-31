<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/worlds.md
 usage : documents LongMemory worlds
-->

# Why worlds replace flat sectors

Early memory systems bucket everything into a handful of flat sectors
(episodic, semantic, procedural, ...). That conflates two very different
questions:

- **What kind of memory is this?** — that is a _facet_.
- **Where and under what context does it live?** — that is a _world_.

Hydrograph keeps these separate. Facets describe the cognitive character of a
memory; worlds are recursive, contextual containers that describe placement.
This is invariant 6: worlds are recursive containers, not flat sectors.

## What a world holds

A `World` can contain:

- nodes (`node_refs`) and edges (`edge_refs`)
- child worlds (`child_world_ids`) — worlds nest arbitrarily deep
- an ontology (the types and terms the world recognizes)
- contracts that shape how its memories may be recalled
- a composed `world_vector`
- a `content_hash` and bitemporal-style `created_at` / `updated_at`
- a `zone`: `endocortex` (subjective), `exocortex` (external truth), or `mixed`

## Why recursion matters

Flat sectors cannot express context. "Project Alpha → deployment → incidents"
is a path, not a bucket. Recursive worlds let a memory live in a specific
context while still rolling up to its parents. A query can scope to one world or
to an entire subtree.

## Rules

1. Worlds can contain child worlds.
2. A node can have multiple facets at once.
3. A node has a primary world but may be referenced by other worlds.
4. Moving a node records placement history; it does not erase the old placement.
5. A parent world's hash changes when any child's state changes — structural
   integrity rolls up to the root.
6. Worlds may carry contracts that affect recall.

## World embedding

A world's vector summarizes its context as a normalized weighted combination of:

- child node vectors
- child world vectors
- relation (edge) vectors
- a grounding vector
- an ontology vector

Because child world vectors feed the parent, embeddings are composed bottom-up,
so a parent world's vector reflects everything beneath it.

## Contracts and recall

Contracts resolve down the tree: a world inherits its ancestors' contract and
may override any part of it. The nearest ancestor wins. This lets a sensitive
sub-world (for example, one that `requires_grounding`) tighten recall rules for
everything inside it without affecting sibling worlds.

## What this phase does not do

This phase builds the world container and its structure, hashing, embedding, and
contract resolution. It does not implement recall — that arrives in a later
phase and will consult world contracts and embeddings when scoring candidates.
