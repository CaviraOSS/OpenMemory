export const mcp_tool_names = [
    'openmemory_project_context',
    'openmemory_recall',
    'openmemory_ingest',
    'openmemory_remember_decision',
    'openmemory_update_task_state',
    'openmemory_explain',
    'openmemory_report_conflicts',
    'openmemory_sync_connector',
    'openmemory_match_skills',
    'openmemory_manage_skill',
    'openmemory_code_graph',
    'openmemory_asset_catalog',
    'openmemory_manage_asset',
] as const;

export type mcp_tool_name = typeof mcp_tool_names[number];

export function create_tool_allowlist(names: readonly string[] = mcp_tool_names): ReadonlySet<mcp_tool_name> {
    const known = new Set<string>(mcp_tool_names);
    const invalid = names.filter((name) => !known.has(name));
    if (invalid.length) throw new Error(`unknown MCP tool in allowlist: ${invalid[0]}`);
    return new Set(names as readonly mcp_tool_name[]);
}