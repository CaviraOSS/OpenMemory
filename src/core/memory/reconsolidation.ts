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
 *  file  : src/core/memory/reconsolidation.ts
 *  usage : implements the LongMemory reconsolidation component
 */

import {
    compute_grounding_score,
    freshness_score,
    type GroundingScoreWeights,
    type GroundingTrace,
} from '../grounding/grounding_score.js';
import type { WorldDBAdapter } from '../grounding/worlddb_adapter.js';
import type { Reconciliation } from '../recall/grounding_trace.js';
import type { Contradiction } from '../types/contradiction.js';
import type { Facet } from '../types/facets.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode, NodeContent } from '../types/hydro_node.js';
import type { NodeStatus } from '../types/node_state.js';
import type { Provenance } from '../types/provenance.js';
import { manual_provenance } from '../types/provenance.js';
import type { RecallMode } from '../types/recall_mode.js';
import { create_hydro_edge } from './durable_graph.js';

export type ReconsolidationContext = {
    now: number;
    
    nodes?: readonly HydroNode[];
    
    get_node?: (id: string) => HydroNode | undefined;
    
    edges?: readonly HydroEdge[];
    
    worlddb?: WorldDBAdapter;
    
    contradictions?: readonly Contradiction[];
    
    contradiction_pressure_of?: (node_id: string) => number;
    grounding_weights?: GroundingScoreWeights;
};

export type SupersessionView = {
    
    ordered: string[];
    
    current: HydroNode | null;
    superseded: boolean;
};

export type ContradictionStatus = {
    contradicted: boolean;
    unresolved: boolean;
    pressure: number;
    contradictions: Contradiction[];
    warning: string | null;
};

export type GroundingStatus = {
    grounded: boolean;
    fact_ref: string | null;
    source_id: string | null;
    source_kind: string | null;
    source_reliability: number | null;
    freshness: number;
    grounding_score: number;
    
    still_valid: boolean;
    reconciliation: Reconciliation;
    trace: GroundingTrace | null;
};

export type HistoricalTrace = {
    memory_id: string;
    content: NodeContent;
    observed_at: number;
    valid_from: number;
    valid_to: number | null;
    recorded_at: number;
    superseded_at: number | null;
    status_at_recall: NodeStatus;
    
    emotional_residue: Facet | null;
    provenance: Provenance;
};

export type ReconsolidatedState = {
    now: number;
    supersession: SupersessionView;
    contradiction: ContradictionStatus;
    grounding: GroundingStatus;
    historical: HistoricalTrace;
};

export type CurrentTruth = {
    id: string;
    content: NodeContent;
    observed_at: number;
    valid_from: number;
};

export type ReconsolidatedView = {
    original_id: string;
    current_status: NodeStatus;
    is_superseded: boolean;
    
    current_truth: CurrentTruth | null;
    supersession_chain: string[];
    historical_residue: HistoricalTrace;
    contradiction: ContradictionStatus;
    grounding: GroundingStatus;
    recommended_mode: RecallMode;
    warnings: string[];
    
    provenance: Provenance;
};

function clamp01(x: number): number {
    return Math.min(1, Math.max(0, x));
}

function cosine01(a: number[] | null, b: number[] | null): number {
    if (!a || !b || a.length === 0 || a.length !== b.length) return 0.5;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0.5;
    return clamp01(dot / (Math.sqrt(na) * Math.sqrt(nb)));
}

function make_lookup(ctx: ReconsolidationContext): (id: string) => HydroNode | undefined {
    if (ctx.get_node) return ctx.get_node;
    const map = new Map((ctx.nodes ?? []).map((n) => [n.id, n]));
    return (id: string) => map.get(id);
}


