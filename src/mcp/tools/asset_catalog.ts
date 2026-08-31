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
 *  file  : src/mcp/tools/asset_catalog.ts
 *  usage : implements the LongMemory asset catalog component
 */


import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import { asset_catalog_schema } from '../schemas/tool_schemas.js';
import type { mcp_runtime } from '../runtime.js';
import { resolve_agent, resolve_framework, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

const required = (value: string | undefined, name: string): string => {
    if (!value) throw new Error(`${name} is required for this asset catalog action`);
    return value;
};

export function register_asset_catalog_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('longmemory_asset_catalog', {
        description: 'Discover governed Chat Memory, Skill, LLM-Wiki, and Code-Graph assets or assemble an explainable agent loadout.',
        inputSchema: asset_catalog_schema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async (input) => run_audited_tool(runtime, 'longmemory_asset_catalog', input, async () => {
        const project_id = runtime.resolve_project_id(resolve_project(runtime.access, input.project_id));
        const manager = await runtime.project(project_id);
        const access = {
            user_id: runtime.access.user_id, team_ids: [...runtime.access.team_ids], roles: [...runtime.access.roles],
            agent_id: resolve_agent(runtime.access, input.agent_id), task_id: input.task_id,
            framework: resolve_framework(runtime.access, input.framework),
        };
        if (input.action === 'loadout') return manager.resolveAssetLoadout(project_id, {
            ...access, query: required(input.query, 'query'), include_unbound: input.include_unbound,
            asset_types: input.asset_types, token_budget: input.token_budget,
        });
        if (input.action === 'get') {
            const asset_id = required(input.asset_id, 'asset_id');
            const asset = await manager.getAsset(project_id, asset_id);
            if (!asset) throw new Error(`asset ${asset_id} was not found or is not accessible`);
            const decision = await manager.decideAssetAccess(project_id, asset_id, access, 'read');
            if (!decision.allowed) throw new Error(`asset ${asset_id} was not found or is not accessible`);
            return { project_id, asset, access: decision };
        }
        const assets = await manager.listAssets(project_id);
        const visible = [];
        for (const asset of assets) {
            const decision = await manager.decideAssetAccess(project_id, asset.asset_id, access, 'read');
            if (decision.allowed) visible.push(asset);
        }
        return { project_id, assets: visible };
    }));
}