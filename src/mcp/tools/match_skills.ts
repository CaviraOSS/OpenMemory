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
 *  file  : src/mcp/tools/match_skills.ts
 *  usage : implements the LongMemory match skills component
 */

import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { match_skills_schema } from '../schemas/tool_schemas.js';
import { resolve_agent, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

export function register_match_skills_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('longmemory_match_skills', {
        description: 'Match reusable project Skills for a task and optional agent loadout.',
        inputSchema: match_skills_schema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async (input) => run_audited_tool(runtime, 'longmemory_match_skills', input, async () => {
        const project_id = runtime.resolve_project_id(resolve_project(runtime.access, input.project_id));
        const agent_id = resolve_agent(runtime.access, input.agent_id);
        const manager = await runtime.project(project_id);
        const matches = await manager.matchSkills(project_id, input.query, agent_id, input.limit);
        const loadout = await manager.resolveAssetLoadout(project_id, {
            query: input.query, user_id: runtime.access.user_id, team_ids: [...runtime.access.team_ids], roles: [...runtime.access.roles],
            agent_id, framework: runtime.access.framework ?? undefined, include_unbound: true, asset_types: ['skill'], token_budget: 32_768,
        });
        const governed = new Set(loadout.selected.map((item) => String(item.asset.payload.skill_id ?? '')));
        const known_assets = new Set([...loadout.selected.map((item) => item.asset.asset_id), ...loadout.excluded.map((item) => item.asset_id)]);
        return {
            project_id, query: input.query, agent_id: agent_id ?? null,
            matches: matches.filter((match) => governed.has(match.skill.skill_id) || !known_assets.has(`asset:skill:${match.skill.skill_id}`)),
        };
    }));
}