<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/connectors.md
 usage : documents LongMemory connectors
-->

# Hydrograph connectors

Connectors are ingestion sources for LongMemory Hydrograph. They are not vector loaders, generic RAG pipelines, or authorities that silently overwrite memory.

A connector discovers external items, fetches normalized documents or events, and produces a `HydrographImportPlan`. It never writes memory directly. The shared `createMemory` facade validates and atomically applies the plan through recursive worlds, entity resolution, contracts, grounding, bitemporal MVCC, executable edge handlers, indexes, sketches, and persistence.

## Connector architecture

Connectors contain an internal transport for authentication, listing, fetching, pagination, retries, and file analysis. Transport modules live under `src/connectors/transports` and are not a second public ingestion API.

The connector layer adds Hydrograph semantics:

- External identity and versioning
- Structured worlds, nodes, and executable edges
- Entity mentions
- Source permissions and memory contracts
- Bitemporal validity and update supersession
- Grounding and citation provenance
- Cursor and checksum state
- Deletion history
- Atomic plan execution

All public external ingestion goes through connectors and `sync_connector`. The former `src/sources` subsystem and direct `ingest_source` path were removed so external data cannot bypass plans, permissions, cursors, or atomic Hydrograph execution.

## Connector interface

```ts
interface Connector {
  readonly id: string;
  readonly name: string;
  readonly source_type: string;

  connect(config): Promise<void>;
  testConnection(): Promise<boolean>;

  listSources(params?): Promise<SourceRef[]>;
  fetchSource(ref): Promise<SourceDocument | SourceEvent>;
  sync(params): AsyncIterable<ConnectorSyncItem>;

  getCursor(): Promise<SyncCursor | null>;
  setCursor(cursor): Promise<void>;

  mapToHydrograph(item, context): Promise<HydrographImportPlan>;
}
```

`SourceRef` identifies a video, repository, issue, pull request, commit, document, page, message, file, or folder without assuming its full content has been fetched.

`SourceDocument` records source type, external ID, URL, title, author, source timestamps, fetch time, content, metadata, permissions, version, and checksum.

`ConnectorSyncItem` labels the source transition as `created`, `updated`, `deleted`, `unchanged`, `permission_changed`, `moved`, or `renamed`.

## Import plans

A plan contains only declarative operations:

```ts
type HydrographImportPlan = {
  nodes_to_create: planned_node[];
  edges_to_create: planned_edge[];
  worlds_to_create: planned_world[];
  entities_to_resolve: EntityMention[];
  grounding_refs: grounding_ref[];
  contracts: planned_contract[];
  provenance: connector_provenance[];
  deletion_or_supersession_actions: action[];
};
```

Every planned node must include connector/source identity, external ID, recorded time, version, checksum, permission, contract, provenance, world key, valid/observed time, and grounding source.

`memory.applyImportPlan(plan)` is the only commit boundary. It:

1. Snapshots the graph, worlds, resolver, world DB, recall index, sketches, and working memory.
2. Creates or reuses recursive worlds by connector key.
3. Resolves every planned entity through the shared resolver.
4. Ingests every planned node through `IngestEngine`.
5. Executes every planned edge through the registered edge handler.
6. Converts updates and deletions into supersession chains.
7. Persists nodes, edges, worlds, entities, grounding facts, and sketches in one SQLite transaction.
8. Restores all in-memory state and rolls back SQLite if any operation fails.

Connectors cannot bypass contracts, bitemporal validity, entity resolution, edge handlers, or persistence integrity.

## Mapping rules

- Connector data defaults to the exocortex.
- Source-created and source-updated timestamps map to valid and observed time; fetch/application time maps to recorded time.
- Updates create new immutable node identities and `supersedes` edges.
- Deletions create a non-reasoning source-deleted tombstone that supersedes historical nodes. They never erase history by default.
- Large documents become root/section nodes with `contains` edges. Markdown headings, code fences, lines, document IDs, versions, timestamps, paths, and citations are preserved.
- External data requiring freshness sets `expires_if_unconfirmed` and `source_required`.
- Every imported node has connector provenance and a source-backed grounding fact.
- Stable source checksums prevent unchanged items from being re-imported.

## Permissions

Connector permissions are persisted inside the memory contract:

- `public`
- `private`
- `project`
- `team`
- `user_only`
- `source_restricted`

Restricted permissions may name allowed user, team, project, or source IDs. Strict, historical, associative, and world-grounded recall all check permission context before admitting candidates.

```ts
const result = await memory.recall({
  text: "deployment plan",
  mode: "strict",
  permission_context: {
    user_id: "user:alice",
    team_ids: ["team:platform"],
    project_ids: ["project:longmemory"],
    source_ids: ["github"],
  },
});
```

Connector-imported restricted data is denied when permission context is absent. Existing non-connector memories retain their previous behavior because their `source_permission` is `null`.

## Sync lifecycle

