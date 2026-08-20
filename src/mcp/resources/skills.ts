import { ResourceTemplate as resource_template } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { project_resource_schema } from '../schemas/resource_schemas.js';
import { resolve_project } from '../security/permissions.js';
import { json_resource, variable } from './common.js';

export function register_skills_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('openmemory-project-skills', new resource_template('openmemory://project/{project_id}/skills', { list: undefined }), {
        description: 'Current reusable Skills and agent bindings for a project', mimeType: 'application/json',
    }, async (uri, values) => {
        const parsed = project_resource_schema.parse({ project_id: variable(values, 'project_id') });
        const project_id = resolve_project(runtime.access, parsed.project_id)!;
        const manager = await runtime.project(project_id);
        const skills = [];
        for (const skill of await manager.listSkills(project_id)) {
            const asset = await manager.getAsset(project_id, `asset:skill:${skill.skill_id}`);
            if (!asset) { skills.push(skill); continue; }
            const decision = await manager.decideAssetAccess(project_id, asset.asset_id, {
                user_id: runtime.access.user_id, team_ids: [...runtime.access.team_ids], roles: [...runtime.access.roles],
                agent_id: runtime.access.agent_id ?? undefined, framework: runtime.access.framework ?? undefined,
            }, 'read');
            if (decision.allowed) skills.push(skill);
        }
        return json_resource(uri, skills);
    });
}