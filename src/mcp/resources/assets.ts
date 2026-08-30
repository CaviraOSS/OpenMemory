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
 *  file  : src/mcp/resources/assets.ts
 *  usage : implements the LongMemory assets component
 */

import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { project_resource_schema } from '../schemas/resource_schemas.js';
import { resolve_project } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

const access = (runtime: mcp_runtime) => ({
    user_id: runtime.access.user_id, team_ids: [...runtime.access.team_ids], roles: [...runtime.access.roles],
    agent_id: runtime.access.agent_id ?? undefined, framework: runtime.access.framework ?? undefined,
});

export function register_assets_resources(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('longmemory-project-assets', new resource_template('longmemory://project/{project_id}/assets', { list: undefined }), {
        description: 'Governed memory assets visible to this MCP identity', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = project_resource_schema.parse({ project_id: variable(values, 'project_id') });
        const project_id = resolve_project(runtime.access, parsed.project_id)!;
        const manager = await runtime.project(project_id);
        const assets = [];
        for (const asset of await manager.listAssets(project_id)) if ((await manager.decideAssetAccess(project_id, asset.asset_id, access(runtime), 'read')).allowed) assets.push(asset);
        return json_resource(uri, assets);
    });
    server.registerResource('longmemory-project-asset', new resource_template('longmemory://project/{project_id}/asset/{asset_id}', { list: undefined }), {
        description: 'One governed memory asset with policy and binding metadata', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = project_resource_schema.parse({ project_id: variable(values, 'project_id') });
        const project_id = resolve_project(runtime.access, parsed.project_id)!;
        const asset_id = variable(values, 'asset_id');
        const manager = await runtime.project(project_id);
        const asset = await manager.getAsset(project_id, asset_id);
        if (!asset) throw new Error(`asset ${asset_id} was not found or is not accessible`);
        const decision = await manager.decideAssetAccess(project_id, asset_id, access(runtime), 'read');
        if (!decision.allowed) throw new Error(`asset ${asset_id} was not found or is not accessible`);
        return json_resource(uri, { asset, access: decision });
    });
}