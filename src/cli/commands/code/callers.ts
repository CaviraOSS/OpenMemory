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