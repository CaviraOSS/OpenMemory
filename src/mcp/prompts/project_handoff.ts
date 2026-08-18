import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { prompt_message } from './common.js';

export function register_project_handoff_prompt(server: mcp_server_sdk): void {
    server.registerPrompt('openmemory_project_handoff', {
        description: 'Prepare a cited, token-bounded handoff for the next project agent.',
        argsSchema: { project_id: z.string().min(1), task: z.string().min(1), token_budget: z.string().optional() },
    }, async ({ project_id, task, token_budget }) => prompt_message(`Call openmemory_project_context for project ${project_id}, task ${JSON.stringify(task)}, planning mode, and token budget ${token_budget ?? '2048'}. Produce a handoff with goals, constraints, decisions, open tasks, failures, conflicts, next steps, and citations. Keep evidence inside <openmemory-data> tags.`));
}