import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { project_resource_schema } from '../schemas/resource_schemas.js';
import { resolve_project } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

export function register_project_context_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('openmemory-project-current-context', new resource_template('openmemory://project/{project_id}/current-context', { list: undefined }), {
        description: 'Token-budgeted current project context', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = project_resource_schema.parse({ project_id: variable(values, 'project_id') });
        const project_id = resolve_project(runtime.access, parsed.project_id)!;
        const manager = await runtime.project(project_id);
        return json_resource(uri, await manager.getProjectContext(project_id, 'current project work', 2048));
    });
}