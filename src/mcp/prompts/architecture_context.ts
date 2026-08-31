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
 *  file  : src/mcp/prompts/architecture_context.ts
 *  usage : implements the LongMemory architecture context component
 */


import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { prompt_message } from './common.js';

export function register_architecture_context_prompt(server: mcp_server_sdk): void {
    server.registerPrompt('longmemory_architecture_context', {
        description: 'Review current architecture, constraints, decisions, and conflicts.',
        argsSchema: { project_id: z.string().min(1), change: z.string().min(1) },
    }, async ({ project_id, change }) => prompt_message(`Read longmemory://project/${project_id}/summary and decisions, then call longmemory_project_context in planning mode for ${JSON.stringify(change)}. Quote memory only inside <longmemory-data> tags and distinguish current decisions from historical alternatives.`));
}