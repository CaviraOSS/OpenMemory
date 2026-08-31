<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/historical-recall.md
 usage : documents LongMemory historical recall
-->

# Historical recall

Historical recall answers "what was true then?" and "what did the agent believe
then?". It uses bitemporal MVCC, so it may return superseded memory when that
memory was valid or believed at the requested time. Unlike strict recall, it
does not hide superseded facts — but it clearly separates them from the current
corrected truth, and it never mutates memory.

## The two time axes

- **valid_time** — when a fact was true in the modeled world.
- **recorded_time** — when the memory system knew it (transaction time).

A `HistoricalQuery` can carry either or both:

```ts
type HistoricalQuery = {
  text: string;
  now: number;
  validTime?: number; // world truth at this instant
  recordedTime?: number; // agent belief as of this transaction time
  worldId?: string;
  entityNames?: string[];
};
```

## The flow

`historicalRecall(query, deps)`:

1. Accept the query (optional `validTime` / `recordedTime`).
2. Resolve entities (read-only).
3. Select worlds.
4. Query bitemporal candidates from the working set (superseded nodes live here
   too).
5. Include superseded nodes when they are historically valid.
6. Build correction chains from `supersedes` edges.
7. Distinguish three views:
   - **world truth at time** — nodes valid at `validTime`.
   - **agent belief at time** — nodes known as of `recordedTime`.
   - **current corrected truth** — nodes current at `now`.
8. Return the timeline and an explain trace.

## Worked example

An agent learns in January: "I prefer tea." In March it corrects to "I prefer
coffee." The tea node is closed (`valid_to = March`, `superseded_at = March`) and
a `supersedes` edge links coffee → tea.

| Query                                | Result                                  |
| ------------------------------------ | --------------------------------------- |
| `validTime = February` (world truth) | tea — it was valid in the world then    |
| `recordedTime = February` (belief)   | tea — that is what the system knew then |
| current truth at `April`             | coffee — the corrected truth            |

So the same question yields **tea** historically and **coffee** currently, and
the explain trace shows both plus the supersession chain `[tea, coffee]`.

## Timeline entries

Every entry exposes the full bitemporal envelope — `valid_from`, `valid_to`,
`observed_at`, `recorded_at`, `superseded_at`, `status`, and the flags
`is_current`, `valid_at_query`, `believed_at_query` — so the answer is auditable.

## Read-only

Historical recall only reads. Nodes are frozen and never mutated; the engine
computes views over the existing bitemporal state rather than closing or
reopening anything.