```ts
import { createMemory, local_file_connector, sync_connector } from "longmemory";

const memory = await createMemory({
  store: "sqlite",
  db_path: "./longmemory.db",
});

const connector = new local_file_connector({ root: "./docs" });
await connector.connect();

const report = await sync_connector(connector, memory, {
  mode: "incremental",
  retry_failed: 2,
});
```

Full sync starts with an empty item-state cursor. Incremental sync resumes from `getCursor()`, compares checksums, and emits only source transitions. The cursor stores checksum, version, resulting node IDs, sync time, deletion state, and source position.

The sync report records discovered event counts, applied plans, node/edge/world IDs, failures, plans, timestamps, and the resulting cursor.

Dry-run maps and reports every change but never calls `applyImportPlan` and never advances the cursor:

```ts
const preview = await sync_connector(connector, memory, {
  mode: "incremental",
  dry_run: true,
});
```

Failed items are retried independently. A failed plan rolls back its complete transaction without corrupting successful prior items.

## Connector catalog

| Connector     | Status                      | Hydrograph mapping                                                                                              |
| ------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GitHub        | Real starter                | Project world, repository/docs, issues/comments, PR decisions, commits, files, fixes/modifies/grounds relations |
| Local folders | Real starter                | Folder worlds, Markdown/text/JSON documents, paths, modified time, checksums, structural sections               |
| Markdown      | Real starter                | Markdown-only local discovery, headings, sections, code fences, line citations                                  |
| Websites      | Real starter                | Pages, structural sections, links, ETags, modified time, freshness contracts                                    |
| Sitemap       | Real starter                | Sitemap discovery followed by structured page plans                                                             |
| RSS / Atom    | Real starter                | Feeds, entries, linked pages, publication times, incremental checksums                                          |
| YouTube       | Metadata/transcript starter | Video world, video metadata, timestamped segments, contains edges, channels, speakers, topics, timestamp URLs   |
| Docs          | Structural mock starter     | Document world, heading sections, versions/checksums, section citations, update supersession                    |

The unified registry contains 50 connector definitions. Configurable remote connectors use the same paginated REST transport and plan lifecycle while allowing tenant URLs, API versions, field mappings, cursors, headers, and token environment variables to be supplied at construction:

- Code: GitLab, Bitbucket, Azure DevOps, Gitea, Forgejo, Codeberg
- Cloud storage: Google Drive, OneDrive, SharePoint, Dropbox, Box, Amazon S3
- Knowledge: Google Docs, Sheets, Slides, Notion, Confluence, Coda, Obsidian Sync gateways
- Project systems: Jira, Linear, Asana, Trello, monday.com, ClickUp
- Communication and support: Slack, Discord, Microsoft Teams, Zendesk, Intercom, Freshdesk
- Data systems: Airtable, PostgreSQL, MySQL, SQLite, MongoDB, Redis, Salesforce, HubSpot

PDF and email remain explicit mock/design connectors until page extraction and mail transport are implemented. They still exercise the plan, permission, cursor, dry-run, and rollback lifecycle without claiming complete remote support. `generic_api` is a configurable connector rather than a mock.

## GitHub mapping

The GitHub connector owns a deep GitHub transport internally:

- Repository becomes a project world.
- Directories may become nested path worlds.
- README and docs become document nodes.
- Issue comments are child nodes connected with `contains`.
- PRs become decision/change nodes and references such as `Fixes #12` produce executable support edges.
- Commits become procedural code-change nodes and modified files receive `refers_to` edges carrying status/addition/deletion metadata.
- README grounds a stable project-description node.
- Commit hashes, branches, file paths, URLs, source timestamps, and API payloads remain in metadata/provenance.

## YouTube mapping

YouTube documents carry video metadata and a transcript array. The mapper creates:

- A video world and root metadata node.
- One node per transcript segment.
- `contains` edges from video to segments.
- Channel, speaker, and topic entity mentions.
- Start/duration metadata and timestamp URLs such as `?t=120s`.

The starter accepts mock documents so mapping can be developed and tested without network/API-key dependencies. A future remote transport can implement listing/fetching without changing the mapper.

## Adding a connector

1. Implement `Connector` or extend the transport-backed connector base.
2. Put reusable remote/local transport under `src/connectors/transports`; do not expose a parallel ingestion API.
3. Normalize fetched content into `SourceDocument` or `SourceEvent`.
4. Persist checksum/version state in `SyncCursor`.
5. Write a pure mapper returning `HydrographImportPlan`.
6. Include permissions, contracts, provenance, grounding, worlds, entities, and temporal fields on every planned node.
7. Use structural splitting and explicit `contains` edges for large documents.
8. Emit supersession/deletion actions rather than mutating or deleting old nodes.
9. Register a factory with `ConnectorRegistry`.
10. Test created, updated, unchanged, deleted, permission, cursor, dry-run, and rollback paths.

Do not call SQLite, vector storage, graph mutation, or `memory.ingest` from connector implementations. Only the facade plan executor may commit connector data.
