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
 *  file  : src/cli/commands/agent/preflight.ts
 *  usage : implements the LongMemory preflight component
 */

import type { cli_command } from '../../context/cli_context.js';
import { command_flags, flag, positional, require_value, with_project } from '../../context/cli_context.js';
import { emit, section } from '../../output/pretty.js';
import { panel } from '../../output/panel.js';

export const agent_preflight_command: cli_command = async (context) => {
    command_flags(context, ['task']);
    const task = require_value(positional(context) ?? flag(context, 'task'), 'task');
    const packet = await with_project(context, (project) => project.getProjectContext(context.project_id, task, context.token_budget));
    const result = {
        ok: true, schema: 'longmemory.agent-preflight.v1', project_id: context.project_id, task,
        current_goal: packet.current_goal, hard_constraints: packet.hard_constraints, architecture_rules: packet.relevant_architecture,
        relevant_files: packet.relevant_files, previous_attempts: packet.retrieved_memories.map((item) => item.node.content.summary || item.node.content.raw),
        known_failures: packet.known_failures, active_decisions: packet.active_decisions, open_tasks: packet.open_tasks,
        conflicts: packet.contradictions, next_steps: packet.suggested_next_steps, citations: packet.citations, debug_trace: packet.debug_trace,
    };
    emit(context, result, () => [panel(task, context.colors, { title: 'Agent Preflight', kind: result.conflicts.length ? 'warning' : 'success', width: context.terminal_width, rows: [['Project', context.project_name], ['Constraints', result.hard_constraints.length], ['Decisions', result.active_decisions.length], ['Failures', result.known_failures.length], ['Conflicts', result.conflicts.length]] }), '', section(context, 'Must Know', [...result.hard_constraints, ...result.architecture_rules].map((item) => `✓ ${item}`).join('\n') || 'No hard constraints recorded.'), '', section(context, 'Next Steps', result.next_steps.map((item, index) => `${index + 1}. ${item}`).join('\n') || 'Inspect the relevant files and proceed.')].join('\n'));
};