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
 *  file  : src/core/project/project_decisions.ts
 *  usage : project decision memory views
 */

import type { memory_explanation, open_memory } from '../create_memory.js';
import type { project_state } from './project_state.js';

export type project_decision = {
    memory_id: string;
    decision: string;
    rationale: string | null;
    alternatives_rejected: string[];
    source: string | null;
    decided_at: number;
    current: boolean;
    superseded_by: string | null;
};

export async function get_project_decisions(memory: open_memory, state: project_state): Promise<project_decision[]> {
    const explanations = await Promise.all([...state.decision_nodes].map((id) => memory.explain(id)));
    return explanations.flatMap((item: memory_explanation) => item.node ? [{
        memory_id: item.node.id,
        decision: item.node.content.raw,
        rationale: typeof item.node.metadata.rationale === 'string' ? item.node.metadata.rationale : null,
        alternatives_rejected: Array.isArray(item.node.metadata.alternatives_rejected) ? item.node.metadata.alternatives_rejected as string[] : [],
        source: item.node.provenance.source_trace[0]?.ref ?? null,
        decided_at: item.node.temporal.observed_at,
        current: item.node.state.status === 'active' && item.node.temporal.superseded_at === null,
        superseded_by: item.incoming_edges.find((edge) => edge.type === 'supersedes')?.from ?? null,
    }] : []);
}