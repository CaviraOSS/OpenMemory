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
 *  file  : src/cli/commands/code/impact.ts
 *  usage : implements the LongMemory impact component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags, number_flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const code_impact_command: cli_command = async (context) => {
    command_flags(context, ['depth']);
    const symbol = require_value(positional(context), 'symbol');
    const impact = await with_project(context, (project) => project.getCodeImpact(context.project_id, symbol, number_flag(context, 'depth', 5)));
    emit(context, { ok: true, project_id: context.project_id, symbol, count: impact.length, impact }, () => impact.length
        ? impact.map((item) => `${item.depth} · ${item.symbol.name} (${item.symbol.file_path}:${item.symbol.line})${item.via ? ` via ${item.via}` : ''}`).join('\n') : 'No impact path found.');
};