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
 *  file  : src/cli/commands/skill/match.ts
 *  usage : implements the LongMemory match component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, number_flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const skill_match_command: cli_command = async (context) => {
    command_flags(context, ['query', 'agent', 'limit']);
    const query = require_value(positional(context) ?? flag(context, 'query'), 'skill query');
    const matches = await with_project(context, (project) => project.matchSkills(context.project_id, query, flag(context, 'agent'), number_flag(context, 'limit', 5)));
    emit(context, { ok: true, project_id: context.project_id, query, count: matches.length, matches }, () => matches.length
        ? matches.map((match) => `${match.skill.name} · ${match.score.toFixed(3)} · ${match.matched_triggers.join(', ')}`).join('\n')
        : 'No matching skills.');
};