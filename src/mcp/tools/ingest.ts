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
 *  file  : src/mcp/tools/ingest.ts
 *  usage : implements the LongMemory ingest component
 */

import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { ingest_schema } from '../schemas/tool_schemas.js';
import { assert_write_allowed, resolve_project, resolve_user } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

export function register_ingest_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('longmemory_ingest', {
        description: 'Store a memory observation through the public ingest pipeline.',
        inputSchema: ingest_schema,
        annotations: { readOnlyHint: false, destructiveHint: false },
    }, async (input) => run_audited_tool(runtime, 'longmemory_ingest', input, async () => {
        assert_write_allowed(runtime.access, 'longmemory_ingest');
        const user_id = resolve_user(runtime.access, input.user_id);
        const project_id = resolve_project(runtime.access, input.project_id);
        if (project_id) {
            const manager = await runtime.project(project_id);
            const memory_id = await manager.ingestProjectEvent(project_id, {
                kind: 'manual_fact', text: input.text, source_type: input.source,
                external_id: input.source_ref, metadata: { memory_type: input.memory_type, source_ref: input.source_ref, mcp_user_id: user_id },
            });
            return { memory_id, project_id };
        }
        const result = await runtime.memory.ingest({
            user_id, text: input.text, grounding_ref: input.source_ref,
            metadata: { source_type: input.source, source_ref: input.source_ref, memory_type: input.memory_type },
        });
        return { memory_id: result.node.id, result };
    }));
}