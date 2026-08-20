import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, number_flag, positional, require_value, time_flag, with_memory } from '../../context/cli_context.js';
import { cli_error, exit_codes } from '../../output/errors.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';
import { resolve_project_scope } from '../../context/project_scope.js';

export const maintenance_reinforce_command: cli_command = async (context) => {
    command_flags(context, ['id', 'amount', 'at']);
    if (context.dry_run) throw new cli_error('validation_error', 'maintenance reinforce cannot run with --dry-run', exit_codes.validation);
    const id = require_value(positional(context) ?? flag(context, 'id'), 'memory id');
    const result = await with_memory(context, async (memory) => {
        const scope = await resolve_project_scope(memory, context.project_id);
        const explanation = await memory.explain(id);
        if (!explanation.node || (!scope.legacy && !scope.world_ids.has(explanation.node.world.world_id))) {
            throw new cli_error('memory_not_found', `Memory not found in project ${context.project_id}: ${id}`, exit_codes.validation, { id, project_id: context.project_id });
        }
        const node = await memory.reinforce(id, { at: time_flag(context, 'at'), amount: number_flag(context, 'amount') });
        return { ok: true, memory_id: id, activation: node.state.activation, decay_rate: node.state.decay_rate, reinforcement_count: node.state.reinforcement_count ?? 0, last_reinforced_at: node.state.last_reinforced_at };
    });
    emit(context, result, () => panel('', context.colors, {
        title: 'Memory reinforced', kind: 'success', width: context.terminal_width, rows: [
            ['ID', id], ['Activation', result.activation.toFixed(3)], ['Decay rate', result.decay_rate.toFixed(4)],
            ['Reinforcements', result.reinforcement_count], ['At', result.last_reinforced_at ? new Date(result.last_reinforced_at).toISOString() : 'unknown'],
        ]
    }));
};