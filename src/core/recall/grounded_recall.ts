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
 *  file  : src/core/recall/grounded_recall.ts
 *  usage : implements the LongMemory grounded recall component
 */


import {
    compute_grounding_score,
    default_grounding_weights,
    freshness_score,
    type GroundingScoreWeights,
} from '../grounding/grounding_score.js';
import type { WorldDBAdapter } from '../grounding/worlddb_adapter.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { GateContext } from '../types/recall_mode.js';
import { build_context_packet, type ContextPacket } from './context_builder.js';
import { can_use_in_world_grounded_recall } from './mode_gates.js';
import { plan_strict_recall, type RecallDeps } from './recall_planner.js';
import type {
    GroundedCandidateTrace,
    Reconciliation,
    WorldGroundedTrace,
} from './grounding_trace.js';
import { is_subject_relevant, prepare_subject_relevance } from './subject_relevance.js';
import { recall_vector, type RecallVector } from './recall_text.js';

export type GroundedQuery = {
    text: string;
    now: number;
    world_id?: string;
    entity_names?: string[];
    k?: number;
    token_budget?: number;
    min_freshness?: number;
    min_source_reliability?: number;
    grounding_threshold?: number;
    permission_context?: GateContext['permission_context'];
};

export type GroundedDeps = RecallDeps & {
    worlddb: WorldDBAdapter;

    grounds_edges?: readonly HydroEdge[];
    weights?: GroundingScoreWeights;
};

export type GroundedItem = {
    node: HydroNode;
    fact_ref: string;
    grounding_score: number;
    freshness: number;
    reconciliation: Reconciliation;
};

export type GroundedRecallResult = {
    items: GroundedItem[];
    context: ContextPacket;
    trace: WorldGroundedTrace;
};

function cosine01(a: RecallVector | null, b: RecallVector | null): number {
    if (!a || !b || a.values.length !== b.values.length) return 0.5;
    let dot = 0;
    for (let index = 0; index < a.values.length; index++) dot += a.values[index] * b.values[index];
    if (a.norm === 0 || b.norm === 0) return 0.5;
    return Math.min(1, Math.max(0, dot / (a.norm * b.norm)));
}

function reconcile(grounded: boolean, agreement: number): Reconciliation {
    if (!grounded) return 'subjective_only';
    if (agreement >= 0.7) return 'confirmed';
    if (agreement <= 0.3) return 'contradicted';
    return 'unconfirmed';
}

export function grounded_recall(query: GroundedQuery, deps: GroundedDeps): GroundedRecallResult {
    const at = query.now;
    const weights = deps.weights ?? default_grounding_weights;

    // Steps 2-3: resolve entities + select worlds.
    const plan = plan_strict_recall(
        { text: query.text, now: query.now, world_id: query.world_id, entity_names: query.entity_names },
        deps,
    );

    // Step 4: find endocortex memories related to the query.
    const retrieved = deps.index.active_nodes(plan.world_ids);
    const relevance = prepare_subject_relevance(plan.intent.terms, plan.resolved_entities);
    const endocortex = retrieved.filter(
        (node) => node.world.zone === 'endocortex' && is_subject_relevant(node, relevance),
    );

    // Step 5: map each memory to its exocortex fact via grounds edges or ref.
    const fact_ref_of = new Map<string, string>();
    for (const edge of deps.grounds_edges ?? []) {
        if (edge.type === 'grounds') fact_ref_of.set(edge.from, edge.to);
    }

    const thresholds = {
        minFreshness: query.min_freshness,
        minSourceReliability: query.min_source_reliability,
        groundingThreshold: query.grounding_threshold,
    };

    const items: GroundedItem[] = [];
    const candidates: GroundedCandidateTrace[] = [];

    for (const node of endocortex) {
        const fact_ref = fact_ref_of.get(node.id) ?? node.grounding.worlddb_ref;
        const fact = fact_ref ? deps.worlddb.get(fact_ref) : null;

        if (!fact) {
            // Rule 1/3: ungrounded -> only subjective context, never a grounded answer.
            candidates.push({
                memory_id: node.id,
                grounded: false,
                fact_ref: fact_ref ?? null,
                source_id: null,
                source_kind: null,
                source_reliability: null,
                freshness: 0,
                grounding_score: 0,
                reconciliation: 'subjective_only',
                accepted: false,
                reasons: ['not grounded to an external fact'],
            });
            continue;
        }

        // Steps 6-7: recompute grounding live from the current fact.
        const freshness = freshness_score(fact.observed_at, fact.valid_to, at);
        const reliability = fact.source.reliability;
        const agreement = cosine01(recall_vector(node.vectors.semantic), recall_vector(fact.vector));
        const trace = compute_grounding_score(
            node.id,
            fact.ref,
            {
                source_reliability: reliability,
                freshness,
                observation_count: fact.observation_count,
                external_agreement: agreement,
                conflict: 0,
            },
            weights,
            at,
        );

        // Step 8: reconcile subjective belief with external fact.
        const reconciliation = reconcile(true, agreement);

        const gate_ctx: GateContext = {
            now: at,
            grounding_score: trace.grounding_score,
            freshness,
            source_reliability: reliability,
            thresholds: {
                ...(thresholds.minFreshness != null ? { min_freshness: thresholds.minFreshness } : {}),
                ...(thresholds.minSourceReliability != null
                    ? { min_source_reliability: thresholds.minSourceReliability }
                    : {}),
                ...(thresholds.groundingThreshold != null
                    ? { grounding_threshold: thresholds.groundingThreshold }
                    : {}),
            },
            permission_context: query.permission_context,
        };
        const gate = can_use_in_world_grounded_recall(node, gate_ctx);

        candidates.push({
            memory_id: node.id,
            grounded: true,
            fact_ref: fact.ref,
            source_id: fact.source.id,
            source_kind: fact.source.kind,
            source_reliability: reliability,
            freshness,
            grounding_score: trace.grounding_score,
            reconciliation,
            accepted: gate.allowed,
            reasons: gate.reasons,
        });

        if (gate.allowed) {
            items.push({
                node,
                fact_ref: fact.ref,
                grounding_score: trace.grounding_score,
                freshness,
                reconciliation,
            });
        }
    }

    // Rule 2: fresher, stronger grounding ranks higher.
    items.sort((a, b) => b.grounding_score - a.grounding_score || b.freshness - a.freshness);
    const ranked = query.k != null ? items.slice(0, query.k) : items;

    // Step 9: grounded context + trace.
    const context = build_context_packet(ranked, query.token_budget ?? Number.POSITIVE_INFINITY);
    const trace: WorldGroundedTrace = {
        query: query.text,
        now: at,
        intent: plan.intent,
        resolved_entities: plan.resolved_entities,
        selected_worlds: plan.world_ids,
        retrieved: retrieved.length,
        endocortex: endocortex.length,
        grounded_accepted: ranked.length,
        rejected: candidates.filter((c) => !c.accepted).length,
        candidates,
    };

    return { items: ranked, context, trace };
}
