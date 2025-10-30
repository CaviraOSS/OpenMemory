import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface MCPConfig {
    name: string;
    display_name: string;
    version: string;
    tools: MCPTool[];
}

export interface MCPTool {
    name: string;
    description: string;
    args: Record<string, string>;
    endpoint: string;
}

export function generateMCPConfig(backendUrl: string, apiKey?: string): MCPConfig {
    return {
        name: 'openmemory',
        display_name: 'OpenMemory MCP',
        version: '1.0.0',
        tools: [
            {
                name: 'queryMemory',
                description: 'Retrieve semantic or procedural memory context from past coding sessions',
                args: { query: 'string', k: 'integer', sector: 'string' },
                endpoint: `${backendUrl}/api/ide/context`
            },
            {
                name: 'searchMemory',
                description: 'Search all memories with filters',
                args: { query: 'string', limit: 'integer', sector: 'string' },
                endpoint: `${backendUrl}/search`
            },
            {
                name: 'getPatterns',
                description: 'Get detected coding patterns from current session',
                args: { session_id: 'string' },
                endpoint: `${backendUrl}/api/ide/patterns`
            },
            {
                name: 'storeMemory',
                description: 'Store a new memory explicitly',
                args: { content: 'string', sector: 'string' },
                endpoint: `${backendUrl}/store`
            }
        ]
    };
}

export async function writeMCPConfig(backendUrl: string, apiKey?: string): Promise<string> {
    const mcpDir = path.join(os.homedir(), '.mcp');
    const mcpFile = path.join(mcpDir, 'memory.mcp.json');

    if (!fs.existsSync(mcpDir)) {
        fs.mkdirSync(mcpDir, { recursive: true });
    }

    const config = generateMCPConfig(backendUrl, apiKey);
    fs.writeFileSync(mcpFile, JSON.stringify(config, null, 2));

    return mcpFile;
}
