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
 *  file  : src/cli/commands/explain.ts
 *  usage : inspect a node and executable edge trace
 */

import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, positional, require_value, with_memory } from '../context/cli_context.js';
import { cli_error, exit_codes } from '../output/errors.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { tree } from '../output/tree.js';

export const explain_command: cli_command = async (context) => {
    command_flags(context, ['id']);
    const id = require_value(positional(context) ?? flag(context, 'id'), 'memory id');
    const result = await with_memory(context, (memory) => memory.explain(id));
    if (!result.node) throw new cli_error('memory_not_found', `Memory not found: ${id}`, exit_codes.validation, { id }, 'openmemory recall "your query"', 'Use an existing memory ID.');
    emit(context, { ok: true, ...result }, () => [
        panel(result.node!.content.raw, context.colors, { title: 'Memory explanation', kind: 'info', width: context.terminal_width, rows: [['ID', id], ['World', result.node!.world.world_id], ['Status', result.node!.state.status]] }), '',
        context.colors.title('Why recalled'), tree([
            { label: `Entity resolution: ${result.ingest?.diff.resolved_entities.length ?? 0} matches` },
            { label: `World match: ${result.node!.world.world_id}` },
            { label: `Bitemporal: ${result.node!.temporal.superseded_at ? 'superseded' : 'active'}` },
            { label: `Contract: ${result.node!.contract.use_for_reasoning ? 'reasoning allowed' : 'context only'}` },
            { label: `Grounding: ${result.node!.grounding.worlddb_ref ? 'source-backed' : 'ungrounded'}` },
            { label: `Contradiction: ${result.node!.state.status === 'contradicted' ? 'present' : 'none'}` },
            { label: 'Provenance', children: result.node!.provenance.source_trace.map((source) => ({ label: source.source_id, detail: source.ref ?? 'no reference' })) },
        ], context.colors),
    ].join('\n'));
};