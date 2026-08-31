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
 *  file  : src/cli/commands/skill/bind.ts
 *  usage : implements the LongMemory bind component
 */


import type { cli_command } from '../../context/cli_context.js';
import { command_flags, list_flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const skill_bind_command: cli_command = async (context) => {
    command_flags(context, ['agents']);
    const skill_id = require_value(positional(context), 'skill id');
    const skill = await with_project(context, (project) => project.bindSkill(context.project_id, skill_id, list_flag(context, 'agents')));
    emit(context, { ok: true, project_id: context.project_id, skill }, () => `Bound ${skill.name} v${skill.version} to ${skill.agent_ids.join(', ') || 'all project agents'}`);
};