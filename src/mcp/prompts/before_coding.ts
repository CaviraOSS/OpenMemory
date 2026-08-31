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
 *  file  : src/mcp/prompts/before_coding.ts
 *  usage : implements the LongMemory before coding component
 */


import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { prompt_message } from './common.js';

export function register_before_coding_prompt(server: mcp_server_sdk): void {
    server.registerPrompt('longmemory_before_coding', {
        description: 'Load scoped constraints, decisions, failures, tasks, and citations before coding.',
        argsSchema: { project_id: z.string().min(1), task: z.string().min(1) },
    }, async ({ project_id, task }) => prompt_message(`Call longmemory_project_context for project ${project_id} and task ${JSON.stringify(task)} in coding mode. Delimit returned evidence inside <longmemory-data> tags, identify hard constraints and stale facts, then propose the smallest implementation plan.`));
}