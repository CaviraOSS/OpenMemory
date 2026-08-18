import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { recall_schema } from '../schemas/tool_schemas.js';
import { recall_permission, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

const sanitize_recall = (result: unknown): unknown => {
    if (!result || typeof result !== 'object') return result;
    const value = result as Record<string, any>;
    if (!value.trace || typeof value.trace !== 'object' || !Array.isArray(value.trace.candidates)) return result;
    return {
        ...value,
        trace: {
            ...value.trace,
            candidates: value.trace.candidates.filter((candidate: Record<string, unknown>) => candidate.accepted === true || candidate.included === true),
        },
    };
};

export function register_recall_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('openmemory_recall', {
        description: 'Recall memory through the selected Hydrograph mode without bypassing gates.',
        inputSchema: recall_schema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async (input) => run_audited_tool(runtime, 'openmemory_recall', input, async () => {
        const project_id = resolve_project(runtime.access, input.project_id);
        const world_id = project_id ? (await runtime.project(project_id)).getProject(project_id).root_world_id : undefined;
        const result = await runtime.memory.recall({
            text: input.query,
            mode: input.mode,
            token_budget: input.token_budget,
            world_id,
            permission_context: recall_permission(runtime.access, input.user_id, project_id ?? undefined),
        });
        return sanitize_recall(result);
    }));
}