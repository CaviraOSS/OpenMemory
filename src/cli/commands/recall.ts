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
 *  file  : src/cli/commands/recall.ts
 *  usage : recall through the public Hydrograph facade
 */

import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, mode_flag, number_flag, positional, require_value, time_flag, with_read_memory } from '../context/cli_context.js';
import { badge } from '../theme/badges.js';
import { emit, section } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { table } from '../output/table.js';
import { resolve_project_scope } from '../context/project_scope.js';

export const recall_command: cli_command = async (context) => {
    command_flags(context, ['query', 'mode', 'valid-time', 'recorded-time', 'at', 'k', 'world']);
    const query = require_value(positional(context) ?? flag(context, 'query'), 'recall query');
    const mode = mode_flag(context);
    const raw = await with_read_memory(context, async (memory) => {
        const scope = await resolve_project_scope(memory, context.project_id);
        return memory.recall({
            text: query, mode, token_budget: context.token_budget, k: number_flag(context, 'k'), world_id: flag(context, 'world') ?? scope.root?.id,
            valid_time: time_flag(context, 'valid-time'), recorded_time: time_flag(context, 'recorded-time'), at: time_flag(context, 'at'),
            permission_context: { user_id: context.user_id, project_ids: [context.project_id] }
        });
    });
    const source = raw as Record<string, any>;
    const values: any[] = Array.isArray(source.items) ? source.items : Array.isArray(source.timeline?.entries) ? source.timeline.entries : [];
    const hits = values.map((item) => {
        const node = item.node;
        return { id: node.id, text: node.content.summary || node.content.raw, status: node.state.status, score: item.score ?? item.grounding_score ?? (item.is_current ? 1 : 0.5), grounded: Boolean(node.grounding.worlddb_ref), citation: node.provenance.source_trace[0]?.ref ?? null };
    });
    const result = { ok: true, mode, query, context_packet: source.context ?? source.timeline ?? null, hits, citations: hits.flatMap((hit) => hit.citation ? [{ memory_id: hit.id, source: hit.citation }] : []), debug_trace: source.trace ?? {}, ...(source.items ? { items: source.items } : {}), ...(source.timeline ? { timeline: source.timeline } : {}) };
    emit(context, result, () => [
        panel(query, context.colors, { title: 'Recall', kind: 'info', width: context.terminal_width, rows: [['Mode', badge(mode === 'world_grounded' ? 'WORLD' : mode.toUpperCase() as any, true, context.colors)], ['Hits', hits.length], ['Budget', context.token_budget]] }), '',
        hits.length ? section(context, 'Memory hits', table(hits.map((hit) => ({ status: badge(hit.status === 'active' ? 'ACTIVE' : hit.status === 'superseded' ? 'SUPERSEDED' : 'STALE', true, context.colors), score: Number(hit.score).toFixed(3), memory: hit.text, source: hit.citation ?? '—' })), [
            { key: 'status', label: 'STATUS', width: 13 }, { key: 'score', label: 'SCORE', width: 7 }, { key: 'memory', label: 'MEMORY', min: 15 }, { key: 'source', label: 'SOURCE', min: 8 },
        ], context.colors, context.terminal_width)) : context.colors.muted('No memories passed the selected recall gates.'),
        context.debug ? `\n${section(context, 'Debug trace', JSON.stringify(result.debug_trace, null, 2))}` : '',
    ].filter(Boolean).join('\n'));
};