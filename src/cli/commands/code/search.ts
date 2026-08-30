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
 *  file  : src/cli/commands/code/search.ts
 *  usage : implements the LongMemory search component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, number_flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const code_search_command: cli_command = async (context) => {
    command_flags(context, ['query', 'limit']);
    const query = require_value(positional(context) ?? flag(context, 'query'), 'symbol query');
    const symbols = await with_project(context, (project) => project.searchCodeSymbols(context.project_id, query, number_flag(context, 'limit', 20)));
    emit(context, { ok: true, project_id: context.project_id, query, count: symbols.length, symbols }, () => symbols.length
        ? symbols.map((symbol) => `${symbol.kind} ${symbol.name} · ${symbol.file_path}:${symbol.line}`).join('\n') : 'No code symbols found.');
};