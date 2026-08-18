/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/project/project_context.ts
 *  usage : token-budgeted project handoff packet
 */

import { count_tokens } from '../recall/context_builder.js';
import type { open_memory } from '../create_memory.js';
import { get_project_decisions, type project_decision } from './project_decisions.js';
import { get_project_tasks, type project_task } from './project_tasks.js';
import { recall_project_memory, type project_citation, type project_contradiction_warning, type project_recalled_memory } from './project_recall.js';
import type { ProjectWorld } from './project_world.js';
import type { project_state } from './project_state.js';

export type project_context_packet = {
    project_summary: string;
    current_goal: string | null;
    hard_constraints: string[];
    relevant_architecture: string[];
    relevant_files: Array<{ path: string; commit: string | null; memory_id: string; stale: boolean }>;
    active_decisions: project_decision[];
    open_tasks: project_task[];
    known_failures: string[];
    retrieved_memories: project_recalled_memory[];
    contradictions: project_contradiction_warning[];
    citations: project_citation[];
    suggested_next_steps: string[];
    debug_trace: Record<string, unknown> & { tokens_used: number; token_budget: number; within_budget: boolean };
};

const texts = async (memory: open_memory, ids: Iterable<string>): Promise<string[]> => {
    const values = await Promise.all([...ids].map((id) => memory.explain(id)));
    return values.flatMap((item) => item.node && item.node.state.status === 'active' ? [item.node.content.raw] : []);
};

export async function get_project_context_packet(memory: open_memory, project: ProjectWorld, state: project_state, task: string, token_budget = 2048): Promise<project_context_packet> {
    const recalled = await recall_project_memory(memory, project, state, { text: task, token_budget, k: 50 }, 'project_planning');
    const code = await recall_project_memory(memory, project, state, { text: task, token_budget, k: 50 }, 'project_code');
    const decisions = (await get_project_decisions(memory, state)).filter((item) => item.current);
    const tasks = (await get_project_tasks(memory, state)).filter((item) => !['completed', 'resolved', 'stale'].includes(item.status));
    const architecture = (await Promise.all([...state.nodes.values()].filter((item) => item.kind === 'architecture').map((item) => memory.explain(item.node_id))))
        .flatMap((item) => item.node?.state.status === 'active' ? [item.node.content.raw] : []);
    const constraints = await texts(memory, state.constraint_nodes);
    const failures = [...new Set([...(await texts(memory, state.failure_nodes)), ...state.agent.known_failures])];
    const packet: project_context_packet = {
        project_summary: project.description || project.name,
        current_goal: (await texts(memory, state.goal_nodes))[0] ?? state.agent.last_active_task,
        hard_constraints: constraints,
        relevant_architecture: architecture,
        relevant_files: code.code_facts.filter((item) => item.file_path).map((item) => ({ path: item.file_path as string, commit: item.commit, memory_id: item.memory_id, stale: item.stale })),
        active_decisions: decisions,
        open_tasks: tasks,
        known_failures: failures,
        retrieved_memories: [...recalled.memories, ...code.memories],
        contradictions: recalled.contradictions,
        citations: [...recalled.citations, ...code.citations],
        suggested_next_steps: state.agent.next_actions.length ? state.agent.next_actions : tasks.slice(0, 5).map((item) => item.task),
        debug_trace: { task, project_world_id: project.root_world_id, planning: recalled.debug_trace, code: code.debug_trace, tokens_used: 0, token_budget, within_budget: true },
    };
    const fixed = count_tokens(JSON.stringify({
        project_summary: packet.project_summary,
        current_goal: packet.current_goal,
        hard_constraints: packet.hard_constraints,
        relevant_architecture: packet.relevant_architecture,
        active_decisions: packet.active_decisions,
        open_tasks: packet.open_tasks,
        known_failures: packet.known_failures,
        contradictions: packet.contradictions,
        suggested_next_steps: packet.suggested_next_steps,
    }));
    let used = Math.min(fixed, token_budget);
    const selected: project_recalled_memory[] = [];
    for (const memory_item of packet.retrieved_memories) {
        const cost = count_tokens(memory_item.node.content.summary || memory_item.node.content.raw);
        if (used + cost > token_budget) continue;
        selected.push(memory_item);
        used += cost;
    }
    packet.retrieved_memories = selected;
    const selected_ids = new Set(selected.map((item) => item.node.id));
    packet.citations = packet.citations.filter((citation) => selected_ids.has(citation.memory_id));
    packet.relevant_files = packet.relevant_files.filter((file) => selected_ids.has(file.memory_id));
    packet.debug_trace.tokens_used = used;
    packet.debug_trace.within_budget = used <= token_budget;
    return packet;
}