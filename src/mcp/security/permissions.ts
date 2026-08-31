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
 *  file  : src/mcp/security/permissions.ts
 *  usage : implements the LongMemory permissions component
 */


import type { GateContext } from '../../core/types/recall_mode.js';
import type { HydroNode } from '../../core/types/hydro_node.js';
import type { World } from '../../core/types/world.js';
import type { mcp_tool_name } from './tool_allowlist.js';

export type mcp_access = {
    user_id: string;
    project_id: string | null;
    team_ids: readonly string[];
    roles: readonly string[];
    agent_id: string | null;
    framework: string | null;
    read_only: boolean;
    allowed_tools: ReadonlySet<mcp_tool_name>;
};

export function resolve_agent(access: mcp_access, requested?: string): string | undefined {
    if (access.agent_id && requested && requested !== access.agent_id) throw new Error(`permission denied for agent: ${requested}`);
    return requested ?? access.agent_id ?? undefined;
}

export function resolve_framework(access: mcp_access, requested?: string): string | undefined {
    if (access.framework && requested && requested.toLocaleLowerCase() !== access.framework.toLocaleLowerCase()) throw new Error(`permission denied for framework: ${requested}`);
    return requested ?? access.framework ?? undefined;
}

export function assert_tool_allowed(access: mcp_access, tool: mcp_tool_name): void {
    if (!access.allowed_tools.has(tool)) throw new Error(`MCP tool is not allowed: ${tool}`);
}

export function assert_write_allowed(access: mcp_access, tool: mcp_tool_name): void {
    assert_tool_allowed(access, tool);
    if (access.read_only) throw new Error(`MCP server is read-only; ${tool} is blocked`);
}

export function resolve_user(access: mcp_access, requested?: string): string {
    if (requested && requested !== access.user_id) throw new Error(`permission denied for user: ${requested}`);
    return access.user_id;
}

export function resolve_project(access: mcp_access, requested?: string): string | null {
    const project_id = requested ?? access.project_id;
    if (access.project_id && project_id !== access.project_id) throw new Error(`permission denied for project: ${project_id ?? 'none'}`);
    return project_id;
}

export function recall_permission(access: mcp_access, user_id?: string, project_id?: string): NonNullable<GateContext['permission_context']> {
    const resolved_project = resolve_project(access, project_id);
    return {
        user_id: resolve_user(access, user_id),
        project_ids: resolved_project ? [resolved_project] : [],
        allow_private: false,
    };
}

export function assert_node_readable(access: mcp_access, node: HydroNode): void {
    const project_id = typeof node.metadata.project_id === 'string' ? node.metadata.project_id : null;
    if (access.project_id && project_id !== access.project_id) throw new Error(`permission denied for memory: ${node.id}`);
    const permission = node.contract.source_permission;
    if (!permission || permission.scope === 'public') return;
    if (permission.user_ids.includes(access.user_id)) return;
    if (project_id && permission.project_ids.includes(project_id) && (!access.project_id || access.project_id === project_id)) return;
    throw new Error(`permission denied for memory: ${node.id}`);
}

export function assert_world_readable(access: mcp_access, world: World): void {
    const project_id = typeof world.metadata.project_id === 'string' ? world.metadata.project_id : null;
    if (access.project_id && project_id !== access.project_id) throw new Error(`permission denied for world: ${world.id}`);
}