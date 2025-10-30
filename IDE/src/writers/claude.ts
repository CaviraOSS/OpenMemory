import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ClaudeConfig {
    mcpServers?: {
        openmemory: {
            command: string;
            args: string[];
            env?: Record<string, string>;
        };
    };
    provider?: string;
    base_url?: string;
    api_key?: string;
}

export function generateClaudeConfig(backendUrl: string, apiKey?: string, useMCP = false): ClaudeConfig {
    if (useMCP) {
        return {
            mcpServers: {
                openmemory: {
                    command: 'node',
                    args: [path.join(os.homedir(), '.mcp', 'memory.mcp.json')],
                    env: apiKey ? { OPENMEMORY_API_KEY: apiKey } : undefined
                }
            }
        };
    }

    const config: ClaudeConfig = {
        provider: 'http',
        base_url: `${backendUrl}/api/ide/context`
    };
    if (apiKey) config.api_key = apiKey;
    return config;
}

export async function writeClaudeConfig(backendUrl: string, apiKey?: string, useMCP = false): Promise<string> {
    const claudeDir = path.join(os.homedir(), '.claude', 'providers');
    const configFile = path.join(claudeDir, 'openmemory.json');

    if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
    }

    const config = generateClaudeConfig(backendUrl, apiKey, useMCP);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return configFile;
}
