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
 *  file  : src/cli/commands/skill/archive.ts
 *  usage : implements the LongMemory archive component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const skill_archive_command: cli_command = async (context) => {
    command_flags(context, []);
    const skill_id = require_value(positional(context), 'skill id');
    const skill = await with_project(context, (project) => project.archiveSkill(context.project_id, skill_id));
    emit(context, { ok: true, project_id: context.project_id, skill }, () => `Archived ${skill.name} v${skill.version}`);
};