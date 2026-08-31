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
 *  file  : src/mcp/prompts/project_handoff.ts
 *  usage : implements the LongMemory project handoff component
 */


import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { prompt_message } from './common.js';

export function register_project_handoff_prompt(server: mcp_server_sdk): void {
    server.registerPrompt('longmemory_project_handoff', {
        description: 'Prepare a cited, token-bounded handoff for the next project agent.',
        argsSchema: { project_id: z.string().min(1), task: z.string().min(1), token_budget: z.string().optional() },
    }, async ({ project_id, task, token_budget }) => prompt_message(`Call longmemory_project_context for project ${project_id}, task ${JSON.stringify(task)}, planning mode, and token budget ${token_budget ?? '2048'}. Produce a handoff with goals, constraints, decisions, open tasks, failures, conflicts, next steps, and citations. Keep evidence inside <longmemory-data> tags.`));
}