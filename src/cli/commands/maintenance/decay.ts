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
 *  file  : src/cli/commands/maintenance/decay.ts
 *  usage : implements the LongMemory decay component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, has, number_flag, time_flag, with_memory } from '../../context/cli_context.js';
import { cli_error, exit_codes } from '../../output/errors.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';
import { resolve_project_scope } from '../../context/project_scope.js';

export const maintenance_decay_command: cli_command = async (context) => {
    command_flags(context, ['limit', 'after-id', 'world', 'at', 'min-change', 'all']);
    if (context.dry_run) throw new cli_error('validation_error', 'maintenance decay cannot run with --dry-run', exit_codes.validation);
    const limit = number_flag(context, 'limit', 256) as number;
    const min_change = number_flag(context, 'min-change');
    const at = time_flag(context, 'at') ?? Date.now();
    const run_all = has(context, 'all');
    const result = await with_memory(context, async (memory) => {
        const scope = await resolve_project_scope(memory, context.project_id);
        const requested_world = flag(context, 'world');
        if (requested_world && !scope.legacy && !scope.world_ids.has(requested_world)) throw new cli_error('world_not_found', `World does not belong to project ${context.project_id}: ${requested_world}`, exit_codes.validation, { world_id: requested_world });
        const world_id = requested_world ?? scope.root?.id;
        const cycles = [];
        let cursor = flag(context, 'after-id');
        do {
            const cycle = await memory.runDecay({ now: at, world_id, limit, after_id: cursor, min_change });
            cycles.push(cycle);
            cursor = cycle.next_cursor ?? undefined;
        } while (run_all && cursor);
        return {
            ok: true,
            at,
            complete: cycles.at(-1)?.complete ?? true,
            next_cursor: cycles.at(-1)?.next_cursor ?? null,
            cycles: cycles.length,
            scanned: cycles.reduce((sum, cycle) => sum + cycle.scanned, 0),
            updated: cycles.reduce((sum, cycle) => sum + cycle.updated, 0),
            tiers: cycles.reduce((total, cycle) => ({ hot: total.hot + cycle.tiers.hot, warm: total.warm + cycle.tiers.warm, cold: total.cold + cycle.tiers.cold }), { hot: 0, warm: 0, cold: 0 }),
        };
    });
    emit(context, result, () => panel('', context.colors, {
        title: 'Decay maintenance', kind: 'success', width: context.terminal_width, rows: [
            ['Scanned', result.scanned], ['Updated', result.updated], ['Cycles', result.cycles], ['Complete', result.complete],
            ['Tiers', `hot ${result.tiers.hot} · warm ${result.tiers.warm} · cold ${result.tiers.cold}`], ['Next cursor', result.next_cursor ?? 'none'],
        ]
    }));
};