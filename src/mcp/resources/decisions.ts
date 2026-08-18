import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { project_resource_schema } from '../schemas/resource_schemas.js';
import { resolve_project } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

export function register_decisions_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('openmemory-project-decisions', new resource_template('openmemory://project/{project_id}/decisions', { list: undefined }), {
        description: 'Project decisions visible to this MCP server', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = project_resource_schema.parse({ project_id: variable(values, 'project_id') });
        const project_id = resolve_project(runtime.access, parsed.project_id)!;
        return json_resource(uri, await (await runtime.project(project_id)).getProjectDecisions(project_id));
    });
}