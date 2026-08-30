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
 *  file  : src/mcp/tools/report_conflicts.ts
 *  usage : implements the LongMemory report conflicts component
 */

import type { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { mcp_runtime } from '../runtime.js';
import { report_conflicts_schema } from '../schemas/tool_schemas.js';
import { resolve_project } from '../security/permissions.js';
import { run_audited_tool } from './common.js';

export function register_report_conflicts_tool(server: mcp_server_sdk, runtime: mcp_runtime): void {
    server.registerTool('longmemory_report_conflicts', {
        description: 'Report unresolved contradictions in project-scoped memory.',
        inputSchema: report_conflicts_schema,
        annotations: { readOnlyHint: true, idempotentHint: true },
    }, async (input) => run_audited_tool(runtime, 'longmemory_report_conflicts', input, async () => {
        const project_id = resolve_project(runtime.access, input.project_id)!;
        const manager = await runtime.project(project_id);
        const recalled = await manager.recallProject(project_id, { text: '', token_budget: 256 }, 'project_historical');
        return {
            project_id,
            severity: input.severity ?? 'warning',
            conflicts: recalled.contradictions,
            count: recalled.contradictions.length,
        };
    }));
}