import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, flags, has, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { table } from '../../output/table.js';
import { port_sessions, type porter_event } from '../../porter/orchestrator.js';
import { exit_codes } from '../../output/errors.js';
import { format_event, outcome_counts, parse_harness } from './common.js';

export const port_command: cli_command = async (context) => {
    command_flags(context, ['from', 'to', 'id', 'all', 'force', 'agent']);
    const harness = parse_harness(flag(context, 'from'));
    const destination = flag(context, 'to');
    if (destination !== 'openmemory') throw new Error('--to must be openmemory; direct harness-store writes are intentionally disabled');
    const ids = flags(context, 'id').filter(Boolean);
    const all = has(context, 'all');
    if (!all && !ids.length) throw new Error('one of --all or --id <session-id> is required');
    const on_event = (event: porter_event) => {
        if (context.jsonl) context.io.stdout(JSON.stringify(event));
        else if (context.human) context.io.stderr(`${format_event(event)}\n`);
    };
    const outcomes = await with_project(context, (project) => port_sessions(project, context.project_id, harness, {
        all, ids, force: has(context, 'force'), agent_id: flag(context, 'agent'), env: context.env, on_event,
    }));
    const counts = outcome_counts(outcomes);
    const result = { ok: counts.errors === 0, source: harness, destination: 'openmemory', project_id: context.project_id, counts, outcomes };
    if (counts.errors) context.exit_code = exit_codes.generic;
    if (context.jsonl) context.io.stdout(JSON.stringify({ type: 'summary', ...result }));
    else emit(context, result, () => table(outcomes.map((outcome) => ({ session: outcome.source_session_id, status: outcome.status, asset: outcome.asset_id, detail: outcome.reason ?? outcome.error ?? outcome.imported_session_id ?? '—' })), [{ key: 'session', label: 'SESSION', min: 12 }, { key: 'status', label: 'STATUS', width: 8 }, { key: 'asset', label: 'CHAT MEMORY ASSET', min: 18 }, { key: 'detail', label: 'DETAIL', min: 12 }], context.colors, context.terminal_width));
};