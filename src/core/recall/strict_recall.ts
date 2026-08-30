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
 *  file  : src/core/recall/strict_recall.ts
 *  usage : implements the LongMemory strict recall component
 */

import type { HydroNode } from '../types/hydro_node.js';
import type { GateContext } from '../types/recall_mode.js';
import { build_context_packet, type ContextPacket } from './context_builder.js';
import { can_use_in_strict_recall } from './mode_gates.js';
import { plan_strict_recall, type RecallDeps, type RecallQuery } from './recall_planner.js';
import {
    default_strict_scoring_weights,
    score_candidate,
    type ScoredCandidate,
    type StrictScoringWeights,
} from './scoring.js';
import type { CandidateTraceEntry, ExplainTrace } from './explain_trace.js';
import { recall_vector, strict_recall_tokens } from './recall_text.js';

export type StrictRecallOptions = {
    weights?: StrictScoringWeights;
};

export type StrictRecallResult = {
    items: ScoredCandidate[];
    context: ContextPacket;
    trace: ExplainTrace;
};

export function strict_recall(
    query: RecallQuery,
    deps: RecallDeps,
    options: StrictRecallOptions = {},
): StrictRecallResult {
    const at = query.at ?? query.now;
    const weights = options.weights ?? default_strict_scoring_weights;


    const plan = plan_strict_recall(query, deps);


    const retrieved = deps.index.active_nodes(plan.world_ids);

    const query_vector = query.vector ?? deps.embed_query?.(query.text) ?? null;
    const prepared_query_vector = recall_vector(query_vector);
    const resolved_entity_terms = plan.resolved_entities.map((entity) => strict_recall_tokens(entity));


    const accepted: HydroNode[] = [];
    const trace_candidates: CandidateTraceEntry[] = [];
    for (const node of retrieved) {
        const gate_ctx: GateContext = {
            now: at,
            grounding_score: node.grounding.grounding_score,
            unresolved_contradiction: deps.unresolved_contradiction?.(node.id) ?? false,
            thresholds: query.min_confidence != null ? { min_confidence: query.min_confidence } : undefined,
            permission_context: query.permission_context,
        };
        const gate = can_use_in_strict_recall(node, gate_ctx);
        if (gate.allowed) {
            accepted.push(node);
        } else {
            trace_candidates.push({
                id: node.id,
                accepted: false,
                label: gate.label,
                score: null,
                reasons: gate.reasons,
                included: false,
            });
        }
    }


    const limit = query.k == null ? null : Math.max(0, query.k);
    const ranked_entries: Array<{ candidate: ScoredCandidate; order: number }> = [];
    for (let node_index = 0; node_index < accepted.length; node_index++) {
        const node = accepted[node_index];
        const base = score_candidate(
            node,
            {
                at,
                query_terms: plan.intent.terms,
                query_vector: query_vector,
                resolved_entities: plan.resolved_entities,
                contradiction_pressure: deps.contradiction_pressure_of?.(node.id) ?? 0,
                prepared_query_vector,
                resolved_entity_terms,
            },
            weights,
        );
        const sketch_boost = Math.min(
            0.2,
            Math.max(0, deps.sketch_relevance_of?.(node, plan.intent.terms) ?? 0),
        );
        const score = base.score + sketch_boost;
        if (limit === 0) continue;
        const last = ranked_entries.at(-1);
        if (limit !== null && ranked_entries.length >= limit && last && score <= last.candidate.score) continue;
        const candidate: ScoredCandidate = {
            node,
            score,
            breakdown: { ...base, sketch_boost, score },
        };
        if (limit === null) {
            ranked_entries.push({ candidate, order: node_index });
            continue;
        }
        let low = 0;
        let high = ranked_entries.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            const current = ranked_entries[middle];
            if (score > current.candidate.score || (score === current.candidate.score && node_index < current.order)) high = middle;
            else low = middle + 1;
        }
        ranked_entries.splice(low, 0, { candidate, order: node_index });
        if (ranked_entries.length > limit) ranked_entries.pop();
    }
    if (limit === null) ranked_entries.sort((left, right) => right.candidate.score - left.candidate.score || left.order - right.order);
    const items = ranked_entries.map((entry) => entry.candidate);


    const context = build_context_packet(items, query.token_budget ?? Number.POSITIVE_INFINITY);
    const included_ids = new Set(context.items.map((n) => n.id));

    for (const candidate of items) {
        trace_candidates.push({
            id: candidate.node.id,
            accepted: true,
            label: 'active',
            score: candidate.score,
            reasons: [],
            included: included_ids.has(candidate.node.id),
        });
    }


    const trace: ExplainTrace = {
        query: query.text,
        at,
        intent: plan.intent,
        resolved_entities: plan.resolved_entities,
        selected_worlds: plan.world_ids,
        retrieved: retrieved.length,
        accepted: accepted.length,
        rejected: retrieved.length - accepted.length,
        candidates: trace_candidates,
        context_tokens: context.tokens_used,
        budget: context.budget,
        cold_scans: deps.index.cold_scans,
    };

    return { items, context, trace };
}
