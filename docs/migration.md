<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/migration.md
 usage : documents LongMemory migration
-->

# Legacy migration

Phase 22 migrates useful memory into Hydrograph form. It does not preserve the legacy storage architecture, indexes, cache state, or malformed data.

## Run a migration

```bash
longmemory migrate \
  --from ./legacy.db \
  --to ./longmemory.db \
  --report ./migration-report.json \
  --pretty
```

`--report` is optional. The default report path is `<destination>.migration-report.json`.

Migration never overwrites an existing destination and never prompts. The report is written to disk and returned as JSON on stdout, which makes the command safe for CI, Codex, Claude Code, and shell pipelines.

## Supported sources

The reader accepts:

- Legacy SQLite databases with a `memories`, `memory`, or `records` table.
- Legacy relation tables named `waypoints`, `relations`, or `edges`.
- JSON arrays of memory records.
- JSON objects containing `memories` or `records` plus optional `relations`, `waypoints`, or `edges`.
- JSONL exports with one memory record per line.
- Current Hydrograph SQLite databases, which use SQLite online backup and current schema migrations.

The historical SQLite fields recognized by the cleaner include `id`, `user_id`, `project_id`, `segment`, `content`, `primary_sector`, `tags`, `meta`, `created_at`, `updated_at`, `last_seen_at`, `valid_from`, and `valid_to`. Common aliases such as `text`, `sector`, `timestamp`, `status`, and `current` are also accepted.

## Conservative cleaning

Each record is evaluated independently before ingest:

1. Non-object records are skipped.
2. Records without usable text are skipped.
3. Symbol-only garbage and payloads above 1 MiB are skipped.
4. Timestamps accept epoch seconds, epoch milliseconds, and ISO dates.
5. Exact normalized duplicates are collapsed to one canonical record.
6. Current duplicate versions take precedence over stale versions.
7. Every skipped record receives a stable record identifier and reason.

A malformed JSONL line does not abort neighboring records. Its line number and parse failure are included in `skipped_records`.

## Hydrograph mapping

Cleaned records are ingested in observed-time order through the public `createMemory` facade:

| Legacy input                              | Hydrograph result                                                  |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Stable fact or preference                 | Semantic facet                                                     |
| Personal event or long episode            | Episodic facet                                                     |
| Procedure or workflow sector              | Procedural facet                                                   |
| Emotional sector                          | Emotional facet                                                    |
| Reflection sector                         | Reflective facet                                                   |
| Project or sector context                 | Child world                                                        |
| Changed preference                        | `supersedes` edge and bitemporal closure                           |
| Conflicting factual claim                 | `contradicts` edge                                                 |
| Exact duplicate                           | Canonical merge candidate in the report; no repeated strict node   |
| Source-backed external fact               | Exocortex node and grounded fact                                   |
| Stale, archived, deleted, or expired fact | Closed valid-time, available historically but not in strict recall |

Repeated non-identical legacy observations remain eligible for the existing consolidation engine. Exact duplicates are removed before ingest because they carry no additional memory content.

Legacy relations use executable Hydrograph handlers when possible. Supported relation names include `same_as`, `supports`, `contradicts`, `supersedes`, `derived_from`, `grounds`, `contains`, `semantic_shift`, and `refers_to`. Common aliases are normalized; unknown but valid endpoint relations become `refers_to`. Relations with missing or deduplicated endpoints are omitted and reported.

An external-looking record without source identity is not promoted into the exocortex. It remains a subjective memory rather than receiving fabricated grounding.

## Migration report

The report contains:

- `imported_nodes` and `imported_node_ids`
- `imported_edges` and `imported_edge_ids`
- `created_worlds` and `created_world_ids`
- `created_entities` and `created_entity_ids`
- `detected_duplicates`
- `contradictions_found`
- `skipped_records`
- `errors`
- `benchmark_result`

`detected_duplicates` identifies both the discarded record and its canonical record. `skipped_records` is the authoritative audit of rejected input. `errors` contains relation failures and record ingest failures that did not abort the rest of the migration.

## Post-migration benchmark

Every migration runs a destination smoke benchmark before returning. It checks:

1. SQLite and HydroNode integrity.
2. Hydration of an imported node through `createMemory`.
3. Persisted node counts.

The command still writes the report when individual records are skipped. Check `benchmark_result.passed` before promoting the destination database.

```powershell
$result = longmemory migrate --from ./legacy.jsonl --to ./longmemory.db | ConvertFrom-Json
if (-not $result.benchmark_result.passed) { exit 1 }
```
