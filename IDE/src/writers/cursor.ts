import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CursorConfig {
    name: string;
    type: string;
    endpoint?: string;
    method?: string;
    headers?: Record<string, string>;
    body_template?: Record<string, any>;
    mcp?: {
        server: string;
        tools: string[];
    };
}

export function generateCursorConfig(backendUrl: string, apiKey?: string, useMCP = false): CursorConfig {
    if (useMCP) {
        return {
            name: 'OpenMemory',
            type: 'mcp',
            mcp: {
                server: path.join(os.homedir(), '.mcp', 'memory.mcp.json'),
                tools: ['queryMemory', 'searchMemory', 'getPatterns', 'storeMemory']
            }
        };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['x-api-key'] = apiKey;

    return {
        name: 'OpenMemory',
        type: 'http',
        endpoint: `${backendUrl}/api/ide/context`,
        method: 'POST',
        headers,
        body_template: {
            query: '{{prompt}}',
            limit: 10,
            session_id: '{{session_id}}'
        }
    };
}

export async function writeCursorConfig(backendUrl: string, apiKey?: string, useMCP = false): Promise<string> {
    const cursorDir = path.join(os.homedir(), '.cursor', 'context_providers');
    const configFile = path.join(cursorDir, 'openmemory.json');

    if (!fs.existsSync(cursorDir)) {
        fs.mkdirSync(cursorDir, { recursive: true });
    }

    const config = generateCursorConfig(backendUrl, apiKey, useMCP);
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return configFile;
}
