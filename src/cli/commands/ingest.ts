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
 *  file  : src/cli/commands/ingest.ts
 *  usage : ingest one event through createMemory
 */

import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, has, positional, require_value, time_flag, with_memory } from '../context/cli_context.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { badge } from '../theme/badges.js';
import { project_world } from '../context/project_scope.js';

export const ingest_command: cli_command = async (context) => {
    command_flags(context, ['text', 'type', 'source', 'at', 'world', 'external', 'stdin', 'metadata-json']);
    const stdin_text = has(context, 'stdin') ? await new Promise<string>((resolve_text, reject) => {
        let value = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk: string) => { value += chunk; });
        process.stdin.once('end', () => resolve_text(value));
        process.stdin.once('error', reject);
    }) : undefined;
    const text = require_value(stdin_text ?? positional(context) ?? flag(context, 'text'), 'memory text');
    const kind = flag(context, 'type') ?? 'manual_fact';
    const source = flag(context, 'source') ?? 'cli';
    const metadata_raw = flag(context, 'metadata-json');
    let metadata: Record<string, unknown> = {};
    if (metadata_raw) {
        try {
            const parsed = JSON.parse(metadata_raw) as unknown;
            if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('expected a JSON object');
            metadata = parsed as Record<string, unknown>;
        } catch (error) {
            throw new Error(`--metadata-json must be a JSON object: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (context.dry_run) {
        const preview = { ok: true, dry_run: true, project_id: context.project_id, user_id: context.user_id, text, memory_type: kind, source };
        emit(context, preview, () => panel(text, context.colors, { title: 'Memory preview', kind: 'warning', width: context.terminal_width, rows: [['Type', kind], ['Source', source], ['Project', context.project_id], ['Write', 'skipped']] }));
        return;
    }
    const result = await with_memory(context, async (memory) => {
        const scoped_world = flag(context, 'world') ?? (await project_world(memory, context.project_id))?.id;
        const ingested = await memory.ingest({
            user_id: context.user_id, text, at: time_flag(context, 'at'), world_id: scoped_world,
            external: has(context, 'external') || undefined,
            source_ref: source,
            metadata: { ...metadata, project_id: context.project_id, memory_type: kind, source_type: source },
        });
        return { ok: true, memory_id: ingested.node.id, node: ingested.node, entities: ingested.diff.resolved_entities, trace: ingested.trace };
    });
    emit(context, result, () => panel(result.node?.content.raw ?? text, context.colors, {
        title: 'Memory stored', kind: 'success', width: context.terminal_width, rows: [
            ['Status', badge('ACTIVE', true, context.colors)], ['ID', result.memory_id], ['World', result.node?.world.world_id ?? 'project'], ['Facet', kind],
            ['Entities', result.entities.map((entity) => entity.mention).join(', ') || 'none'], ['Contract', result.node?.contract.use_for_reasoning ? 'reasoning allowed' : 'context only'],
        ]
    }));
};