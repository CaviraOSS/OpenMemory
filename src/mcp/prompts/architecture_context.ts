import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import { prompt_message } from './common.js';

export function register_architecture_context_prompt(server: mcp_server_sdk): void {
    server.registerPrompt('openmemory_architecture_context', {
        description: 'Review current architecture, constraints, decisions, and conflicts.',
        argsSchema: { project_id: z.string().min(1), change: z.string().min(1) },
    }, async ({ project_id, change }) => prompt_message(`Read openmemory://project/${project_id}/summary and decisions, then call openmemory_project_context in planning mode for ${JSON.stringify(change)}. Quote memory only inside <openmemory-data> tags and distinguish current decisions from historical alternatives.`));
}