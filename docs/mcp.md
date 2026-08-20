# MCP integration

OpenMemory exposes one high-level Model Context Protocol server over the same
`createMemory` engine used by the package, CLI, REST API, projects, and
connectors. It supports local stdio and remote Streamable HTTP transports.

## Local stdio

```powershell
openmemory mcp --db .openmemory/project.db --project current
```

An MCP client can launch the same command directly:

```json
{
  "mcpServers": {
    "openmemory": {
      "command": "openmemory",
      "args": ["mcp", "--db", ".openmemory/project.db", "--project", "current"]
    }
  }
}
```

The stdio command writes only MCP protocol messages to stdout. Use
`--read-only` to open an existing SQLite database without migrations or writes.
Use `--audit <path>` to override the default
`<database>.mcp-audit.jsonl` path.

## Streamable HTTP

```powershell
openmemory serve --db ./openmemory.db --mcp-http
```

The endpoint is `http://127.0.0.1:7331/mcp`. REST and MCP share one in-process
memory engine. When `OPENMEMORY_API_KEY` is set, MCP requires the same bearer
token or `X-API-Key` as `/v1/*`. `OPENMEMORY_MCP_HTTP=true` also enables it for
`pnpm serve`.

## Tools

The deny-by-default allowlist contains exactly thirteen high-level tools:

- `openmemory_project_context`
- `openmemory_recall`
- `openmemory_ingest`
- `openmemory_remember_decision`
- `openmemory_update_task_state`
- `openmemory_explain`
- `openmemory_report_conflicts`
- `openmemory_sync_connector`
- `openmemory_match_skills`
- `openmemory_manage_skill`
- `openmemory_code_graph`
- `openmemory_asset_catalog`
- `openmemory_manage_asset`

Recall delegates to Hydrograph modes and their temporal, contract,
contradiction, grounding, confidence, world, and permission gates. Connector
sync defaults to `dry_run: true`. Read-only mode rejects write-capable tools.
Skill matching can filter an agent loadout; Skill management creates immutable
versions, bindings, or archive versions. CodeGraph is read-only and provides
symbol search, callers, callees, and reverse impact paths from persisted source
snapshots.

Asset catalog calls discover governed Chat Memory, Skill, LLM-Wiki, and
CodeGraph records or assemble a target-specific loadout. Asset management is a
write tool, requires owner or explicit `manage` ACL, and is blocked by MCP
read-only mode. Runtime configuration fixes user/team/role/agent/framework
identity; tool arguments cannot impersonate another configured agent.

## Resources

- `openmemory://projects`
- `openmemory://project/{project_id}/summary`
- `openmemory://project/{project_id}/current-context`
- `openmemory://project/{project_id}/decisions`
- `openmemory://project/{project_id}/tasks`
- `openmemory://project/{project_id}/skills`
- `openmemory://project/{project_id}/assets`
- `openmemory://project/{project_id}/asset/{asset_id}`
- `openmemory://project/{project_id}/agent/{agent_id}/manifest`
- `openmemory://project/{project_id}/conflicts`
- `openmemory://entity/{entity_id}`
- `openmemory://world/{world_id}`
- `openmemory://memory/{node_id}`

Direct memory, entity, and world reads enforce configured user and project
scope. Denied candidates are removed from MCP diagnostic traces as well as
result items.

## Prompts

- `openmemory_before_coding`
- `openmemory_after_coding`
- `openmemory_debug_session`
- `openmemory_project_handoff`
- `openmemory_architecture_context`

Prompts never interpolate connector content as instructions. Retrieved memory
must remain delimited as untrusted `<openmemory-data>` evidence.

## Programmatic server

```ts
import { create_openmemory_mcp } from "openmemory";

const { server, runtime } = create_openmemory_mcp({
  db_path: "./openmemory.db",
  project_id: "openmemory",
  user_id: "agent:local",
  read_only: true,
});
```

`allowed_tools` can reduce the advertised tools. Unknown names are rejected at
startup, and omitted tools are not registered.
