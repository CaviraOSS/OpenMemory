import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { memory_resource_schema } from '../schemas/resource_schemas.js';
import { assert_node_readable } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

export function register_memory_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('openmemory-memory', new resource_template('openmemory://memory/{node_id}', { list: undefined }), {
        description: 'A permission-scoped memory with provenance and graph explanation', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = memory_resource_schema.parse({ node_id: variable(values, 'node_id') });
        const explanation = await runtime.memory.explain(parsed.node_id);
        if (explanation.node) assert_node_readable(runtime.access, explanation.node);
        return json_resource(uri, explanation);
    });
}