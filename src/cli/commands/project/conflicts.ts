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
 *  file  : src/cli/commands/project/conflicts.ts
 *  usage : implements the LongMemory conflicts component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags, with_project } from '../../context/cli_context.js';
import { empty_state } from '../../output/empty_state.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';
import { table } from '../../output/table.js';

export const project_conflicts_command: cli_command = async (context) => {
    command_flags(context, []);
    const recalled = await with_project(context, (project) => project.recallProject(context.project_id, { text: '', token_budget: context.token_budget }, 'project_historical'));
    const conflicts = recalled.contradictions;
    const result = { ok: conflicts.length === 0, project_id: context.project_id, conflicts };
    if (conflicts.length) context.exit_code = 3;
    emit(context, result, () => conflicts.length ? [panel(`${conflicts.length} unresolved memory conflict${conflicts.length === 1 ? '' : 's'} require attention.`, context.colors, { title: 'Conflicts', kind: 'danger', width: context.terminal_width }), '', table(conflicts.map((item) => ({ severity: context.colors.danger('CONFLICT'), left: item.text_a ?? item.memory_a, right: item.text_b ?? item.memory_b })), [{ key: 'severity', label: 'SEVERITY', width: 10 }, { key: 'left', label: 'MEMORY A', min: 15 }, { key: 'right', label: 'MEMORY B', min: 15 }], context.colors, context.terminal_width)].join('\n') : empty_state('conflicts', context.colors, context.terminal_width));
};