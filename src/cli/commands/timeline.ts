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
 *  file  : src/cli/commands/timeline.ts
 *  usage : implements the LongMemory timeline component
 */

import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, positional, require_value, time_flag, with_read_memory } from '../context/cli_context.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { badge } from '../theme/badges.js';
import { resolve_project_scope } from '../context/project_scope.js';

export const timeline_command: cli_command = async (context) => {
    command_flags(context, ['entity', 'memory', 'valid-time', 'recorded-time']);
    const id = require_value(positional(context) ?? flag(context, 'entity') ?? flag(context, 'memory') ?? context.project_id, 'entity, memory, or project');
    const result = await with_read_memory(context, async (memory) => {
        const scope = await resolve_project_scope(memory, context.project_id);
        const entity = await memory.getEntity(id);
        const recalled = await memory.recall({
            mode: 'historical', now: Date.now(), text: entity ? '' : id, world_id: scope.root?.id,
            entity_names: entity ? [entity.canonical_name] : undefined,
            valid_time: time_flag(context, 'valid-time'),
            recorded_time: time_flag(context, 'recorded-time'),
            permission_context: { user_id: context.user_id, project_ids: [context.project_id] },
        });
        if (!('timeline' in recalled)) throw new Error('historical timeline was not returned');
        return recalled;
    });
    const entries = result.timeline.entries.map((entry) => ({ at: entry.node.temporal.recorded_at, status: entry.node.temporal.superseded_at ? 'SUPERSEDED' : entry.node.state.status === 'active' ? 'ACTIVE' : entry.node.state.status.toUpperCase(), text: entry.node.content.raw, id: entry.node.id }));
    emit(context, { ok: true, target: id, entries, trace: result.trace }, () => [
        panel(`Historical memory for ${id}`, context.colors, { title: 'Timeline', kind: 'info', width: context.terminal_width, rows: [['Events', entries.length]] }), '',
        ...entries.map((entry) => `${context.colors.muted(new Date(entry.at).toISOString().slice(0, 10))}  ${badge(entry.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'ACTIVE', true, context.colors)}  ${entry.text}`),
    ].join('\n'));
};