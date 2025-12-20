import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface WindsurfConfig {
    contextProvider?: string;
    api?: string;
    apiKey?: string;
    mcp?: {
        configPath: string;
    };
}

export function generateWindsurfConfig(backendUrl: string, apiKey?: string, useMCP = false, mcpServerPath?: string): WindsurfConfig {
    if (useMCP) {
        const backendMcpPath = mcpServerPath || path.join(process.cwd(), 'backend', 'dist', 'ai', 'mcp.js');
        return {
            contextProvider: 'openmemory-mcp',
            mcp: {
                configPath: backendMcpPath
            }
        };
    }

    const config: WindsurfConfig = {
        contextProvider: 'openmemory',
        api: `${backendUrl}/api/ide/context`
    };
    if (apiKey) config.apiKey = apiKey;
    return config;
}

export async function writeWindsurfConfig(backendUrl: string, apiKey?: string, useMCP = false, mcpServerPath?: string): Promise<string> {
    const windsurfDir = path.join(os.homedir(), '.windsurf', 'context');
    const configFile = path.join(windsurfDir, 'openmemory.json');

    if (!fs.existsSync(windsurfDir)) {
        fs.mkdirSync(windsurfDir, { recursive: true });
    }

    const config = generateWindsurfConfig(backendUrl, apiKey, useMCP, mcpServerPath);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return configFile;
}
