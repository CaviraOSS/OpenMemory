import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { explain_schema } from '../schemas/tool_schemas.js';
import { assert_node_readable } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

export function register_explain_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('openmemory_explain', {
        description: 'Explain a memory and its graph evidence after enforcing MCP scope.',
        inputSchema: explain_schema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async (input) => run_audited_tool(runtime, 'openmemory_explain', input, async () => {
        const id = input.memory_id ?? input.query_id;
        if (!id) throw new Error('memory_id or query_id is required');
        const explanation = await runtime.memory.explain(id);
        if (!explanation.node) return explanation;
        assert_node_readable(runtime.access, explanation.node);
        return explanation;
    }));
}