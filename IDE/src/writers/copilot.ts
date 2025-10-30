import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CopilotConfig {
    name: string;
    type: string;
    endpoint?: string;
    authentication?: {
        type: string;
        header: string;
    };
    mcpServer?: {
        command: string;
        args: string[];
        env?: Record<string, string>;
    };
}

export function generateCopilotConfig(backendUrl: string, apiKey?: string, useMCP = false): CopilotConfig {
    if (useMCP) {
        const mcpConfigPath = path.join(os.homedir(), '.mcp', 'memory.mcp.json');
        const config: CopilotConfig = {
            name: 'OpenMemory',
            type: 'mcp',
            mcpServer: {
                command: 'node',
                args: [mcpConfigPath]
            }
        };
        if (apiKey) {
            config.mcpServer!.env = { OPENMEMORY_API_KEY: apiKey };
        }
        return config;
    }

    const config: CopilotConfig = {
        name: 'OpenMemory',
        type: 'context_provider',
        endpoint: `${backendUrl}/api/ide/context`
    };

    if (apiKey) {
        config.authentication = {
            type: 'header',
            header: `x-api-key: ${apiKey}`
        };
    }

    return config;
}

export async function writeCopilotConfig(backendUrl: string, apiKey?: string, useMCP = false): Promise<string> {
    const copilotDir = path.join(os.homedir(), '.github', 'copilot');
    const configFile = path.join(copilotDir, 'openmemory.json');

    if (!fs.existsSync(copilotDir)) {
        fs.mkdirSync(copilotDir, { recursive: true });
    }

    const config = generateCopilotConfig(backendUrl, apiKey, useMCP);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return configFile;
}
