import type { cli_command } from '../../context/cli_context.js';
import { command_flags, has, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const skill_list_command: cli_command = async (context) => {
    command_flags(context, ['all']);
    const skills = await with_project(context, (project) => project.listSkills(context.project_id, has(context, 'all')));
    emit(context, { ok: true, project_id: context.project_id, count: skills.length, skills }, () => skills.length
        ? skills.map((skill) => `${skill.name} v${skill.version} · ${skill.status} · ${skill.skill_id}`).join('\n')
        : 'No project skills.');
};