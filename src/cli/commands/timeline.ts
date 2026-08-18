/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/cli/commands/timeline.ts
 *  usage : inspect an entity timeline
 */

import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, positional, require_value, time_flag, with_memory } from '../context/cli_context.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { badge } from '../theme/badges.js';

export const timeline_command: cli_command = async (context) => {
    command_flags(context, ['entity', 'memory', 'valid-time', 'recorded-time']);
    const id = require_value(positional(context) ?? flag(context, 'entity') ?? flag(context, 'memory') ?? context.project_id, 'entity, memory, or project');
    const result = await with_memory(context, async (memory) => {
        const entity = await memory.getEntity(id);
        return memory.getTimeline({
            text: entity ? undefined : id,
            entity_names: entity ? [entity.canonical_name] : undefined,
            valid_time: time_flag(context, 'valid-time'),
            recorded_time: time_flag(context, 'recorded-time'),
        });
    });
    const entries = result.timeline.entries.map((entry) => ({ at: entry.node.temporal.recorded_at, status: entry.node.temporal.superseded_at ? 'SUPERSEDED' : entry.node.state.status === 'active' ? 'ACTIVE' : entry.node.state.status.toUpperCase(), text: entry.node.content.raw, id: entry.node.id }));
    emit(context, { ok: true, target: id, entries, trace: result.trace }, () => [
        panel(`Historical memory for ${id}`, context.colors, { title: 'Timeline', kind: 'info', width: context.terminal_width, rows: [['Events', entries.length]] }), '',
        ...entries.map((entry) => `${context.colors.muted(new Date(entry.at).toISOString().slice(0, 10))}  ${badge(entry.status === 'SUPERSEDED' ? 'SUPERSEDED' : 'ACTIVE', true, context.colors)}  ${entry.text}`),
    ].join('\n'));
};