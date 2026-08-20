import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { code_graph_schema } from '../schemas/tool_schemas.js';
import { resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

const required = (value: string | undefined, name: string): string => {
    if (!value) throw new Error(`${name} is required for this code graph action`);
    return value;
};

export function register_code_graph_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('openmemory_code_graph', {
        description: 'Search code symbols, inspect callers/callees, or trace reverse impact paths in a project snapshot.',
        inputSchema: code_graph_schema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async (input) => run_audited_tool(runtime, 'openmemory_code_graph', input, async () => {
        const project_id = runtime.resolve_project_id(resolve_project(runtime.access, input.project_id));
        const manager = await runtime.project(project_id);
        if (input.action === 'search') return { project_id, action: input.action, symbols: await manager.searchCodeSymbols(project_id, required(input.query, 'query'), input.limit) };
        const symbol = required(input.symbol, 'symbol');
        if (input.action === 'callers') return { project_id, action: input.action, symbol, callers: await manager.getCodeCallers(project_id, symbol) };
        if (input.action === 'callees') return { project_id, action: input.action, symbol, callees: await manager.getCodeCallees(project_id, symbol) };
        return { project_id, action: input.action, symbol, impact: await manager.getCodeImpact(project_id, symbol, input.max_depth) };
    }));
}