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
 *  file  : src/cli/commands/skill/create.ts
 *  usage : implements the LongMemory create component
 */


import type { project_skill_visibility } from '../../../core/project/project_skills.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, list_flag, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

const json_strings = (value: string | undefined, label: string): string[] => {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) throw new Error('expected a JSON string array');
        return parsed;
    } catch (error) { throw new Error(`--${label} must be a JSON string array: ${error instanceof Error ? error.message : String(error)}`); }
};

export const skill_create_command: cli_command = async (context) => {
    command_flags(context, ['id', 'name', 'description', 'triggers', 'instructions-json', 'validation-json', 'resources', 'agents', 'visibility', 'owner']);
    const visibility = (flag(context, 'visibility') ?? 'project') as project_skill_visibility;
    if (!['private', 'project', 'team', 'restricted'].includes(visibility)) throw new Error('--visibility must be private, project, team, or restricted');
    const skill = await with_project(context, (project) => project.createSkill(context.project_id, {
        skill_id: flag(context, 'id'), name: require_value(flag(context, 'name'), 'skill name'),
        description: require_value(flag(context, 'description'), 'skill description'), triggers: list_flag(context, 'triggers'),
        instructions: json_strings(flag(context, 'instructions-json'), 'instructions-json'),
        validation: json_strings(flag(context, 'validation-json'), 'validation-json'),
        resources: list_flag(context, 'resources').map((path) => ({ path })), agent_ids: list_flag(context, 'agents'),
        visibility, owner: flag(context, 'owner'), source_type: 'cli_skill', source_id: context.user_id,
    }));
    emit(context, { ok: true, project_id: context.project_id, skill }, () => `Created ${skill.name} v${skill.version} (${skill.skill_id})`);
};