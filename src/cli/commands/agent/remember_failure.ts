import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, list_flag, require_value, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';

export const agent_remember_failure_command: cli_command = async (context) => {
    command_flags(context, ['task', 'error', 'attempted-fix', 'why-failed', 'files', 'next-suggestion']);
    const input = {
        task: require_value(flag(context, 'task'), '--task'), error: require_value(flag(context, 'error'), '--error'),
        attempted_fix: require_value(flag(context, 'attempted-fix'), '--attempted-fix'), why_failed: require_value(flag(context, 'why-failed'), '--why-failed'),
        files: list_flag(context, 'files'), next_suggestion: require_value(flag(context, 'next-suggestion'), '--next-suggestion'),
    };
    if (context.dry_run) { emit(context, { ok: true, dry_run: true, ...input }, () => panel(input.error, context.colors, { title: 'Failure preview', kind: 'warning', width: context.terminal_width, rows: [['Task', input.task], ['Write', 'skipped']] })); return; }
    const memory_id = await with_project(context, (project) => project.ingestProjectEvent(context.project_id, { kind: 'failure', text: input.error, topic: input.task, files_touched: input.files, next_actions: [input.next_suggestion], metadata: { attempted_fix: input.attempted_fix, why_failed: input.why_failed }, source_type: 'agent_failure' }));
    emit(context, { ok: true, memory_id, ...input }, () => panel(input.error, context.colors, { title: 'Failure remembered', kind: 'danger', width: context.terminal_width, rows: [['Task', input.task], ['Attempt', input.attempted_fix], ['Why', input.why_failed], ['Next', input.next_suggestion]] }));
};