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
 *  file  : src/mcp/tools/recall.ts
 *  usage : implements the LongMemory recall component
 */


import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { recall_schema } from '../schemas/tool_schemas.js';
import { recall_permission, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

const sanitize_recall = (result: unknown): unknown => {
    if (!result || typeof result !== 'object') return result;
    const value = result as Record<string, any>;
    let next = value;
    if (next.trace && typeof next.trace === 'object' && Array.isArray(next.trace.candidates)) {
        next = {
            ...next,
            trace: {
                ...next.trace,
                candidates: next.trace.candidates.filter((candidate: Record<string, unknown>) => candidate.accepted === true || candidate.included === true),
            },
        };
    }
    // context.items is always a subset of items[].node (same recall pass); keep the
    // one full copy in items[] and collapse the context duplicate to an id reference.
    if (Array.isArray(next.items) && next.context && Array.isArray(next.context.items)) {
        const full_node_ids = new Set(next.items.map((item: Record<string, any>) => item.node?.id).filter(Boolean));
        next = {
            ...next,
            context: {
                ...next.context,
                items: next.context.items.map((node: Record<string, any>) => full_node_ids.has(node?.id) ? { id: node.id } : node),
            },
        };
    }
    return next;
};

export function register_recall_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('longmemory_recall', {
        description: 'Recall memory through the selected Hydrograph mode without bypassing gates.',
        inputSchema: recall_schema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async (input) => run_audited_tool(runtime, 'longmemory_recall', input, async () => {
        const project_id = resolve_project(runtime.access, input.project_id);
        const world_id = project_id ? (await runtime.project(project_id)).getProject(project_id).root_world_id : undefined;
        const result = await runtime.memory.recall({
            text: input.query,
            mode: input.mode,
            token_budget: input.token_budget,
            world_id,
            permission_context: recall_permission(runtime.access, input.user_id, project_id ?? undefined),
        });
        return sanitize_recall(result);
    }));
}