import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CodexConfig {
    contextProviders?: {
        openmemory: {
            enabled: boolean;
            endpoint: string;
            method: string;
            headers: Record<string, string>;
            queryField: string;
        };
    };
    mcpServers?: {
        openmemory: {
            command: string;
            args: string[];
            env?: Record<string, string>;
        };
    };
}

export function generateCodexConfig(backendUrl: string, apiKey?: string, useMCP = false, mcpServerPath?: string): CodexConfig {
    if (useMCP) {
        const backendMcpPath = mcpServerPath || path.join(process.cwd(), 'backend', 'dist', 'ai', 'mcp.js');
        const config: CodexConfig = {
            mcpServers: {
                openmemory: {
                    command: 'node',
                    args: [backendMcpPath]
                }
            }
        };
        if (apiKey) {
            config.mcpServers!.openmemory.env = { OM_API_KEY: apiKey };
        }
        return config;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;

    return {
        contextProviders: {
            openmemory: {
                enabled: true,
                endpoint: `${backendUrl}/api/ide/context`,
                method: 'POST',
                headers,
                queryField: 'query'
            }
        }
    };
}

export async function writeCodexConfig(backendUrl: string, apiKey?: string, useMCP = false, mcpServerPath?: string): Promise<string> {
    const codexDir = path.join(os.homedir(), '.codex');
    const configFile = path.join(codexDir, 'context.json');

    if (!fs.existsSync(codexDir)) {
        fs.mkdirSync(codexDir, { recursive: true });
    }

    const config = generateCodexConfig(backendUrl, apiKey, useMCP, mcpServerPath);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return configFile;
}
