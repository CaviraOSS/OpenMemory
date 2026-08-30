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
 *  file  : src/cli/commands/code/callers.ts
 *  usage : implements the LongMemory callers component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const code_callers_command: cli_command = async (context) => {
    command_flags(context, []);
    const symbol = require_value(positional(context), 'symbol');
    const callers = await with_project(context, (project) => project.getCodeCallers(context.project_id, symbol));
    emit(context, { ok: true, project_id: context.project_id, symbol, count: callers.length, callers }, () => callers.length
        ? callers.map((relation) => `${relation.caller.name} (${relation.caller.file_path}:${relation.caller.line})`).join('\n') : 'No callers found.');
};