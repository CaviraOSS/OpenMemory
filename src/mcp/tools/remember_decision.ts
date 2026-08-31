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
 *  file  : src/mcp/tools/remember_decision.ts
 *  usage : implements the LongMemory remember decision component
 */


import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { remember_decision_schema } from '../schemas/tool_schemas.js';
import { assert_write_allowed, resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

export function register_remember_decision_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('longmemory_remember_decision', {
        description: 'Store a durable project decision with rationale and rejected alternatives.',
        inputSchema: remember_decision_schema,
        annotations: { readOnlyHint: false, destructiveHint: false },
    }, async (input) => run_audited_tool(runtime, 'longmemory_remember_decision', input, async () => {
        assert_write_allowed(runtime.access, 'longmemory_remember_decision');
        const project_id = resolve_project(runtime.access, input.project_id)!;
        const manager = await runtime.project(project_id);
        const memory_id = await manager.ingestProjectEvent(project_id, {
            kind: 'decision', text: input.decision, topic: input.decision,
            rationale: input.reason, alternatives_rejected: input.alternatives_rejected,
            files_touched: input.files_affected, url: input.source_ref,
            source_type: 'mcp_decision', replace_current: true,
        });
        return { memory_id, project_id, decision: input.decision };
    }));
}