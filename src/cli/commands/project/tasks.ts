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
 *  file  : src/cli/commands/project/tasks.ts
 *  usage : implements the LongMemory tasks component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, with_project } from '../../context/cli_context.js';
import { badge, status_badge } from '../../theme/badges.js';
import { empty_state } from '../../output/empty_state.js';
import { emit } from '../../output/pretty.js';
import { table } from '../../output/table.js';

export const project_tasks_command: cli_command = async (context) => {
    command_flags(context, []);
    const tasks = await with_project(context, (project) => project.getProjectTasks(context.project_id));
    const result = { ok: true, project_id: context.project_id, tasks };
    emit(context, result, () => tasks.length ? table(tasks.map((item) => ({ status: badge(status_badge(item.status), true, context.colors), task: item.task, priority: item.priority ?? 'normal', blocker: item.status === 'blocked' ? 'blocked' : '—', next: item.issue_url ?? '—' })), [{ key: 'status', label: 'STATUS', width: 12 }, { key: 'task', label: 'TASK', min: 18 }, { key: 'priority', label: 'PRIORITY', width: 8 }, { key: 'blocker', label: 'BLOCKER', min: 7 }, { key: 'next', label: 'NEXT STEP', min: 8 }], context.colors, context.terminal_width) : empty_state('tasks', context.colors, context.terminal_width));
};