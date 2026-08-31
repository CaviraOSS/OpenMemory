/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/mcp/resources/projects.ts
 *  usage : implements the LongMemory projects component
 */


import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { json_resource } from './common.js';

export function register_projects_resource(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerResource('longmemory-projects', 'longmemory://projects', {
        description: 'Projects visible to the configured MCP scope', mimeType: 'application/json',
    }, async (uri) => json_resource(uri, await runtime.list_projects()));
}