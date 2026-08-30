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
 *  file  : src/core/recall/historical_recall.ts
 *  usage : implements the LongMemory historical recall component
 */

import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { GateContext } from '../types/recall_mode.js';
import { can_access_node } from './mode_gates.js';
import { plan_strict_recall, type RecallDeps } from './recall_planner.js';
import {
    build_timeline,
    type SupersessionChain,
    type Timeline,
    type TimelineEntry,
} from './timeline_builder.js';
import { is_subject_relevant, prepare_subject_relevance } from './subject_relevance.js';

export type HistoricalQuery = {
    text: string;
    now: number;

    valid_time?: number;

    recorded_time?: number;
    world_id?: string;
    entity_names?: string[];
    permission_context?: GateContext['permission_context'];
};

export type HistoricalDeps = RecallDeps & {

    supersedes_edges?: readonly HydroEdge[];
};

export type HistoricalExplainTrace = {
    query: string;
    now: number;
    valid_time?: number;
    recorded_time?: number;
    intent: { terms: string[]; entity_names: string[] };
    resolved_entities: string[];
    selected_worlds: string[] | null;
    retrieved: number;
    relevant: number;
    world_truth_count: number;
    agent_belief_count: number;
    current_truth_count: number;
    chains: SupersessionChain[];
    entries: TimelineEntry[];
};

export type HistoricalRecallResult = {
    timeline: Timeline;
    trace: HistoricalExplainTrace;
};

export function historical_recall(query: HistoricalQuery, deps: HistoricalDeps): HistoricalRecallResult {
    // Steps 2-3: resolve entities and select worlds (reuse the planner).
    const plan = plan_strict_recall(
        { text: query.text, now: query.now, world_id: query.world_id, entity_names: query.entity_names },
        deps,
    );

    // Step 4: query bitemporal candidates from the working set (superseded nodes
    // remain here; historical recall does not require a cold scan for them).
    const retrieved = deps.index.active_nodes(plan.world_ids);
    const relevance = prepare_subject_relevance(plan.intent.terms, plan.resolved_entities);

    // Keep only candidates relevant to the query subject.
    const relevant = retrieved.filter((node) =>
        can_access_node(node, { now: query.now, permission_context: query.permission_context }).allowed &&
        is_subject_relevant(node, relevance));

    // Steps 5-7: build the timeline and the three temporal views.
    const timeline = build_timeline(relevant, deps.supersedes_edges ?? [], {
        now: query.now,
        valid_time: query.valid_time,
        recorded_time: query.recorded_time,
    });

    // Step 8: explain trace.
    const trace: HistoricalExplainTrace = {
        query: query.text,
        now: query.now,
        valid_time: query.valid_time,
        recorded_time: query.recorded_time,
        intent: plan.intent,
        resolved_entities: plan.resolved_entities,
        selected_worlds: plan.world_ids,
        retrieved: retrieved.length,
        relevant: relevant.length,
        world_truth_count: timeline.world_truth_at_time.length,
        agent_belief_count: timeline.agent_belief_at_time.length,
        current_truth_count: timeline.current_truth.length,
        chains: timeline.chains,
        entries: timeline.entries,
    };

    return { timeline, trace };
}
