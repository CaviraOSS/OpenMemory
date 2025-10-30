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

export function generateCodexConfig(backendUrl: string, apiKey?: string, useMCP = false): CodexConfig {
    if (useMCP) {
        const mcpConfigPath = path.join(os.homedir(), '.mcp', 'memory.mcp.json');
        const config: CodexConfig = {
            mcpServers: {
                openmemory: {
                    command: 'node',
                    args: [mcpConfigPath]
                }
            }
        };
        if (apiKey) {
            config.mcpServers!.openmemory.env = { OPENMEMORY_API_KEY: apiKey };
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

export async function writeCodexConfig(backendUrl: string, apiKey?: string, useMCP = false): Promise<string> {
    const codexDir = path.join(os.homedir(), '.codex');
    const configFile = path.join(codexDir, 'context.json');

    if (!fs.existsSync(codexDir)) {
        fs.mkdirSync(codexDir, { recursive: true });
    }

    const config = generateCodexConfig(backendUrl, apiKey, useMCP);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return configFile;
}
