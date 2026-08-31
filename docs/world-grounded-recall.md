<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/world-grounded-recall.md
 usage : documents LongMemory world grounded recall
-->

# World-grounded recall

World-grounded recall answers factual questions using external world truth. It
starts from subjective (endocortex) memories but only accepts them when they are
grounded to a fresh, reliable exocortex fact. Ungrounded claims never pass, and
subjective memory is only ever reported as subjective context — never as a
grounded answer.

## The flow

`groundedRecall(query, deps)`:

1. Accept the query.
2. Resolve entities.
3. Select worlds.
4. Find endocortex memories related to the query.
5. Follow the grounds link (a `grounds` edge, or the node's `worlddb_ref`) to an
   exocortex fact.
6. Validate source freshness and reliability.
7. Apply the grounding score, recomputed **live** from the current fact.
8. Reconcile the subjective belief with the external fact.
9. Return the grounded context and a grounding trace.

Because grounding is recomputed from the live fact on every call, an external
world update immediately changes the answer: expire or replace a fact and the
memory that depended on it drops out.

## Reconciliation

Each grounded memory is reconciled against its fact:

- `confirmed` — the memory agrees with the external fact.
- `contradicted` — the memory disagrees with the external fact.
- `unconfirmed` — partial or unclear agreement.
- `subjective_only` — no grounding; usable only as subjective context.

## Rules

1. Ungrounded claims cannot pass world-grounded recall.
2. Stale external facts are downranked (mildly stale) or rejected (too stale) —
   freshness feeds both the grounding score and the gate.
3. Subjective memory is available for associative recall but never appears as a
   grounded answer.
4. A grounding trace is always returned.

## Grounding trace

For every candidate the trace records: whether it was grounded, the fact ref, the
source id and kind, source reliability, freshness, grounding score, the
reconciliation outcome, whether it was accepted, and the gate reasons. This makes
a grounded factual answer fully auditable.

## Example

A memory "the server is in Finland" is grounded to a WorldDB fact. While the fact
is fresh, world-grounded recall returns the memory as `confirmed`. When the world
updates — the fact expires — the next recall recomputes low freshness, the gate
rejects it, and the answer changes. The subjective memory still exists; it is
simply no longer a grounded fact.
