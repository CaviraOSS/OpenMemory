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
 *  file  : src/core/recall/scoring.ts
 *  usage : implements the LongMemory scoring component
 */

import type { HydroNode } from '../types/hydro_node.js';
import type { ExtractionMethod } from '../types/provenance.js';
import { recall_vector, strict_recall_document, strict_recall_tokens, type RecallVector } from './recall_text.js';

const day_ms = 86_400_000;

export type StrictScoringWeights = {
    vector: number;
    lexical: number;
    entity: number;
    temporal: number;
    confidence: number;
    grounding: number;
    provenance: number;
    utility: number;
    contradiction: number;
    staleness: number;
};

export const default_strict_scoring_weights: StrictScoringWeights = {
    vector: 0.25,
    lexical: 0.15,
    entity: 0.15,
    temporal: 0.1,
    confidence: 0.1,
    grounding: 0.1,
    provenance: 0.05,
    utility: 0.05,
    contradiction: 0.3,
    staleness: 0.2,
};

export type ScoringContext = {
    at: number;
    query_terms: string[];
    query_vector: number[] | null;
    resolved_entities: string[];
    contradiction_pressure: number;
    prepared_query_vector?: RecallVector | null;
    resolved_entity_terms?: readonly (readonly string[])[];
};

export type StrictScoreBreakdown = {
    score: number;
    semantic_similarity: number;
    lexical_score: number;
    entity_match: number;
    temporal_relevance: number;
    confidence: number;
    grounding_score: number;
    provenance_quality: number;
    utility: number;

    sketch_boost: number;
    contradiction_pressure: number;
    staleness: number;
};

export type ScoredCandidate = {
    node: HydroNode;
    score: number;
    breakdown: StrictScoreBreakdown;
};

function clamp01(x: number): number {
    return Math.min(1, Math.max(0, x));
}

function cosine(a: RecallVector | null, b: RecallVector | null): number {
    if (!a || !b || a.values.length !== b.values.length) return 0.5;
    let dot = 0;
    for (let index = 0; index < a.values.length; index++) dot += a.values[index] * b.values[index];
    if (a.norm === 0 || b.norm === 0) return 0.5;
    return clamp01(dot / (a.norm * b.norm));
}

const method_reliability: Record<ExtractionMethod, number> = {
    manual: 0.8,
    llm: 0.6,
    heuristic: 0.5,
    import: 0.7,
    synthetic: 0.3,
};

function lexical_score_of(query_terms: string[], node_terms: ReadonlySet<string>): number {
    if (query_terms.length === 0) return 0.5;
    let hits = 0;
    for (const t of query_terms) if (node_terms.has(t)) hits++;
    return hits / query_terms.length;
}

function entity_match_of(entity_terms: readonly (readonly string[])[], node_terms: ReadonlySet<string>): number {
    if (entity_terms.length === 0) return 0.5;
    let matched = 0;
    for (const parts of entity_terms) {
        if (parts.length > 0 && parts.every((p) => node_terms.has(p))) matched++;
    }
    return matched / entity_terms.length;
}

function provenance_quality_of(node: HydroNode): number {
    let q = method_reliability[node.provenance.extraction_method] ?? 0.5;
    if (node.provenance.source_trace.length === 0) q *= 0.5;
    return clamp01(q);
}

export function score_candidate(
    node: HydroNode,
    ctx: ScoringContext,
    weights: StrictScoringWeights = default_strict_scoring_weights,
): StrictScoreBreakdown {
    const node_terms = strict_recall_document(node).terms;
    const age_days = Math.max(0, (ctx.at - node.temporal.observed_at) / day_ms);

    const query_vector = ctx.prepared_query_vector === undefined ? recall_vector(ctx.query_vector) : ctx.prepared_query_vector;
    const entity_terms = ctx.resolved_entity_terms ?? ctx.resolved_entities.map((entity) => strict_recall_tokens(entity));
    const semantic_similarity = cosine(query_vector, recall_vector(node.vectors.semantic));
    const lexical_score = lexical_score_of(ctx.query_terms, node_terms);
    const entity_match = entity_match_of(entity_terms, node_terms);
    const temporal_relevance = clamp01(Math.exp(-age_days / 90));
    const confidence = clamp01(node.state.confidence);
    const grounding_score = clamp01(node.grounding.grounding_score);
    const provenance_quality = provenance_quality_of(node);
    const utility = clamp01(node.state.salience);
    const contradiction_pressure = clamp01(ctx.contradiction_pressure);
    const staleness = clamp01(age_days / 365);

    const score =
        weights.vector * semantic_similarity +
        weights.lexical * lexical_score +
        weights.entity * entity_match +
        weights.temporal * temporal_relevance +
        weights.confidence * confidence +
        weights.grounding * grounding_score +
        weights.provenance * provenance_quality +
        weights.utility * utility -
        weights.contradiction * contradiction_pressure -
        weights.staleness * staleness;

    return {
        score,
        semantic_similarity,
        lexical_score,
        entity_match,
        temporal_relevance,
        confidence,
        grounding_score,
        provenance_quality,
        utility,
        sketch_boost: 0,
        contradiction_pressure,
        staleness,
    };
}