export function follow_supersession_chain(
    node: HydroNode,
    ctx: ReconsolidationContext,
): SupersessionView {
    const lookup = make_lookup(ctx);
    const successor = new Map<string, string>();
    const predecessor = new Map<string, string>();
    for (const edge of ctx.edges ?? []) {
        if (edge.type !== 'supersedes') continue;
        
        successor.set(edge.to, edge.from);
        predecessor.set(edge.from, edge.to);
    }

    
    let head = node.id;
    const seen_back = new Set<string>([head]);
    while (predecessor.has(head)) {
        const prev = predecessor.get(head)!;
        if (seen_back.has(prev)) break;
        head = prev;
        seen_back.add(prev);
    }

    
    const ordered: string[] = [];
    const seen_fwd = new Set<string>();
    let cursor: string | undefined = head;
    let current: HydroNode | null = null;
    while (cursor && !seen_fwd.has(cursor)) {
        ordered.push(cursor);
        seen_fwd.add(cursor);
        const resolved = lookup(cursor);
        if (resolved) current = resolved;
        cursor = successor.get(cursor);
    }

    const newest = ordered[ordered.length - 1];
    const superseded =
        node.temporal.superseded_at !== null ||
        node.state.status === 'superseded' ||
        (newest !== undefined && newest !== node.id);

    return { ordered, current: current ?? lookup(node.id) ?? null, superseded };
}


export function check_contradiction_status(
    node: HydroNode,
    ctx: ReconsolidationContext,
): ContradictionStatus {
    const related = (ctx.contradictions ?? []).filter(
        (c) => c.node_a === node.id || c.node_b === node.id,
    );
    const unresolved_list = related.filter((c) => !c.resolved);
    const status_contradicted = node.state.status === 'contradicted';
    const contradicted = status_contradicted || related.length > 0;
    const unresolved = status_contradicted || unresolved_list.length > 0;
    const pressure = clamp01(
        ctx.contradiction_pressure_of?.(node.id) ??
        Math.max(0, ...unresolved_list.map((c) => c.pressure)),
    );

    let warning: string | null = null;
    if (contradicted) {
        warning = unresolved
            ? 'unresolved contradiction: do not use as current truth'
            : 'previously contradicted (now resolved)';
    }

    return { contradicted, unresolved, pressure, contradictions: related, warning };
}


export function check_current_grounding(
    node: HydroNode,
    ctx: ReconsolidationContext,
): GroundingStatus {
    let ref = node.grounding.worlddb_ref;
    for (const edge of ctx.edges ?? []) {
        if (edge.type === 'grounds' && edge.from === node.id) {
            ref = edge.to;
            break;
        }
    }

    const fact = ref && ctx.worlddb ? ctx.worlddb.get(ref) : null;
    if (!fact) {
        return {
            grounded: false,
            fact_ref: ref ?? null,
            source_id: null,
            source_kind: null,
            source_reliability: null,
            freshness: 0,
            grounding_score: 0,
            still_valid: false,
            reconciliation: 'subjective_only',
            trace: null,
        };
    }

    const now = ctx.now;
    const freshness = freshness_score(fact.observed_at, fact.valid_to, now);
    const reliability = fact.source.reliability;
    const agreement = cosine01(node.vectors.semantic, fact.vector);
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
        ctx.grounding_weights,
        now,
    );

    const still_valid = fact.valid_to === null || now < fact.valid_to;
    let reconciliation: Reconciliation;
    if (!still_valid) {
        
        reconciliation = 'contradicted';
    } else if (agreement >= 0.7) {
        reconciliation = 'confirmed';
    } else if (agreement <= 0.3) {
        reconciliation = 'contradicted';
    } else {
        reconciliation = 'unconfirmed';
    }

    return {
        grounded: true,
        fact_ref: fact.ref,
        source_id: fact.source.id,
        source_kind: fact.source.kind,
        source_reliability: reliability,
        freshness,
        grounding_score: trace.grounding_score,
        still_valid,
        reconciliation,
        trace,
    };
}


