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
 *  file  : src/mcp/tools/manage_skill.ts
 *  usage : implements the LongMemory manage skill component
 */


import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { manage_skill_schema } from '../schemas/tool_schemas.js';
import { assert_write_allowed, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

const required = (value: string | undefined, name: string): string => {
    if (!value) throw new Error(`${name} is required for this skill action`);
    return value;
};

export function register_manage_skill_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('longmemory_manage_skill', {
        description: 'Create/version, bind, or archive a reusable project Skill.',
        inputSchema: manage_skill_schema,
        annotations: { readOnlyHint: false, destructiveHint: false },
    }, async (input) => run_audited_tool(runtime, 'longmemory_manage_skill', input, async () => {
        assert_write_allowed(runtime.access, 'longmemory_manage_skill');
        const project_id = runtime.resolve_project_id(resolve_project(runtime.access, input.project_id));
        const manager = await runtime.project(project_id);
        if (input.action === 'bind') {
            const skill = await manager.bindSkill(project_id, required(input.skill_id, 'skill_id'), input.agent_ids ?? []);
            return { project_id, action: input.action, skill };
        }
        if (input.action === 'archive') {
            const skill = await manager.archiveSkill(project_id, required(input.skill_id, 'skill_id'));
            return { project_id, action: input.action, skill };
        }
        if (!input.triggers?.length) throw new Error('triggers are required when creating a skill');
        if (!input.instructions?.length) throw new Error('instructions are required when creating a skill');
        const skill = await manager.createSkill(project_id, {
            skill_id: input.skill_id, name: required(input.name, 'name'), description: required(input.description, 'description'),
            triggers: input.triggers, instructions: input.instructions, validation: input.validation, resources: input.resources,
            agent_ids: input.agent_ids, visibility: input.visibility, owner: runtime.access.user_id,
            source_type: 'mcp_skill', source_id: runtime.access.user_id,
        });
        return { project_id, action: input.action, skill };
    }));
}