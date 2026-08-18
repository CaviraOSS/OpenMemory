import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, list_flag, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';

export const agent_after_run_command: cli_command = async (context) => {
    command_flags(context, ['summary', 'files', 'commands', 'tests', 'errors', 'decisions', 'next-steps']);
    const summary = require_value(flag(context, 'summary'), '--summary');
    const input = { summary, files_touched: list_flag(context, 'files'), commands_run: list_flag(context, 'commands'), tests_run: list_flag(context, 'tests'), errors_seen: list_flag(context, 'errors').filter((item) => item.toLowerCase() !== 'none'), decisions_made: list_flag(context, 'decisions'), next_steps: list_flag(context, 'next-steps') };
    if (context.dry_run) { emit(context, { ok: true, dry_run: true, ...input }, () => panel(summary, context.colors, { title: 'After-run preview', kind: 'warning', width: context.terminal_width, rows: [['Write', 'skipped'], ['Files', input.files_touched.length], ['Errors', input.errors_seen.length]] })); return; }
    const memory_ids = await with_project(context, async (project) => {
        const ids = [await project.ingestProjectEvent(context.project_id, { kind: 'agent_state', text: summary, topic: summary, files_touched: input.files_touched, next_actions: input.next_steps, metadata: { commands_run: input.commands_run, test_results: input.tests_run, known_failures: input.errors_seen, decisions_made: input.decisions_made }, replace_current: true })];
        for (const decision of input.decisions_made) ids.push(await project.ingestProjectEvent(context.project_id, { kind: 'decision', text: decision, topic: decision, source_type: 'agent_run' }));
        return ids;
    });
    emit(context, { ok: true, ...input, memory_ids }, () => panel(summary, context.colors, { title: 'Agent run remembered', kind: input.errors_seen.length ? 'warning' : 'success', width: context.terminal_width, rows: [['Memories', memory_ids.length], ['Files', input.files_touched.length], ['Tests', input.tests_run.join(', ') || 'not recorded'], ['Next', input.next_steps.join(', ') || 'not recorded']] }));
};