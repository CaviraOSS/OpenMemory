import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { badge, status_badge } from '../../theme/badges.js';
import { emit, section } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';
import { table } from '../../output/table.js';
import { empty_state } from '../../output/empty_state.js';

export const project_context_command: cli_command = async (context) => {
    command_flags(context, ['task']);
    const task = require_value(positional(context) ?? flag(context, 'task'), 'task');
    const packet = await with_project(context, (project) => project.getProjectContext(context.project_id, task, context.token_budget));
    const result = {
        ok: true, schema: 'openmemory.project-context.v1', project_id: context.project_id, task,
        project_summary: packet.project_summary, current_goal: packet.current_goal, hard_constraints: packet.hard_constraints,
        relevant_architecture: packet.relevant_architecture, relevant_files: packet.relevant_files,
        active_decisions: packet.active_decisions, open_tasks: packet.open_tasks, known_failures: packet.known_failures,
        conflicts: packet.contradictions, suggested_next_steps: packet.suggested_next_steps, citations: packet.citations, debug_trace: packet.debug_trace,
    };
    emit(context, result, () => {
        const blocks = [panel('', context.colors, { title: 'Coding Brief', kind: 'info', width: context.terminal_width, rows: [['Task', task], ['Project', context.project_name], ['Budget', `${packet.debug_trace.tokens_used}/${packet.debug_trace.token_budget} tokens`]] })];
        if (result.current_goal) blocks.push('', section(context, 'Current Goal', result.current_goal));
        if (result.hard_constraints.length) blocks.push('', section(context, 'Hard Constraints', result.hard_constraints.map((item) => `${context.colors.success('✓')} ${item}`).join('\n')));
        if (result.relevant_architecture.length) blocks.push('', section(context, 'Relevant Architecture', result.relevant_architecture.join('\n')));
        if (result.relevant_files.length) blocks.push('', section(context, 'Relevant Files', result.relevant_files.map((file) => `${file.stale ? context.colors.warning('STALE') : context.colors.info('FILE ')} ${file.path}${file.commit ? ` @ ${file.commit}` : ''}`).join('\n')));
        if (result.active_decisions.length) blocks.push('', section(context, 'Active Decisions', table(result.active_decisions.map((item) => ({ status: badge(item.current ? 'ACTIVE' : 'SUPERSEDED', true, context.colors), decision: item.decision, reason: item.rationale ?? '—' })), [{ key: 'status', label: 'STATUS', width: 13 }, { key: 'decision', label: 'DECISION', min: 15 }, { key: 'reason', label: 'REASON', min: 10 }], context.colors, context.terminal_width)));
        if (result.open_tasks.length) blocks.push('', section(context, 'Open Tasks', result.open_tasks.map((item) => `${badge(status_badge(item.status), true, context.colors)} ${item.task}`).join('\n')));
        if (result.known_failures.length) blocks.push('', section(context, 'Known Failures', result.known_failures.map((item) => `${context.colors.danger('FAILED')} ${item}`).join('\n')));
        if (result.conflicts.length) blocks.push('', panel(`${result.conflicts.length} unresolved conflict${result.conflicts.length === 1 ? '' : 's'}`, context.colors, { title: 'Conflicts', kind: 'danger', width: context.terminal_width }));
        if (result.suggested_next_steps.length) blocks.push('', section(context, 'Next Steps', result.suggested_next_steps.map((item, index) => `${index + 1}. ${item}`).join('\n')));
        if (blocks.length === 1) blocks.push('', empty_state('memories', context.colors, context.terminal_width));
        return blocks.join('\n');
    });
};