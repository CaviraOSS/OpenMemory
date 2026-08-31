<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/sqlite.md
 usage : documents LongMemory sqlite
-->

# SQLite persistence

SQLite is LongMemory's first durable backend. It is local-first, self-hostable,
requires no separate database service, and preserves Hydrograph's immutable
identity, executable-edge, bitemporal, grounding, audit, and sketch semantics.

## Setup

`better-sqlite3` is a runtime dependency. The workspace explicitly allows its
native installation script. Create or open a database with:

```ts
import { SqliteStore } from "longmemory";

const store = new SqliteStore("./longmemory.db", {
  tenantId: "tenant:default",
  userId: "user:alice",
});
```

On startup the store:

1. enables foreign keys;
2. sets a five-second busy timeout;
3. enables WAL and normal synchronous mode for file databases;
4. applies pending schema migrations transactionally; and
5. runs an integrity check unless disabled explicitly.

The production build copies `schema.sql` beside the compiled migration module,
so migrations work from the published package as well as source.

## MemoryStore

`SqliteStore` implements the public `MemoryStore` interface:

- `saveNode` / `loadNode`;
- `saveBatch` for atomic node/edge persistence;
- `persistIngest` for one-transaction persistence of a complete `IngestResult`;
- `executeEdgeTransaction`;
- `queryCurrentTruth`;
- `queryHistoricalTruth`;
- `queryStrictCandidates`;
- `saveSketchState` / `loadSketchState`;
- `transaction`;
- `checkIntegrity`; and
- `close`.

Additional SQLite operations persist worlds, entities and canonical aliases,
grounded facts, cold logs, contracts, contradictions, and edge audit entries.

## Schema

The initial migration creates:

- `hydro_nodes`;
- `hydro_edges`;
- `worlds`;
- `entities`;
- `entity_aliases`;
- `contradictions`;
- `grounded_facts`;
- `memory_contracts`;
- `audit_log`;
- `sketch_states`;
- `cold_logs`; and
- `migrations`.

Canonical JSON preserves every field without lossy relational reconstruction.
Query-critical fields are duplicated into typed columns for indexes. Identity
triggers prevent updates to a node's content hash, content, facets, world, zone,
valid-time onset, and observation time. Mutable envelope fields such as status,
confidence, grounding, `valid_to`, recorded time, and supersession time can be
updated only while the identity hash remains unchanged. Edge rows are immutable.

## Indexes

Indexes cover:

- tenant/user scope;
- world and node status;
- valid and recorded time;
- supersession time;
- edge source, target, and type;
- grounding references;
- canonical entity aliases;
- unresolved contradiction endpoints;
- audit/cold-log time; and
- a partial active strict-candidate index.

Strict queries also enforce confidence, grounding requirements, provenance
requirements, contract maximum-valid-duration, and unresolved contradictions.

## Executable edge transaction

`executeEdgeTransaction(edge)` loads both endpoint nodes, builds an
`EdgeContext`, and calls the normal `insertEdge` runtime. A single SQL
transaction then writes:

1. every handler-produced node envelope version;
2. the immutable edge;
3. unresolved contradiction records; and
4. the edge audit entry.

If validation, the handler, or any write fails, SQLite rolls the whole operation
back. No passive edge insertion path is used by this method.

## Bitemporal queries

```ts
const current = store.queryCurrentTruth({ at: Date.now() });
const past = store.queryHistoricalTruth({ at: Date.UTC(2026, 0, 15) });
const strict = store.queryStrictCandidates({
  at: Date.now(),
  minConfidence: 0.5,
  groundingThreshold: 0.6,
});
```

Current truth excludes closed/superseded/status-inactive rows. Historical truth
uses valid-time independently of current status. Strict candidates add contract,
grounding, confidence, source, duration, and contradiction gates.

## Integrity and corruption

The startup check runs SQLite `quick_check`, verifies every HydroNode content
hash, validates edge payload/index columns and endpoints, and deserializes every
sketch state. It returns an `IntegrityReport` rather than terminating the
process.

Malformed JSON, id mismatches, hash mismatches, dangling edges, and invalid
sketches are reported. Corrupt node/sketch records return `null` and are skipped
from query results, allowing healthy records to remain available.

## Restart and backup

Closing and reopening the same file restores nodes, temporal envelopes,
contracts, facts, and sketches. For operational backups, use SQLite's online
backup API or copy the database only after checkpointing WAL. Do not copy only
the main `.db` file while an active WAL contains uncheckpointed writes.

## Benchmark

The `sqlite` benchmark persists 250 nodes in quick mode (5,000 in full mode),
executes a supersession transaction, verifies current/historical/strict truth,
runs integrity checks, and gates indexed strict-candidate p95 at 25 ms.

```powershell
pnpm exec tsx benchmarks/src/cli.ts --quick --only=sqlite --ci
```
