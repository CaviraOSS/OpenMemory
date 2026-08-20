import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, number_flag } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { table } from '../../output/table.js';
import { discover_sessions, parse_sessions } from '../../porter/orchestrator.js';
import { group_sessions_by_project } from '../../porter/preview.js';
import { parse_harness } from '../porter/common.js';

export const session_discover_command: cli_command = async (context) => {
    command_flags(context, ['from', 'limit']);
    const harness = parse_harness(flag(context, 'from'));
    const limit = Math.max(1, Math.min(500, number_flag(context, 'limit', 100) ?? 100));
    const refs = (await discover_sessions(harness, context.env)).slice(0, limit);
    const sessions = await parse_sessions(harness, refs, context.env);
    const projects = group_sessions_by_project(sessions).map(([cwd, values]) => ({ cwd, sessions: values }));
    emit(context, { ok: true, harness, count: sessions.length, projects }, () => table(sessions.map((session) => ({
        id: session.source_session_id, project: session.cwd || 'unknown', title: session.title, turns: session.turns.length, updated: session.updated_at ? new Date(session.updated_at).toLocaleString() : '—',
    })), [{ key: 'id', label: 'SESSION', min: 10 }, { key: 'project', label: 'PROJECT', min: 12 }, { key: 'title', label: 'PREVIEW', min: 18 }, { key: 'turns', label: 'TURNS', width: 5 }, { key: 'updated', label: 'UPDATED', width: 20 }], context.colors, context.terminal_width));
};