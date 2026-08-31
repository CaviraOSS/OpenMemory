<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/ingest.md
 usage : documents LongMemory ingest
-->

# Hydrograph ingest pipeline

Ingestion converts a raw `MemoryEvent` into structured cognitive memory. It is a
single transaction across working memory, entity resolution, recursive worlds,
the durable graph, WorldDB, the active recall index, and compression sketches.

## API

```ts
const engine = new IngestEngine();

const result = engine.ingest({
  user_id: "user:1",
  text: "I now prefer coffee instead of tea",
  at: Date.now(),
  tags: ["preference", "beverage"],
});
```

`MemoryEvent` supports explicit observed/valid time, world, tags, vectors,
endocortex/exocortex zone, external source, grounding reference, entity hints,
contract overrides, and metadata. Plain text with a user id is sufficient.

## Fourteen-step flow

Every successful result contains an ordered 14-step explain trace:

1. Accept the raw event.
2. Add it to the bounded working-memory buffer.
3. Parse entities, claims, preferences, actions, procedures, emotions,
   reflections, and possible external facts.
4. Resolve every entity before node creation or durable write.
5. Assign semantic, episodic, procedural, emotional, and reflective facets.
6. Select or create a recursive world.
7. Stage an immutable, content-addressed `HydroNode`.
8. Build and execute relationship edges through `insertEdge`.
9. Apply valid-time and recorded-time fields.
10. Attach live grounding where available.
11. Resolve the world/event memory contract.
12. Stage active-index and sketch updates.
13. Optionally run consolidation and execute every `derived_from` edge.
14. Commit and return `MemoryDiff` plus the explain trace.

## Parsing and zones

`parsePerception` and `extractClaims` are deterministic, dependency-free
extractors. Explicit `entity_hints`, `source`, `external`, and temporal fields
take precedence over text inference.

- External facts become WorldDB facts and immutable **exocortex** nodes.
- Subjective statements become **endocortex** nodes.
- A subjective statement can name `grounding_ref`; otherwise the engine searches
  current WorldDB facts and creates an executable `grounds` edge when a matching
  exocortex node exists.

Every factual claim receives `valid_from`, `valid_to`, `observed_at`, and
`recorded_at`. Endocortex facts require grounding by default; preferences remain
subjective semantic memories.

## Relations and MVCC

Claims are normalized to comparable `(subject, predicate, object, topic)`
records:

- A changed preference creates `new --supersedes--> old`. The handler closes
  the old valid-time and marks it superseded.
- A conflicting factual statement creates `new --contradicts--> old`. The
  handler records unresolved contradiction state.
- A matching subjective/external pair creates
  `subjective --grounds--> exocortex`.
- Consolidation emits executable `derived_from` edges.

No edge is inserted passively. Every edge is validated and executed against a
staging `EdgeContext` before it can enter the durable graph.

## Transaction model

`IngestTransaction` snapshots every ingest-owned mutable store:

- `DurableGraph` nodes and edges;
- `EntityResolver` entities, candidates, aliases, and merge mapping;
- `WorldGraph` worlds and placement history;
- `InMemoryWorldDB` facts;
- `InMemoryRecallIndex` hot nodes;
- `MemorySketches`; and
- `WorkingMemory`.

Any parser, resolver, world, edge-handler, grounding, index, sketch, or
consolidation failure restores all snapshots and throws
`IngestTransactionError`. Durable graph commit occurs only after every edge
handler succeeds.

Mutable node envelopes (status, confidence, grounding, valid-time) are committed
with `applyNodeVersion`. The durable id and content hash cannot change.

## MemoryDiff

`MemoryDiff` explains exactly what committed:

- created and updated node ids;
- created executable edge ids;
- entity mentions, canonical ids, and resolve actions;
- selected world ids and WorldDB references;
- active-index updates;
- entity/tag/relation/world/pattern sketch updates; and
- optionally consolidated node ids.

## Invariants

1. Entity resolution precedes node creation and durable write.
2. All inserted edges execute through registered handlers.
3. Factual claims are bitemporal.
4. Every node carries an effective memory contract.
5. External facts live in the exocortex and WorldDB.
6. Subjective memories live in the endocortex.
7. The complete ingest operation is transactional.