export function preserve_historical_trace(node: HydroNode): HistoricalTrace {
    return {
        memory_id: node.id,
        content: node.content,
        observed_at: node.temporal.observed_at,
        valid_from: node.temporal.valid_from,
        valid_to: node.temporal.valid_to,
        recorded_at: node.temporal.recorded_at,
        superseded_at: node.temporal.superseded_at,
        status_at_recall: node.state.status,
        emotional_residue: node.facets.emotional,
        provenance: node.provenance,
    };
}

function recommend_mode(node: HydroNode, s: ReconsolidatedState): RecallMode {
    
    if (s.contradiction.contradicted && s.contradiction.unresolved) return 'associative';
    if (s.supersession.superseded) return 'historical';
    if (s.grounding.grounded) {
        if (s.grounding.still_valid && s.grounding.reconciliation === 'confirmed') return 'world_grounded';
        
        return node.facets.emotional !== null ? 'associative' : 'historical';
    }
    if (node.contract.requires_grounding) return 'associative';
    if (node.facets.emotional !== null) return 'associative';
    return 'strict';
}


export function create_reconsolidated_view(
    node: HydroNode,
    current_state: ReconsolidatedState,
): ReconsolidatedView {
    const s = current_state;
    const newest = s.supersession.ordered.length > 0 ? s.supersession.ordered[s.supersession.ordered.length - 1] : node.id;
    const has_successor = newest !== node.id && s.supersession.current !== null && s.supersession.current.id !== node.id;
    const current_truth: CurrentTruth | null =
        has_successor && s.supersession.current
            ? {
                id: s.supersession.current.id,
                content: s.supersession.current.content,
                observed_at: s.supersession.current.temporal.observed_at,
                valid_from: s.supersession.current.temporal.valid_from,
            }
            : null;

    const warnings: string[] = [];
    if (s.contradiction.warning) warnings.push(s.contradiction.warning);
    if (s.supersession.superseded) {
        warnings.push(
            current_truth
                ? `superseded: not current truth; current = ${current_truth.id}`
                : 'superseded: not current truth',
        );
    }
    if (s.grounding.grounded && !s.grounding.still_valid) {
        warnings.push('grounding no longer valid in the current world');
    }
    if (node.contract.requires_grounding && !(s.grounding.grounded && s.grounding.still_valid)) {
        warnings.push('requires grounding but not currently grounded');
    }

    return {
        original_id: node.id,
        current_status: node.state.status,
        is_superseded: s.supersession.superseded,
        current_truth,
        supersession_chain: s.supersession.ordered,
        historical_residue: s.historical,
        contradiction: s.contradiction,
        grounding: s.grounding,
        recommended_mode: recommend_mode(node, s),
        warnings,
        provenance: node.provenance,
    };
}

/**
 * Reinterpret a memory at recall time. Pure and read-only: it inspects the
 * current world/graph state and returns a derived view. The original immutable
 * node is never mutated.
 */
export function reconsolidate_memory(
    node: HydroNode,
    context: ReconsolidationContext,
): ReconsolidatedView {
    const supersession = follow_supersession_chain(node, context);
    const contradiction = check_contradiction_status(node, context);
    const grounding = check_current_grounding(node, context);
    const historical = preserve_historical_trace(node);
    return create_reconsolidated_view(node, {
        now: context.now,
        supersession,
        contradiction,
        grounding,
        historical,
    });
}

/**
 * Optionally persist a reconsolidated summary by linking it to its origin with a
 * `derived_from` edge. The edge is immutable and does not touch the original.
 */
export function create_derived_from_edge(
    summary_id: string,
    original_id: string,
    at: number,
    provenance?: Provenance,
): HydroEdge {
    return create_hydro_edge({
        from: summary_id,
        to: original_id,
        type: 'derived_from',
        confidence: 1,
        weight: 1,
        temporal: { valid_from: at, valid_to: null, observed_at: at, recorded_at: at },
        handler: { handler: null, params: {} },
        provenance: provenance ?? manual_provenance('reconsolidation', at),
    });
}
