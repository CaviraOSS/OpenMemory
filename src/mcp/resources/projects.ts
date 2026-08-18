import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { json_resource } from './common.js';

export function register_projects_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('openmemory-projects', 'openmemory://projects', {
        description: 'Projects visible to the configured MCP scope', mimeType: 'application/json',
    }, async (uri) => json_resource(uri, await runtime.list_projects()));
}