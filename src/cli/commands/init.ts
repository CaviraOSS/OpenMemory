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
 *  file  : src/cli/commands/init.ts
 *  usage : implements the LongMemory init component
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { cli_command } from '../context/cli_context.js';
import { command_flags, with_project } from '../context/cli_context.js';
import { emit } from '../output/pretty.js';
import { panel } from '../output/panel.js';

export const init_command: cli_command = async (context) => {
    command_flags(context, []);
    const next_commands = ['longmemory mcp', 'longmemory agent preflight "your task"'];
    if (!context.dry_run) {
        mkdirSync(dirname(context.db_path), { recursive: true });
        await with_project(context, (project) => Promise.resolve(project.getProject(context.project_id)));
    }
    const result = { ok: true, project: context.project_id, db_path: context.db_path, dry_run: context.dry_run, next_commands };
    emit(context, result, () => [
        panel('', context.colors, {
            title: 'LongMemory initialized', kind: context.dry_run ? 'warning' : 'success', width: context.terminal_width, rows: [
                ['Project', context.project_name], ['ID', context.project_id], ['Database', context.db_path], ['Mode', context.dry_run ? 'dry run' : 'local'],
            ]
        }),
        '', context.colors.title('Next'), ...next_commands.map((command) => `  ${context.colors.info(command)}`),
    ].join('\n'));
};