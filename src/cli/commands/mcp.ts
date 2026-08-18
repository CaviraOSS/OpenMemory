import { run_mcp_stdio } from '../../mcp/transports/stdio.js';
import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, has } from '../context/cli_context.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';

export const mcp_command: cli_command = async (context) => {
    command_flags(context, ['read-only', 'audit']);
    if (context.dry_run) {
        const result = { ok: true, command: 'mcp', dry_run: true, db_path: context.db_path, project_id: context.project_id, user_id: context.user_id, read_only: true };
        emit(context, result, () => panel('MCP configuration is valid; stdio transport was not started.', context.colors, { title: 'MCP preview', kind: 'warning', width: context.terminal_width, rows: [['Database', context.db_path], ['Project', context.project_id], ['User', context.user_id], ['Mode', 'read-only preview']] }));
        return;
    }
    await run_mcp_stdio({
        db_path: context.db_path,
        project_id: context.project_id,
        user_id: context.user_id,
        tenant_id: context.env.OPENMEMORY_TENANT_ID?.trim() || 'default',
        read_only: has(context, 'read-only'),
        audit_path: flag(context, 'audit') ?? `${context.db_path}.mcp-audit.jsonl`,
        env: context.env,
    });
};