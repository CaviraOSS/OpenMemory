<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/mcp.md
 usage : documents LongMemory mcp
-->

# MCP integration

LongMemory exposes one high-level Model Context Protocol server over the same
`createMemory` engine used by the package, CLI, REST API, projects, and
connectors. It supports local stdio and remote Streamable HTTP transports.

## Local stdio

```powershell
longmemory mcp --db .longmemory/project.db --project current
```

An MCP client can launch the same command directly:

```json
{
  "mcpServers": {
    "longmemory": {
      "command": "longmemory",
      "args": ["mcp", "--db", ".longmemory/project.db", "--project", "current"]
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
longmemory serve --db ./longmemory.db --mcp-http
```

The endpoint is `http://127.0.0.1:7331/mcp`. REST and MCP share one in-process
memory engine. When `LONGMEMORY_API_KEY` is set, MCP requires the same bearer
token or `X-API-Key` as `/v1/*`. `LONGMEMORY_MCP_HTTP=true` also enables it for
`pnpm serve`.

## Tools

The deny-by-default allowlist contains exactly thirteen high-level tools:

- `longmemory_project_context`
- `longmemory_recall`
- `longmemory_ingest`
- `longmemory_remember_decision`
- `longmemory_update_task_state`
- `longmemory_explain`
- `longmemory_report_conflicts`
- `longmemory_sync_connector`
- `longmemory_match_skills`
- `longmemory_manage_skill`
- `longmemory_code_graph`
- `longmemory_asset_catalog`
- `longmemory_manage_asset`

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

- `longmemory://projects`
- `longmemory://project/{project_id}/summary`
- `longmemory://project/{project_id}/current-context`
- `longmemory://project/{project_id}/decisions`
- `longmemory://project/{project_id}/tasks`
- `longmemory://project/{project_id}/skills`
- `longmemory://project/{project_id}/assets`
- `longmemory://project/{project_id}/asset/{asset_id}`
- `longmemory://project/{project_id}/agent/{agent_id}/manifest`
- `longmemory://project/{project_id}/conflicts`
- `longmemory://entity/{entity_id}`
- `longmemory://world/{world_id}`
- `longmemory://memory/{node_id}`

Direct memory, entity, and world reads enforce configured user and project
scope. Denied candidates are removed from MCP diagnostic traces as well as
result items.

## Prompts

- `longmemory_before_coding`
- `longmemory_after_coding`
- `longmemory_debug_session`
- `longmemory_project_handoff`
- `longmemory_architecture_context`

Prompts never interpolate connector content as instructions. Retrieved memory
must remain delimited as untrusted `<longmemory-data>` evidence.

## Programmatic server

```ts
import { create_longmemory_mcp } from "longmemory";

const { server, runtime } = create_longmemory_mcp({
  db_path: "./longmemory.db",
  project_id: "longmemory",
  user_id: "agent:local",
  read_only: true,
});
```

`allowed_tools` can reduce the advertised tools. Unknown names are rejected at
startup, and omitted tools are not registered.
