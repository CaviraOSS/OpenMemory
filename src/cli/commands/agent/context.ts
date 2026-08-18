import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, positional, with_project } from '../../context/cli_context.js';
import { emit } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';

export const agent_context_command: cli_command = async (context) => {
    command_flags(context, ['task']);
    const task = positional(context) ?? flag(context, 'task') ?? 'current work';
    const packet = await with_project(context, (project) => project.getProjectContext(context.project_id, task, Math.min(context.token_budget, 1024)));
    const result = { ok: true, schema: 'openmemory.agent-context.v1', project_id: context.project_id, task, goal: packet.current_goal, constraints: packet.hard_constraints, files: packet.relevant_files, decisions: packet.active_decisions, tasks: packet.open_tasks, failures: packet.known_failures, conflicts: packet.contradictions, next_steps: packet.suggested_next_steps, tokens: packet.debug_trace.tokens_used };
    emit(context, result, () => panel(result.goal ?? task, context.colors, { title: 'Agent Context', kind: result.conflicts.length ? 'warning' : 'info', width: context.terminal_width, rows: [['Project', context.project_name], ['Files', result.files.length], ['Decisions', result.decisions.length], ['Open tasks', result.tasks.length], ['Token use', result.tokens]] }));
};