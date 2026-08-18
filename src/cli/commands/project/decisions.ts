import type { cli_command } from '../../context/cli_context.js';
import { command_flags, with_project } from '../../context/cli_context.js';
import { badge } from '../../theme/badges.js';
import { empty_state } from '../../output/empty_state.js';
import { emit } from '../../output/pretty.js';
import { table } from '../../output/table.js';

export const project_decisions_command: cli_command = async (context) => {
    command_flags(context, []);
    const decisions = await with_project(context, (project) => project.getProjectDecisions(context.project_id));
    const result = { ok: true, project_id: context.project_id, decisions };
    emit(context, result, () => decisions.length ? table(decisions.map((item) => ({ status: badge(item.current ? 'ACTIVE' : 'SUPERSEDED', true, context.colors), decision: item.decision, reason: item.rationale ?? '—', date: new Date(item.decided_at).toISOString().slice(0, 10), source: item.source ?? '—' })), [{ key: 'status', label: 'STATUS', width: 13 }, { key: 'decision', label: 'DECISION', min: 16 }, { key: 'reason', label: 'REASON', min: 10 }, { key: 'date', label: 'DATE', width: 10 }, { key: 'source', label: 'SOURCE', min: 7 }], context.colors, context.terminal_width) : empty_state('decisions', context.colors, context.terminal_width));
};