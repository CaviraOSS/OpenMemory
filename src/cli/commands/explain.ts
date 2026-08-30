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
 *  file  : src/cli/commands/explain.ts
 *  usage : implements the LongMemory explain component
 */

import type { cli_command } from '../context/cli_context.js';
import { command_flags, flag, positional, require_value, with_read_memory } from '../context/cli_context.js';
import { cli_error, exit_codes } from '../output/errors.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';
import { tree } from '../output/tree.js';
import { resolve_project_scope } from '../context/project_scope.js';

export const explain_command: cli_command = async (context) => {
    command_flags(context, ['id']);
    const id = require_value(positional(context) ?? flag(context, 'id'), 'memory id');
    const result = await with_read_memory(context, async (memory) => {
        const scope = await resolve_project_scope(memory, context.project_id);
        const explanation = await memory.explain(id);
        if (explanation.node && !scope.legacy && !scope.world_ids.has(explanation.node.world.world_id)) throw new cli_error('memory_not_found', `Memory not found in project ${context.project_id}: ${id}`, exit_codes.validation, { id, project_id: context.project_id });
        return explanation;
    });
    if (!result.node) throw new cli_error('memory_not_found', `Memory not found: ${id}`, exit_codes.validation, { id }, 'longmemory recall "your query"', 'Use an existing memory ID.');
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