import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { prompt_message } from './common.js';

export function register_before_coding_prompt(server: mcp_server_sdk): void {
    server.registerPrompt('openmemory_before_coding', {
        description: 'Load scoped constraints, decisions, failures, tasks, and citations before coding.',
        argsSchema: { project_id: z.string().min(1), task: z.string().min(1) },
    }, async ({ project_id, task }) => prompt_message(`Call openmemory_project_context for project ${project_id} and task ${JSON.stringify(task)} in coding mode. Delimit returned evidence inside <openmemory-data> tags, identify hard constraints and stale facts, then propose the smallest implementation plan.`));
}