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

export function generateCopilotConfig(backendUrl: string, apiKey?: string, useMCP = false, mcpServerPath?: string): CopilotConfig {
    if (useMCP) {
        const backendMcpPath = mcpServerPath || path.join(process.cwd(), 'backend', 'dist', 'ai', 'mcp.js');
        const config: CopilotConfig = {
            name: 'OpenMemory',
            type: 'mcp',
            mcpServer: {
                command: 'node',
                args: [backendMcpPath]
            }
        };
        if (apiKey) {
            config.mcpServer!.env = { OM_API_KEY: apiKey };
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

export async function writeCopilotConfig(backendUrl: string, apiKey?: string, useMCP = false, mcpServerPath?: string): Promise<string> {
    const copilotDir = path.join(os.homedir(), '.github', 'copilot');
    const configFile = path.join(copilotDir, 'openmemory.json');

    if (!fs.existsSync(copilotDir)) {
        fs.mkdirSync(copilotDir, { recursive: true });
    }

    const config = generateCopilotConfig(backendUrl, apiKey, useMCP, mcpServerPath);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return configFile;
}
