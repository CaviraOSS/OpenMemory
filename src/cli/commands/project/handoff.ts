/*
*      __                      __  ___                               
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/cli/commands/project/handoff.ts
 *  usage : implements the LongMemory handoff component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, positional, with_project } from '../../context/cli_context.js';
import { emit, section } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';

export const project_handoff_command: cli_command = async (context) => {
    command_flags(context, ['task']);
    const task = positional(context) ?? flag(context, 'task') ?? 'continue current project work';
    const packet = await with_project(context, (project) => project.getProjectContext(context.project_id, task, context.token_budget));
    const result = {
        ok: true, schema: 'longmemory.project-handoff.v1', project_id: context.project_id, task,
        working_on: packet.current_goal ?? task,
        changed_recently: packet.retrieved_memories.slice(0, 8).map((item) => item.node.content.summary || item.node.content.raw),
        decisions: packet.active_decisions, failures: packet.known_failures, conflicts: packet.contradictions,
        next_steps: packet.suggested_next_steps, files: packet.relevant_files, citations: packet.citations,
    };
    emit(context, result, () => [panel(result.working_on, context.colors, { title: 'Project Handoff', kind: 'info', width: context.terminal_width, rows: [['Project', context.project_name], ['Decisions', result.decisions.length], ['Failures', result.failures.length], ['Conflicts', result.conflicts.length]] }), '', section(context, 'What Changed', result.changed_recently.join('\n') || 'No recent changes recorded.'), '', section(context, 'What Matters', result.decisions.map((item) => item.decision).join('\n') || 'No active decisions.'), '', section(context, 'Next', result.next_steps.map((item, index) => `${index + 1}. ${item}`).join('\n') || 'No next steps recorded.')].join('\n'));
};