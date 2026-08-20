import type { cli_command } from '../../context/cli_context.js';
import { command_flags, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const code_callees_command: cli_command = async (context) => {
    command_flags(context, []);
    const symbol = require_value(positional(context), 'symbol');
    const callees = await with_project(context, (project) => project.getCodeCallees(context.project_id, symbol));
    emit(context, { ok: true, project_id: context.project_id, symbol, count: callees.length, callees }, () => callees.length
        ? callees.map((relation) => `${relation.callee.name} (${relation.callee.file_path}:${relation.callee.line})`).join('\n') : 'No callees found.');
};