import { StreamableHTTPServerTransport as streamable_http_server_transport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { RequestListener } from 'node:http';
import { create_openmemory_mcp, type mcp_server_config } from '../mcp_server.js';
import { mcp_runtime } from '../runtime.js';

export type mcp_http_options = mcp_server_config & { endpoint?: string };
export type mcp_http_handler = { handler: RequestListener; runtime: mcp_runtime; endpoint: string; close(): Promise<void> };

const protocol_error = (response: Parameters<RequestListener>[1], status: number, message: string) => {
    if (response.headersSent) return;
    response.statusCode = status;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message }, id: null }));
};

export function create_mcp_http_handler(options: mcp_http_options = {}): mcp_http_handler {
    const endpoint = options.endpoint ?? '/mcp';
    const runtime = options.runtime ?? new mcp_runtime(options);
    const handler: RequestListener = async (request, response) => {
        const path = new URL(request.url ?? '/', 'http://openmemory.local').pathname;
        if (path !== endpoint) return protocol_error(response, 404, 'MCP endpoint not found');
        const mcp = create_openmemory_mcp({ runtime });
        const transport = new streamable_http_server_transport({ sessionIdGenerator: undefined });
        try {
            await mcp.server.connect(transport);
            await transport.handleRequest(request, response);
        } catch (error) {
            protocol_error(response, 500, error instanceof Error ? error.message : 'Internal MCP error');
        } finally {
            await mcp.server.close();
        }
    };
    return {
        handler, runtime, endpoint,
        close: async () => { if (!options.runtime) await runtime.close(); },
    };
}