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
 *  file  : src/mcp/tools/manage_asset.ts
 *  usage : implements the LongMemory manage asset component
 */

import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { memory_asset_input } from '../../core/project/project_assets.js';
import type { mcp_runtime } from '../runtime.js';
import { manage_asset_schema } from '../schemas/tool_schemas.js';
import { assert_write_allowed, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

const required = (value: string | undefined, name: string): string => {
    if (!value) throw new Error(`${name} is required for this asset action`);
    return value;
};

export function register_manage_asset_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('longmemory_manage_asset', {
        description: 'Register or govern a versioned memory asset. Sensitive writes remain auditable and read-only servers reject this tool.',
        inputSchema: manage_asset_schema,
        annotations: { readOnlyHint: false, destructiveHint: false },
    }, async (input) => run_audited_tool(runtime, 'longmemory_manage_asset', input, async () => {
        assert_write_allowed(runtime.access, 'longmemory_manage_asset');
        const project_id = runtime.resolve_project_id(resolve_project(runtime.access, input.project_id));
        const manager = await runtime.project(project_id);
        if (input.action === 'govern') {
            const asset_id = required(input.asset_id, 'asset_id');
            const decision = await manager.decideAssetAccess(project_id, asset_id, { user_id: runtime.access.user_id, team_ids: [...runtime.access.team_ids], roles: [...runtime.access.roles], agent_id: runtime.access.agent_id ?? undefined, framework: runtime.access.framework ?? undefined }, 'manage');
            if (!decision.allowed) throw new Error(`permission denied for asset ${asset_id}: ${decision.reason}`);
            const asset = await manager.governAsset(project_id, asset_id, {
                ...input,
                bindings: input.bindings?.map((binding) => ({
                    ...binding, required: binding.required ?? false, enabled: binding.enabled ?? true,
                    created_by: binding.created_by ?? runtime.access.user_id,
                })),
            });
            return { project_id, action: input.action, asset };
        }
        const asset = await manager.registerAsset(project_id, {
            asset_id: input.asset_id, type: input.type as memory_asset_input['type'], name: required(input.name, 'name'),
            description: required(input.description, 'description'), owner_id: runtime.access.user_id,
            source_type: required(input.source_type, 'source_type'), source_ref: input.source_ref,
            content_ref: required(input.content_ref, 'content_ref'), status: input.status, visibility: input.visibility,
            team_ids: input.team_ids, acl: input.acl, bindings: input.bindings?.map((binding) => ({ ...binding, required: binding.required ?? false, enabled: binding.enabled ?? true, created_by: binding.created_by ?? runtime.access.user_id })),
            confidence: input.confidence, expires_at: input.expires_at, labels: input.labels, payload: input.payload, metadata: input.metadata,
        });
        return { project_id, action: input.action, asset };
    }));
}