<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/contracts.md
 usage : documents LongMemory contracts
-->

# Memory usage contracts

Hydrograph does not treat every memory as usable everywhere. Each memory carries
a **contract** that defines how it may be used, and every recall mode applies a
gate that enforces that contract. A memory that is perfect for one mode may be
forbidden in another.

## The contract

```ts
type MemoryContract = {
  use_for_reasoning: boolean; // strict factual reasoning
  use_for_personalization: boolean; // tailoring to the user
  use_for_prediction: boolean; // forecasting
  use_for_emotional_context: boolean; // emotional colour
  use_for_associative_recall: boolean; // loose association
  requires_grounding: boolean; // must be grounded to be used factually
  expires_if_unconfirmed: boolean; // drops out when stale and unconfirmed
  privacy_level: "public" | "private" | "sensitive" | "secret";
  max_valid_duration: number | null; // ms from valid_from; null = unbounded
  source_required: boolean; // needs provenance/source to be used
};
```

## Recall modes

There are four recall modes, each with its own admission gate:

- **strict** — current, confident, non-contradicted factual reasoning
- **historical** — what was true (or believed) at a past time
- **associative** — loose association, clearly labeled
- **world_grounded** — externally grounded facts only

`applyContractGate(node, mode, context)` routes a memory and mode to the right
gate and returns `{ allowed, label, reasons }`.

## Strict recall rejects

- superseded memory
- contradicted memory
- a memory sitting in an unresolved contradiction
- low-confidence memory
- ungrounded memory when its contract requires grounding
- a memory whose contract forbids reasoning
- expired memory (past `valid_to` or `max_valid_duration`), and especially an
  expired **and unconfirmed** memory when `expires_if_unconfirmed` is set
- a memory missing a required source

## Historical recall allows

- superseded memory when it was valid at the requested `at` time
- old agent beliefs when they were recorded as of the requested `asOf` time

Superseded memories are admitted here, and labeled `superseded`.

## Associative recall allows

- superseded memories
- emotional residue
- weak pattern memories

...but it always labels what it admits (`emotional_residue`, `superseded`,
`weak_pattern`, or `active`), so downstream consumers know they are not looking
at confirmed current fact. It only refuses memories whose contract forbids
associative recall or that are marked `secret`.

## World-grounded recall requires

- grounding to an exocortex fact (above the grounding threshold)
- freshness of that grounding
- provenance / a source
- sufficient source reliability

An ungrounded fact is rejected here even if it would pass strict recall.

## Why gates matter

Contracts turn "can this memory be used?" into an explicit, auditable decision.
A personalization-only note never leaks into factual reasoning; an emotional
memory can still color an associative answer while being clearly labeled; a
sensitive fact stays out of modes it was never licensed for. Each gate returns
its `reasons`, so every admission or rejection is explainable.
