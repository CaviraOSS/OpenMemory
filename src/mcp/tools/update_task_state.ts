import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { update_task_state_schema } from '../schemas/tool_schemas.js';
import { assert_write_allowed, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

export function register_update_task_state_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('openmemory_update_task_state', {
        description: 'Update durable task state and project agent continuity.',
        inputSchema: update_task_state_schema,
        annotations: { readOnlyHint: false, destructiveHint: false },
    }, async (input) => run_audited_tool(runtime, 'openmemory_update_task_state', input, async () => {
        assert_write_allowed(runtime.access, 'openmemory_update_task_state');
        const project_id = resolve_project(runtime.access, input.project_id)!;
        const manager = await runtime.project(project_id);
        const task_memory_id = await manager.ingestProjectEvent(project_id, {
            kind: 'task', text: input.task, topic: input.task, status: input.status,
            replace_current: true, files_touched: input.files_touched, next_actions: input.next_steps,
            metadata: { what_changed: input.what_changed, errors_seen: input.errors_seen },
        });
        const continuity_memory_id = await manager.ingestProjectEvent(project_id, {
            kind: 'agent_state', text: input.what_changed ?? `${input.task}: ${input.status}`, topic: input.task,
            status: input.status, files_touched: input.files_touched, next_actions: input.next_steps,
            replace_current: true, metadata: { known_failures: input.errors_seen ?? [], task_memory_id },
        });
        return { project_id, task_memory_id, continuity_memory_id, status: input.status };
    }));
}