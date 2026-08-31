<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/temporal.md
 usage : documents LongMemory temporal
-->

# Valid time vs recorded time

Hydrograph stores every durable fact bitemporally. Two independent time axes
answer different questions.

## The two axes

- **Valid time** (`valid_from`, `valid_to`): when the fact was true in the
  modeled world.
- **Recorded time** (`recorded_at`, `superseded_at`): when the memory system
  knew the fact, i.e. transaction time.

`valid_to` null means "still valid". `superseded_at` null means "still current
in transaction history". Neither field is part of the node content hash, so
closing them does not change a node's durable identity — a superseded fact keeps
its id and hash and simply steps out of the current view.

## Questions the two axes answer

- **What is true now?** `queryCurrentTruth(candidates, now)` — valid now, known,
  and not superseded.
- **What was true then?** `queryHistory(candidates, validTime)` — valid at that
  world time, including superseded facts.
- **What did the agent believe before it learned the correction?**
  `queryBeliefAsOf(candidates, recordedTime)` — known at that transaction time.
- **When did the memory change?** the `recorded_at` / `superseded_at` boundary on
  each version.

## Worked example

An agent learns in January: "I use Python." In March it learns the correction:
"I switched to TypeScript."

```ts
import {
  createHydroNode,
  supersedeNode,
  queryCurrentTruth,
  queryHistory,
  queryBeliefAsOf,
} from "longmemory";

const python = createHydroNode(/* valid_from = Jan, recorded_at = Jan */);
const typescript = createHydroNode(/* valid_from = Mar, recorded_at = Mar */);

// March correction: Python is superseded by TypeScript.
const { superseded, current } = supersedeNode(python, typescript, MAR);
const candidates = [superseded, current];

queryCurrentTruth(candidates, APR); // [TypeScript]  — what is true now
queryHistory(candidates, FEB); // [Python]      — what was true then
queryBeliefAsOf(candidates, FEB); // [Python]      — belief before the correction
```

### Timeline

| Fact       | valid_from | valid_to | recorded_at | superseded_at |
| ---------- | ---------- | -------- | ----------- | ------------- |
| Python     | Jan        | Mar      | Jan         | Mar           |
| TypeScript | Mar        | null     | Mar         | null          |

- In February the current truth is Python (valid, not yet superseded).
- After the March correction the current truth is TypeScript.
- Historical recall for February still returns Python, because Python was valid
  in the world then.
- Belief-as-of February returns Python, because that is what the system knew at
  that transaction time — before the correction was recorded.

## Interaction with recall modes

- **Strict recall** uses only current truth, so superseded facts are excluded
  (temporal rule 6).
- **Historical recall** may use superseded facts when they were valid at the
  requested time (temporal rule 5, 7).

Recall itself is implemented in a later phase; this layer only decides temporal
visibility of candidate facts.
