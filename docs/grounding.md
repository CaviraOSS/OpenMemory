<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/grounding.md
 usage : documents LongMemory grounding
-->

# Endocortex vs exocortex

Hydrograph separates subjective memory from external truth.

## Endocortex — subjective internal memory

The endocortex holds what the agent thinks, feels, and remembers:

- user messages
- agent observations
- preferences
- emotions
- inferred beliefs
- reflections
- personal history

Endocortex memories are allowed to exist without any external grounding
(rule 1). "I felt proud yesterday" needs no world database entry to be a valid
memory.

## Exocortex — grounded external world state

The exocortex holds verifiable external truth:

- tool results
- API results
- verified documents
- databases
- sensors
- WorldDB facts

Exocortex facts are reached through a `WorldDBAdapter` (`get`, `search`,
`validate`, and optional `subscribe`).

## Grounding

A subjective memory may be _grounded_ to an external fact through a grounds
link. Grounding is scored and explainable:

```
grounding_score = sigmoid(
    w_source      * source_reliability
  + w_freshness   * freshness
  + w_observation * observation_count
  + w_agreement   * external_agreement
  - w_conflict    * conflict
)
```

Every grounding produces a `GroundingTrace` that records the signals, the
weights, the pre-sigmoid sum, and a human-readable explanation — so a memory can
always say _why_ it is grounded well or poorly (rule 6).

## Resonance

Resonance measures how strongly a memory and an external fact reinforce each
other:

```
resonance = semantic_similarity * grounding_score * temporal_overlap * relation_weight
```

Because it is a product, any zero factor collapses resonance to zero: an
ungrounded or temporally-disjoint fact does not resonate.

## Rules

1. Endocortex memories may exist without grounding.
2. Memories used for strict factual reasoning may require grounding.
3. World-grounded recall must reject ungrounded facts.
4. External world updates must re-evaluate related grounded memories.
5. Grounding can lower or raise confidence.

## World updates

When the exocortex changes — a fact is updated, expires, or is removed — the
`GroundingLayer` re-evaluates every memory grounded to that fact. An expired or
removed fact drops the grounding score (and lowers confidence), which can make a
memory that _requires_ grounding ineligible for strict factual recall again. A
subscription to the `WorldDBAdapter` makes this automatic.

## What this phase does not do

This phase builds the endocortex/exocortex boundary, grounding scores, resonance,
and world-update re-evaluation. It does not implement the recall engine; a later
phase consults grounding when scoring world-grounded recall candidates.
