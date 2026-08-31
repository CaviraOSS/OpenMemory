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
 *  file  : src/cli/commands/project/init.ts
 *  usage : implements the LongMemory init component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';
import { tree } from '../../output/tree.js';

export const project_init_command: cli_command = async (context) => {
    command_flags(context, []);
    if (context.dry_run) {
        const preview = { ok: true, dry_run: true, project_id: context.project_id, project_name: context.project_name, db_path: context.db_path };
        emit(context, preview, () => panel('No project state was written.', context.colors, { title: 'Project initialization preview', kind: 'warning', width: context.terminal_width, rows: [['Project', context.project_name], ['Database', context.db_path]] }));
        return;
    }
    const project = await with_project(context, async (manager) => manager.getProject(context.project_id));
    const result = { ok: true, project, db_path: context.db_path, next_command: 'longmemory project context "your task"' };
    emit(context, result, () => [panel('', context.colors, { title: 'Project memory ready', kind: 'success', width: context.terminal_width, rows: [['Project', project.name], ['ID', project.project_id], ['Root world', project.root_world_id], ['Database', context.db_path]] }), '', tree([{ label: `Project: ${project.name}`, children: Object.entries(project.world_ids).map(([name, id]) => ({ label: name, detail: id })) }], context.colors), '', context.colors.info(result.next_command)].join('\n'));
};