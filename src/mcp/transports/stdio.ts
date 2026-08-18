import { StdioServerTransport as stdio_server_transport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Readable, Writable } from 'node:stream';
import { create_openmemory_mcp, type mcp_server_config } from '../mcp_server.js';

export type stdio_mcp = ReturnType<typeof create_openmemory_mcp> & {
    transport: stdio_server_transport;
    start(): Promise<void>;
    close(): Promise<void>;
};

export function create_stdio_mcp(
    config: mcp_server_config = {},
    input: Readable = process.stdin,
    output: Writable = process.stdout,
): stdio_mcp {
    const mcp = create_openmemory_mcp(config);
    const transport = new stdio_server_transport(input, output);
    return {
        ...mcp,
        transport,
        start: () => mcp.server.connect(transport),
        close: async () => {
            await mcp.server.close();
            if (!config.runtime) await mcp.runtime.close();
        },
    };
}

export async function run_mcp_stdio(config: mcp_server_config = {}): Promise<void> {
    const mcp = create_stdio_mcp(config);
    await mcp.start();
    await new Promise<void>((resolve) => { mcp.transport.onclose = resolve; });
    await mcp.close();
}