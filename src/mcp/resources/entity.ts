import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { entity_resource_schema } from '../schemas/resource_schemas.js';
import { assert_world_readable } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

export function register_entity_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('openmemory-entity', new resource_template('openmemory://entity/{entity_id}', { list: undefined }), {
        description: 'A permission-scoped resolved entity', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = entity_resource_schema.parse({ entity_id: variable(values, 'entity_id') });
        const entity = await runtime.memory.getEntity(parsed.entity_id);
        if (!entity) return json_resource(uri, null);
        const worlds = (await Promise.all(entity.world_ids.map((id) => runtime.memory.getWorld(id)))).filter((world) => world !== null);
        const visible = worlds.filter((world) => {
            try { assert_world_readable(runtime.access, world); return true; } catch { return false; }
        });
        if (runtime.access.project_id && !visible.length) throw new Error(`permission denied for entity: ${entity.id}`);
        return json_resource(uri, { ...entity, world_ids: visible.map((world) => world.id) });
    });
}