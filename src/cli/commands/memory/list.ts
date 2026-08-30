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
 *  file  : src/cli/commands/memory/list.ts
 *  usage : implements the LongMemory list component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, number_flag, time_flag, with_read_memory } from '../../context/cli_context.js';
import { cli_error, exit_codes } from '../../output/errors.js';
import { emit } from '../../output/pretty.js';
import { table } from '../../output/table.js';
import { memory_summary } from './summary.js';
import { resolve_project_scope } from '../../context/project_scope.js';

export const memory_list_command: cli_command = async (context) => {
    command_flags(context, ['limit', 'status', 'world', 'at']);
    const limit = number_flag(context, 'limit', 50) as number;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) throw new cli_error('validation_error', '--limit must be an integer between 1 and 1000', exit_codes.validation);
    const status = flag(context, 'status');
    const valid_statuses = ['active', 'superseded', 'contradicted', 'expired', 'draft'];
    if (status && !valid_statuses.includes(status)) throw new cli_error('validation_error', `--status must be one of ${valid_statuses.join(', ')}`, exit_codes.validation);
    const result = await with_read_memory(context, async (memory) => {
        const scope = await resolve_project_scope(memory, context.project_id);
        const recalled = await memory.recall({
            text: '', mode: 'historical', now: time_flag(context, 'at') ?? Date.now(), world_id: flag(context, 'world') ?? scope.root?.id,
            permission_context: { user_id: context.user_id, project_ids: [context.project_id] },
        });
        const entries = 'timeline' in recalled ? recalled.timeline.entries : [];
        const memories = entries
            .map((entry) => entry.node)
            .filter((node) => !status || node.state.status === status)
            .sort((left, right) => right.temporal.observed_at - left.temporal.observed_at || left.id.localeCompare(right.id))
            .slice(0, limit)
            .map(memory_summary);
        return { ok: true, project_id: context.project_id, count: memories.length, limit, memories };
    });
    emit(context, result, () => result.memories.length ? table(result.memories.map((memory) => ({
        status: memory.status.toUpperCase(),
        memory: memory.text,
        confidence: memory.confidence.toFixed(2),
        observed: new Date(memory.observed_at).toISOString(),
    })), [
        { key: 'status', label: 'STATUS', width: 13 },
        { key: 'memory', label: 'MEMORY', min: 20 },
        { key: 'confidence', label: 'CONF', width: 6 },
        { key: 'observed', label: 'OBSERVED', width: 24 },
    ], context.colors, context.terminal_width) : context.colors.muted('No memories matched the selected filters.'));
};