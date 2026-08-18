import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { sync_connector_schema } from '../schemas/tool_schemas.js';
import { assert_write_allowed, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

export function register_sync_connector_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('openmemory_sync_connector', {
        description: 'Plan or apply an external connector sync; dry-run defaults to true.',
        inputSchema: sync_connector_schema,
        annotations: { readOnlyHint: false, destructiveHint: true },
    }, async (input) => run_audited_tool(runtime, 'openmemory_sync_connector', input, async () => {
        assert_write_allowed(runtime.access, 'openmemory_sync_connector');
        const project_id = resolve_project(runtime.access, input.project_id);
        if (!project_id) throw new Error('project_id is required for connector sync');
        const manager = await runtime.project(project_id);
        const project = manager.getProject(project_id);
        if (!project.linked_sources.some((source) => source.connector_id === input.connector_id)) {
            await manager.linkSourceToProject(project_id, { connector_id: input.connector_id });
        }
        return manager.syncProjectSource(project_id, input.connector_id, { dry_run: input.dry_run });
    }));
}