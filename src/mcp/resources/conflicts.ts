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
 *  file  : src/mcp/resources/conflicts.ts
 *  usage : implements the LongMemory conflicts component
 */

import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { project_resource_schema } from '../schemas/resource_schemas.js';
import { resolve_project } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

export function register_conflicts_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('longmemory-project-conflicts', new resource_template('longmemory://project/{project_id}/conflicts', { list: undefined }), {
        description: 'Unresolved project memory contradictions', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = project_resource_schema.parse({ project_id: variable(values, 'project_id') });
        const project_id = resolve_project(runtime.access, parsed.project_id)!;
        const result = await (await runtime.project(project_id)).recallProject(project_id, { text: '', token_budget: 256 }, 'project_historical');
        return json_resource(uri, result.contradictions);
    });
}