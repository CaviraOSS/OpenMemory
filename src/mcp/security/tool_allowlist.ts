/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/mcp/security/tool_allowlist.ts
 *  usage : implements the LongMemory tool allowlist component
 */


export const mcp_tool_names = [
    'longmemory_project_context',
    'longmemory_recall',
    'longmemory_ingest',
    'longmemory_remember_decision',
    'longmemory_update_task_state',
    'longmemory_explain',
    'longmemory_report_conflicts',
    'longmemory_sync_connector',
    'longmemory_match_skills',
    'longmemory_manage_skill',
    'longmemory_code_graph',
    'longmemory_asset_catalog',
    'longmemory_manage_asset',
] as const;

export type mcp_tool_name = typeof mcp_tool_names[number];

export function create_tool_allowlist(names: readonly string[] = mcp_tool_names): ReadonlySet<mcp_tool_name> {
    const known = new Set<string>(mcp_tool_names);
    const invalid = names.filter((name) => !known.has(name));
    if (invalid.length) throw new Error(`unknown MCP tool in allowlist: ${invalid[0]}`);
    return new Set(names as readonly mcp_tool_name[]);
}