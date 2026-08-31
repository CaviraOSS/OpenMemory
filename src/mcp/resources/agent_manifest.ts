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
 *  file  : src/mcp/resources/agent_manifest.ts
 *  usage : implements the LongMemory agent manifest component
 */


import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { project_resource_schema } from '../schemas/resource_schemas.js';
import { resolve_agent, resolve_project } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

export function register_agent_manifest_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('longmemory-agent-memory-manifest', new resource_template('longmemory://project/{project_id}/agent/{agent_id}/manifest', { list: undefined }), {
        description: 'Authenticated, framework-portable LongMemory asset manifest for one agent', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = project_resource_schema.parse({ project_id: variable(values, 'project_id') });
        const project_id = resolve_project(runtime.access, parsed.project_id)!;
        const agent_id = resolve_agent(runtime.access, variable(values, 'agent_id'))!;
        const manager = await runtime.project(project_id);
        return json_resource(uri, await manager.buildAgentManifest(project_id, {
            agent_id, framework: runtime.access.framework ?? undefined, user_id: runtime.access.user_id,
            team_ids: [...runtime.access.team_ids], roles: [...runtime.access.roles], query: 'current project work',
            include_unbound: false, token_budget: 2_048,
        }));
    });
}