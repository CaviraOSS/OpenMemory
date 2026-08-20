import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { project_context_schema } from '../schemas/tool_schemas.js';
import { resolve_agent, resolve_framework, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

export function register_project_context_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('openmemory_project_context', {
        description: 'Return token-budgeted, permission-scoped context for coding, debugging, planning, or review.',
        inputSchema: project_context_schema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async (input) => run_audited_tool(runtime, 'openmemory_project_context', input, async () => {
        const project_id = runtime.resolve_project_id(resolve_project(runtime.access, input.project_id));
        const manager = await runtime.project(project_id);
        const packet = await manager.getProjectContext(
            project_id, `${input.mode}: ${input.task}`, input.token_budget,
            resolve_agent(runtime.access, input.agent_id), resolve_framework(runtime.access, input.framework),
            { user_id: runtime.access.user_id, team_ids: [...runtime.access.team_ids], roles: [...runtime.access.roles], task_id: input.task_id },
        );
        const relevant_files = input.files?.length
            ? packet.relevant_files.filter((file) => input.files!.some((path) => file.path === path || file.path.endsWith(path)))
            : packet.relevant_files;
        return {
            project_summary: packet.project_summary,
            current_goal: packet.current_goal,
            hard_constraints: packet.hard_constraints,
            relevant_architecture: packet.relevant_architecture,
            relevant_files,
            active_decisions: packet.active_decisions,
            open_tasks: packet.open_tasks,
            known_failures: packet.known_failures,
            matched_skills: packet.matched_skills,
            asset_loadout: packet.asset_loadout,
            conflicts: packet.contradictions,
            suggested_next_steps: packet.suggested_next_steps,
            citations: packet.citations,
            debug_trace: { ...packet.debug_trace, mode: input.mode, cwd: input.cwd ?? runtime.cwd },
        };
    }));
}