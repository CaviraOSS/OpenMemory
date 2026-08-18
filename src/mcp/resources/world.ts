import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { world_resource_schema } from '../schemas/resource_schemas.js';
import { assert_world_readable } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

export function register_world_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('openmemory-world', new resource_template('openmemory://world/{world_id}', { list: undefined }), {
        description: 'A permission-scoped recursive world', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = world_resource_schema.parse({ world_id: variable(values, 'world_id') });
        const world = await runtime.memory.getWorld(parsed.world_id);
        if (world) assert_world_readable(runtime.access, world);
        return json_resource(uri, world);
    });
}