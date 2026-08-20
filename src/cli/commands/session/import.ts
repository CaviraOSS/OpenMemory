import { readFileSync } from 'node:fs';
import type { project_session_input } from '../../../core/project/project_sessions.js';
import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';

export const session_import_command: cli_command = async (context) => {
    command_flags(context, ['file']);
    const path = require_value(positional(context) ?? flag(context, 'file'), 'session file');
    let input: project_session_input;
    try { input = JSON.parse(readFileSync(path, 'utf8')) as project_session_input; }
    catch (error) { throw new Error(`invalid session JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`); }
    const session = await with_project(context, (project) => project.importSession(context.project_id, input));
    emit(context, { ok: true, project_id: context.project_id, session }, () => `Imported ${session.message_count} messages from ${session.provider} session ${session.session_id}`);
};