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
 *  file  : src/core/recall/associative_recall.ts
 *  usage : implements the LongMemory associative recall component
 */


import { compute_activation } from '../math/activation.js';
import { clamp01, sigmoid } from '../math/utility.js';
import { project_node_decay, type decay_policy } from '../memory/decay_engine.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { GateContext, RecallLabel } from '../types/recall_mode.js';
import { default_gate_thresholds } from '../types/recall_mode.js';
import {
    legacy_spread_activation,
    spread_activation,
    type SpreadResult,
} from './activation_spread.js';
import { build_context_packet, count_tokens, type ContextPacket } from './context_builder.js';
import { memory_evidence_text } from './evidence.js';
import { select_evidence_set } from './evidence_selection.js';
import { hopfield_recall, type HopfieldMemory, type HopfieldResult } from './hopfield_recall.js';
import { can_use_in_associative_recall } from './mode_gates.js';
import { plan_strict_recall, type RecallDeps, type RecallQuery } from './recall_planner.js';
import { normalize_recall_token, recall_document, recall_tokens, recall_vector, type RecallDocument, type RecallVector } from './recall_text.js';
import { rank_indices, reciprocal_rank_fusion, select_diverse } from './fusion.js';
import { matrix_fusion, select_sparse_seeds } from './matrix_fusion.js';
import {
    prepare_rerank_query, rerank_features, rerank_score, type RerankWeights,
    prepare_evidence_query, evidence_support, evidence_adjustment, type EvidenceWeights,
    order_evidence, query_calendar_window, calendar_relevance,
} from './rerank.js';

const day_ms = 86_400_000;
const length_prior_saturation = 8;

export type AssociativeQuery = {
    text: string;
    now: number;

    at?: number;
    world_id?: string;
    entity_names?: string[];
    vector?: number[] | null;
    k?: number;
    token_budget?: number;
    min_confidence?: number;
    permission_context?: GateContext['permission_context'];
};

export type AssociativeScoringWeights = {
    vector: number;
    lexical: number;
    entity: number;
    activation: number;
    spread: number;
    emotional: number;
    speaker: number;
    preference: number;

    status_penalty: number;
    fusion?: number;
    recency?: number;
    session?: number;
};

export const default_associative_weights: AssociativeScoringWeights = {
    vector: 0.28,
    lexical: 0.2,
    entity: 0.12,
    activation: 0.15,
    spread: 0.15,
    emotional: 0.1,
    speaker: 0.06,
    preference: 0.08,
    status_penalty: 0.2,
    fusion: 0,
    recency: 0,
    session: 0,
};

export type AssociativeDeps = RecallDeps & {

    edges?: readonly HydroEdge[];
    decay_policy?: Partial<decay_policy>;
};

// Ranking dilution and evidence dilution are independent field groups on this struct,
// not separate public modules (see .specs/specs/architecture-associative-recall.md).
export type associative_policy = {
    weights: AssociativeScoringWeights;
    flags: {
        matrix_retrieval: boolean;
        rm3: boolean;
        evidence_rerank: boolean;
        calendar_rerank: boolean;
        derivation_rerank: boolean;
        hopfield: boolean;
        session_coverage: boolean;
    };
    hopfield_beta: number;
    columns: {
        vector: number;
        lexical: number;
        activation: number;
        speaker: number;
        temporal: number;
        polarity: number;
        preference: number;
    };
    seeds: {
        quantile: number;
        max_seeds: number;
        max_density: number;
        legacy_threshold: number;
    };
    evidence: {
        coverage: number;
        phrase: number;
        attribution: number;
        assertion: number;
        excluded_only: number;
        derivation: number;
        calendar: number;
    };
    budgets: {
        rerank_depth: number;
        aggregate_rerank_depth: number;
        rm3_feedback_docs: number;
        rm3_feedback_terms: number;
        rm3_original_weight: number;
        evidence_selection_depth: number;
    };
    diversity_lambda: number;
};

export function default_associative_policy(): associative_policy {
    return {
        weights: { ...default_associative_weights },
        flags: {
            matrix_retrieval: true,
            rm3: false,
            evidence_rerank: true,
            calendar_rerank: true,
            derivation_rerank: true,
            hopfield: false,
            session_coverage: false,
        },
        hopfield_beta: 8,
        columns: {
            vector: 0.28,
            lexical: 0.2,
            activation: 0.15,
            speaker: 0.06,
            temporal: 0,
            polarity: 0.18,
            preference: 0.08,
        },
        seeds: {
            quantile: 0.9,
            max_seeds: 32,
            max_density: 0.15,
            legacy_threshold: 0.05,
        },
        evidence: {
            coverage: 0.18,
            phrase: 0.12,
            attribution: 0.24,
            assertion: 0.06,
            excluded_only: 0.16,
            derivation: 0.12,
            calendar: 0.2,
        },
        budgets: {
            rerank_depth: 50,
            aggregate_rerank_depth: 200,
            rm3_feedback_docs: 10,
            rm3_feedback_terms: 12,
            rm3_original_weight: 0.6,
            evidence_selection_depth: 64,
        },
        diversity_lambda: 0.85,
    };
}

// env flags and memory_config.associative_policy are adapters of this struct; live env
// edits never reach an already-open create_memory instance.
export function associative_policy_from_env(
    env: NodeJS.ProcessEnv = process.env,
    overrides?: Partial<associative_policy>,
): associative_policy {
    const policy = default_associative_policy();
    policy.flags.matrix_retrieval = env.OM_MATRIX_RETRIEVAL !== '0';
    policy.flags.rm3 = env.OM_RM3 === '1';
    policy.flags.evidence_rerank = env.LONGMEMORY_EVIDENCE_RERANK !== '0';
    policy.flags.calendar_rerank = env.LONGMEMORY_CALENDAR_RERANK !== '0';
    policy.flags.derivation_rerank = env.LONGMEMORY_DERIVATION_RERANK !== '0';
    policy.flags.session_coverage = env.LONGMEMORY_SESSION_COVERAGE === '1';
    return {
        ...policy,
        ...overrides,
        weights: { ...policy.weights, ...overrides?.weights },
        flags: { ...policy.flags, ...overrides?.flags },
        columns: { ...policy.columns, ...overrides?.columns },
        seeds: { ...policy.seeds, ...overrides?.seeds },
        evidence: { ...policy.evidence, ...overrides?.evidence },
        budgets: { ...policy.budgets, ...overrides?.budgets },
    };
}

export type AssociativeBreakdown = {
    vector: number;
    lexical: number;
    entity: number;
    activation: number;
    spread: number;
    emotional: number;
    speaker: number;
    preference: number;
    fusion: number;
    recency: number;
    session: number;
    status_penalty: number;
    matrix: number;
    polarity: number;
    entity_gate: number;
    graph_gain: number;
    evidence_adjustment?: number;
    calendar_adjustment?: number;
    score: number;
};

export type AssociativeItem = {
    node: HydroNode;
    score: number;

    label: RecallLabel;
    breakdown: AssociativeBreakdown;
};

export type AssociativeCandidateTrace = {
    id: string;
    admitted: boolean;
    label: RecallLabel;
    score: number | null;
    included: boolean;
    reasons: string[];
};

export type AssociativeTrace = {
    query: string;
    now: number;
    intent: { terms: string[]; entity_names: string[] };
    resolved_entities: string[];
    selected_worlds: string[] | null;
    retrieved: number;
    admitted: number;
    rejected: number;
    spread: { hops: number; visited: number; seeds: number; seed_density: number; entropy: number; peak: number; bypassed: boolean };
    matrix: { enabled: boolean; features: string[]; regularization: number; temperature: number; seed_threshold: number };
    candidates: AssociativeCandidateTrace[];
    context_tokens: number;
    budget: number;
    cold_scans: number;
    evidence_rerank?: { enabled: boolean; candidates: number; subject: string | null; aggregate: boolean };
};

export type AssociativeRecallResult = {
    items: AssociativeItem[];
    context: ContextPacket;
    trace: AssociativeTrace;
    hopfield: HopfieldResult | null;
};

function cosine(a: RecallVector | null, b: RecallVector | null): number {
    if (!a || !b || a.values.length !== b.values.length) return 0;
    let dot = 0;
    for (let index = 0; index < a.values.length; index++) dot += a.values[index] * b.values[index];
    return a.norm === 0 || b.norm === 0 ? 0 : clamp01(dot / (a.norm * b.norm));
}

function is_superseded(node: HydroNode): boolean {
    return node.temporal.superseded_at !== null || node.state.status === 'superseded';
}

function conversation_of(node: HydroNode): string {
    return typeof node.metadata.conversation_id === 'string' ? node.metadata.conversation_id : '';
}

function session_relevance(nodes: readonly HydroNode[], relevance: Float64Array): Map<string, number> {
    const grouped = new Map<string, number[]>();
    for (let index = 0; index < nodes.length; index++) {
        const key = conversation_of(nodes[index]);
        if (!key) continue;
        const bucket = grouped.get(key) ?? [];
        bucket.push(relevance[index]);
        grouped.set(key, bucket);
    }
    const scores = new Map<string, number>();
    let max = 0;
    for (const [key, values] of grouped) {
        values.sort((left, right) => right - left);
        let total = 0;
        for (let index = 0; index < Math.min(3, values.length); index++) total += values[index];
        scores.set(key, total);
        if (total > max) max = total;
    }
    if (max > 0) for (const [key, value] of scores) scores.set(key, value / max);
    return scores;
}

function memory_similarity(left: HydroNode, right: HydroNode): number {
    const left_vector = recall_vector(left.vectors.semantic);
    const right_vector = recall_vector(right.vectors.semantic);
    if (left_vector && right_vector && left_vector.values.length === right_vector.values.length) {
        return cosine(left_vector, right_vector);
    }
    const left_terms = recall_document(left).frequencies;
    const right_terms = recall_document(right).frequencies;
    if (left_terms.size === 0 || right_terms.size === 0) return 0;
    let shared = 0;
    for (const term of left_terms.keys()) if (right_terms.has(term)) shared++;
    return shared / (left_terms.size + right_terms.size - shared);
}

function is_contradicted(node: HydroNode): boolean {
    return node.state.status === 'contradicted';
}

function is_emotional(node: HydroNode): boolean {
    return node.facets.emotional !== null || node.contract.use_for_emotional_context;
}

const exception_query_re = /\b(?:all|always|any|ever|every|never|none|only|smoothly|without (?:a )?(?:problem|issue))\b/i;
const exception_evidence_terms = ['except', 'fail', 'failed', 'failure', 'problem', 'issue', 'tough', 'challenge', 'difficult', 'disappointed', 'disappointing', 'wrong', 'weird', 'broke', 'broken', 'unable'] as const;
const exception_evidence_tokens = new Set(exception_evidence_terms.flatMap(recall_tokens));

function polarity_relevance(node: HydroNode, enabled: boolean, query_terms: readonly string[]): number {
    if (!enabled) return 0;
    const evidence_terms = new Set(recall_tokens(`${node.content.raw} ${node.content.summary}`));
    const failure_strength = [...exception_evidence_tokens].reduce((sum, term) => sum + Number(evidence_terms.has(term)), 0);
    if (failure_strength === 0) return 0;
    const ignored = new Set(['all', 'always', 'any', 'ever', 'every', 'never', 'none', 'only', 'smooth', 'without']);
    const document = recall_document(node);
    let overlap = 0;
    for (const term of new Set(query_terms)) {
        if (!ignored.has(term) && document.frequencies.has(term)) overlap++;
    }
    return overlap >= 2 ? Math.min(1, failure_strength / 3) : 0;
}

const referential_turn_re = /\b(?:did it|did that|just did it|just did that|that one|this one|the same (?:thing|place|one)|so did i|me too)\b/i;
const pronoun_turn_re = /^(?:[^:\n]{1,32}:\s+)?(?:it|he|she|they|this|that|those|these)\b/i;
const question_turn_re = /\?\s*$/;
const aggregate_query_re = /\b(?:how many|total|list|which (?:items|events|activities|places)|what activities|all (?:the |of )?(?:items|events|activities|places))\b/i;

function conversation_bundles(
    anchors: readonly AssociativeItem[],
    nodes: readonly HydroNode[],
    edges: readonly HydroEdge[],
    anchor_limit = 8,
    max_depth = 2,
): { bundles: Map<string, readonly HydroNode[]>; forward_ids: Set<string> } {
    const by_id = new Map(nodes.map((node) => [node.id, node]));
    const predecessor = new Map<string, string>();
    const successor = new Map<string, string>();
    for (const edge of edges) if (edge.type === 'refers_to') {
        predecessor.set(edge.from, edge.to);
        // a ranked turn that is itself the question, not the reply, needs its answer pulled
        // forward: the reply is whichever later turn's refers_to edge points back at it.
        if (!successor.has(edge.to)) successor.set(edge.to, edge.from);
    }
    const bundles = new Map<string, readonly HydroNode[]>();
    const forward_ids = new Set<string>();
    for (const anchor of anchors.slice(0, anchor_limit)) {
        const explicit = referential_turn_re.test(anchor.node.content.raw);
        const is_question = question_turn_re.test(anchor.node.content.raw);
        if (!explicit && !is_question && !(anchor.node.content.raw.length <= 512 && pronoun_turn_re.test(anchor.node.content.raw))) continue;
        const conversation = conversation_of(anchor.node);
        if (!conversation) continue;
        const neighbours: HydroNode[] = [];
        const visited = new Set([anchor.node.id]);
        let tokens = 0;
        const same_scope = (candidate: HydroNode) => conversation_of(candidate) === conversation
            && candidate.world.world_id === anchor.node.world.world_id
            && candidate.metadata.user_id === anchor.node.metadata.user_id;
        if (is_question) {
            let current = anchor.node.id;
            for (let depth = 0; depth < max_depth; depth++) {
                const next_id = successor.get(current);
                const next = next_id ? by_id.get(next_id) : undefined;
                if (!next || visited.has(next.id) || !same_scope(next) || next.temporal.observed_at < anchor.node.temporal.observed_at) break;
                visited.add(next.id);
                tokens += count_tokens(memory_evidence_text(next, { prefer_raw: true }));
                if (tokens > 256) break;
                neighbours.push(next);
                forward_ids.add(next.id);
                current = next.id;
            }
        }
        let current = anchor.node.id;
        for (let depth = 0; depth < max_depth; depth++) {
            const previous_id = predecessor.get(current);
            const previous = previous_id ? by_id.get(previous_id) : undefined;
            if (!previous || visited.has(previous.id) || !same_scope(previous) || previous.temporal.observed_at > anchor.node.temporal.observed_at) break;
            visited.add(previous.id);
            tokens += count_tokens(memory_evidence_text(previous, { prefer_raw: true }));
            if (!explicit && tokens > 256) break;
            neighbours.push(previous);
            current = previous.id;
        }
        if (neighbours.length > 0) bundles.set(anchor.node.id, neighbours);
    }
    return { bundles, forward_ids };
}






function status_label_for(node: HydroNode, min_confidence: number): RecallLabel {
    if (is_superseded(node)) return 'superseded';
    if (is_contradicted(node)) return 'contradicted';
    if (is_emotional(node)) return 'emotional_residue';
    if (node.state.confidence < min_confidence) return 'weak_pattern';
    return 'active';
}


function bm25_weighted(
    query_weights: ReadonlyMap<string, number>,
    docs: readonly RecallDocument[],
    k1 = 1.5,
    b = 0.75,
): Float64Array {
    const scores = new Float64Array(docs.length);
    if (docs.length === 0 || query_weights.size === 0) return scores;

    const unique_query_terms = [...query_weights.keys()];
    const df = new Map(unique_query_terms.map((term) => [term, 0]));
    let total_len = 0;
    for (const doc of docs) {
        total_len += doc.length;
        for (const term of unique_query_terms) if (doc.frequencies.has(term)) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const avg_len = total_len / docs.length || 1;
    const document_count = docs.length;

    let max = 0;
    for (let doc_index = 0; doc_index < docs.length; doc_index++) {
        const doc = docs[doc_index];
        let s = 0;
        for (const q of unique_query_terms) {
            const document_frequency = df.get(q) ?? 0;
            if (document_frequency === 0) continue;
            const idf = Math.log(1 + (document_count - document_frequency + 0.5) / (document_frequency + 0.5));
            const f = doc.frequencies.get(q) ?? 0;
            if (f === 0) continue;
            s += (query_weights.get(q) ?? 0) * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (doc.length / avg_len))));
        }
        scores[doc_index] = s * (doc.length / (doc.length + length_prior_saturation));
        if (scores[doc_index] > max) max = scores[doc_index];
    }

    if (max > 0) for (let index = 0; index < scores.length; index++) scores[index] /= max;
    return scores;
}

function relevance_model(
    query_weights: ReadonlyMap<string, number>,
    docs: readonly RecallDocument[],
    base: Float64Array,
    feedback_docs: number,
    feedback_terms: number,
    original_weight: number,
): ReadonlyMap<string, number> {
    const ranked: number[] = [];
    for (let index = 0; index < base.length; index++) if (base[index] > 0) ranked.push(index);
    if (ranked.length === 0) return query_weights;
    ranked.sort((left, right) => base[right] - base[left]);

    const feedback = ranked.slice(0, feedback_docs);
    let mass = 0;
    for (const index of feedback) mass += base[index];
    if (mass <= 0) return query_weights;

    const model = new Map<string, number>();
    for (const index of feedback) {
        const doc = docs[index];
        if (doc.length === 0) continue;
        const weight = base[index] / mass;
        for (const [term, frequency] of doc.frequencies) {
            if (term.length <= 2 || query_weights.has(term)) continue;
            model.set(term, (model.get(term) ?? 0) + (weight * frequency) / doc.length);
        }
    }
    if (model.size === 0) return query_weights;

    const expansion = [...model.entries()].sort((left, right) => right[1] - left[1]).slice(0, feedback_terms);
    let expansion_mass = 0;
    for (const [, weight] of expansion) expansion_mass += weight;
    if (expansion_mass <= 0) return query_weights;

    let query_mass = 0;
    for (const [, weight] of query_weights) query_mass += weight;
    if (query_mass <= 0) return query_weights;

    const merged = new Map<string, number>();
    for (const [term, weight] of query_weights) merged.set(term, (original_weight * weight) / query_mass);
    for (const [term, weight] of expansion) merged.set(term, ((1 - original_weight) * weight) / expansion_mass);
    return merged;
}

function bm25_scores(
    query_terms: string[],
    docs: readonly RecallDocument[],
    rm3: { enabled: boolean; feedback_docs: number; feedback_terms: number; original_weight: number },
    k1 = 1.5,
    b = 0.75,
): Float64Array {
    const normalized = query_terms.map(normalize_recall_token);
    const query_weights = new Map<string, number>();
    for (const term of normalized) query_weights.set(term, (query_weights.get(term) ?? 0) + 1);
    if (query_weights.size === 0 || docs.length === 0) return new Float64Array(docs.length);

    const base = bm25_weighted(query_weights, docs, k1, b);
    if (!rm3.enabled) return base;

    const expanded = relevance_model(query_weights, docs, base, rm3.feedback_docs, rm3.feedback_terms, rm3.original_weight);
    if (expanded === query_weights) return base;
    return bm25_weighted(expanded, docs, k1, b);
}

function entity_overlap(entities: string[], document: RecallDocument): number {
    if (entities.length === 0) return 0;
    let matched = 0;
    for (const entity of entities) {
        const parts = recall_tokens(entity);
        if (parts.length > 0 && parts.every((part) => document.frequencies.has(part) || document.speaker_terms.has(part))) matched++;
    }
    return matched / entities.length;
}





export function associative_recall(
    query: AssociativeQuery,
    deps: AssociativeDeps,
    policy: associative_policy = default_associative_policy(),
): AssociativeRecallResult {
    const at = query.at ?? query.now;
    const weights = policy.weights;
    const min_confidence =
        query.min_confidence ?? default_gate_thresholds.min_confidence;
    const first_person_query = /\b(?:i|me|my|mine)\b/i.test(query.text);
    const emotional_query = /\b(?:feel|feeling|felt|emotion|emotional|happy|sad|afraid|anxious|angry|love|hate|mood)\b/i.test(query.text);
    const recommendation_query = /\b(?:recommend|recommendation|suggest|suggestion|personalize|tailor)\b/i.test(query.text);
    const exception_query = exception_query_re.test(query.text);


    const plan_query: RecallQuery = {
        text: query.text,
        now: query.now,
        at,
        world_id: query.world_id,
        entity_names: query.entity_names,
        vector: query.vector,
    };
    const plan = plan_strict_recall(plan_query, deps);
    const query_vector = query.vector ?? deps.embed_query?.(query.text) ?? null;

    const retrieved = deps.index.active_nodes(plan.world_ids);



    const admitted: HydroNode[] = [];
    const candidates: AssociativeCandidateTrace[] = [];
    for (const node of retrieved) {
        const gate_ctx: GateContext = { now: at, thresholds: { min_confidence: min_confidence }, permission_context: query.permission_context };
        const gate = can_use_in_associative_recall(node, gate_ctx);
        if (gate.allowed) {
            admitted.push(node);
        } else {
            candidates.push({
                id: node.id,
                admitted: false,
                label: gate.label,
                score: null,
                included: false,
                reasons: gate.reasons,
            });
        }
    }


    // computed early (not just at rerank time) so aggregate/list queries can widen the
    // candidate window before the initial top-K cut discards distinct-but-lower-scoring facts.
    const evidence_enabled = policy.flags.evidence_rerank;
    const evidence_query = evidence_enabled ? prepare_evidence_query(query.text, admitted) : null;
    const rerank_depth = evidence_query?.aggregate ? Math.max(policy.budgets.rerank_depth, policy.budgets.aggregate_rerank_depth) : policy.budgets.rerank_depth;

    const documents = admitted.map((node) => recall_document(node));
    const bm25 = bm25_scores(plan.intent.terms, documents, {
        enabled: policy.flags.rm3,
        feedback_docs: policy.budgets.rm3_feedback_docs,
        feedback_terms: policy.budgets.rm3_feedback_terms,
        original_weight: policy.budgets.rm3_original_weight,
    });
    const prepared_query = recall_vector(query_vector);
    const vector_scores = new Float64Array(admitted.length);
    const entity_scores = new Float64Array(admitted.length);
    const direct_relevance = new Float64Array(admitted.length);
    const spread_enabled = Boolean(deps.edges?.length);
    let oldest_observed = Number.POSITIVE_INFINITY;
    let newest_observed = Number.NEGATIVE_INFINITY;

    for (let node_index = 0; node_index < admitted.length; node_index++) {
        const node = admitted[node_index];
        const document = documents[node_index];
        const vector = cosine(prepared_query, recall_vector(node.vectors.semantic));
        const lexical = bm25[node_index];
        const entity = entity_overlap(plan.resolved_entities, document);
        vector_scores[node_index] = vector;
        entity_scores[node_index] = entity;
        const rel = clamp01(0.5 * vector + 0.35 * lexical + 0.15 * entity);
        direct_relevance[node_index] = rel;
        if (node.temporal.observed_at < oldest_observed) oldest_observed = node.temporal.observed_at;
        if (node.temporal.observed_at > newest_observed) newest_observed = node.temporal.observed_at;
    }

    const fusion_weight = weights.fusion ?? 0;
    const fusion_scores = fusion_weight > 0 && admitted.length > 1
        ? reciprocal_rank_fusion([rank_indices(vector_scores), rank_indices(bm25)], admitted.length)
        : new Float64Array(admitted.length);
    const recency_weight = plan.intent.temporal ? weights.recency ?? 0 : 0;
    const observed_span = newest_observed - oldest_observed;
    const session_weight = weights.session ?? 0;
    const session_scores = session_weight > 0 ? session_relevance(admitted, direct_relevance) : null;

    const activation_scores = new Float64Array(admitted.length);
    const emotional_scores = new Float64Array(admitted.length);
    const speaker_scores = new Float64Array(admitted.length);
    const preference_scores = new Float64Array(admitted.length);
    const recency_scores = new Float64Array(admitted.length);
    const polarity_scores = new Float64Array(admitted.length);
    const entity_gates = new Float64Array(admitted.length);
    for (let node_index = 0; node_index < admitted.length; node_index++) {
        const node = admitted[node_index];
        const vector = vector_scores[node_index];
        const lexical = bm25[node_index];
        const entity = entity_scores[node_index];
        const pressure = clamp01(deps.contradiction_pressure_of?.(node.id) ?? 0);
        const age_days = Math.max(0, (at - node.temporal.observed_at) / day_ms);
        const memory_strength = deps.decay_policy
            ? project_node_decay(node, at, deps.decay_policy).activation
            : node.state.salience;
        const actr_raw = compute_activation([age_days + 1], {
            context_association: 0.5 * (node.state.salience + memory_strength),
            task_relevance: 0.5 * (vector + lexical),
            grounding_relevance: node.grounding.grounding_score,
            contradiction_penalty: pressure,
        });
        activation_scores[node_index] = clamp01(sigmoid(actr_raw));
        emotional_scores[node_index] = emotional_query && is_emotional(node) ? (node.facets.emotional?.weight ?? 0.5) * Math.max(vector, lexical, entity) : 0;
        const role = typeof node.metadata.role === 'string' ? node.metadata.role.toLowerCase() : '';
        speaker_scores[node_index] = first_person_query ? role === 'user' ? 1 : role === 'assistant' ? 0 : 0.5 : 0;
        preference_scores[node_index] = recommendation_query && node.content.claims?.some((claim) => claim.kind === 'preference') ? 1 : 0;
        const observed_position = observed_span > 0 ? (node.temporal.observed_at - oldest_observed) / observed_span : 0;
        recency_scores[node_index] = plan.intent.temporal === 'latest'
            ? observed_position
            : plan.intent.temporal === 'earliest' ? 1 - observed_position : 0;
        polarity_scores[node_index] = polarity_relevance(node, exception_query, recall_tokens(query.text));
        entity_gates[node_index] = plan.resolved_entities.length === 0 ? 1 : 0.35 + 0.65 * sigmoid(8 * (entity - 0.5));
    }

    const matrix = matrix_fusion([
        { name: 'vector', values: vector_scores, weight: policy.columns.vector },
        { name: 'lexical', values: bm25, weight: policy.columns.lexical },
        { name: 'activation', values: activation_scores, weight: policy.columns.activation },
        { name: 'speaker', values: speaker_scores, weight: first_person_query ? policy.columns.speaker : 0 },
        { name: 'temporal', values: recency_scores, weight: plan.intent.temporal ? policy.columns.temporal : 0 },
        { name: 'polarity', values: polarity_scores, weight: exception_query ? policy.columns.polarity : 0 },
        { name: 'preference', values: preference_scores, weight: recommendation_query ? policy.columns.preference : 0 },
    ]);
    const matrix_scores = new Float64Array(admitted.length);
    for (let index = 0; index < admitted.length; index++) matrix_scores[index] = matrix.scores[index] * entity_gates[index];
    const sparse = select_sparse_seeds(admitted.map((node) => node.id), matrix_scores, {
        quantile: policy.seeds.quantile,
        max_seeds: policy.seeds.max_seeds,
        max_density: policy.seeds.max_density,
    });
    const legacy_seeds = new Map<string, number>();
    if (!policy.flags.matrix_retrieval) {
        for (let index = 0; index < admitted.length; index++) {
            if (direct_relevance[index] > policy.seeds.legacy_threshold) legacy_seeds.set(admitted[index].id, direct_relevance[index]);
        }
    }
    const matrix_query = policy.flags.matrix_retrieval && exception_query;
    if (!matrix_query) {
        for (let index = 0; index < admitted.length; index++) {
            if (direct_relevance[index] > policy.seeds.legacy_threshold) legacy_seeds.set(admitted[index].id, direct_relevance[index]);
        }
    }
    const seeds = matrix_query ? sparse.seeds : legacy_seeds;
    const seed_count = seeds.size;

    // Step 5: controlled, bounded spreading activation over the graph.
    const spread: SpreadResult =
        spread_enabled && seeds.size > 0
            ? matrix_query
                ? spread_activation(seeds, deps.edges!)
                : legacy_spread_activation(seeds, deps.edges!)
            : { activation: new Map(), hops: 2, visited: [], frontier_by_hop: [[]], entropy: 0, peak: 0, bypassed: false };

    // Steps 1-7: combine every signal per admitted node.
    const limit = query.k == null ? null : Math.max(0, query.k);
    const rerank_query = prepare_rerank_query(recall_tokens(query.text));
    const calendar = policy.flags.calendar_rerank ? query_calendar_window(query.text) : null;
    const candidate_limit = limit === null || limit === 0 || rerank_query.terms.length === 0
        ? limit : Math.max(limit, rerank_depth);
    const ranked_entries: Array<{ item: AssociativeItem; order: number }> = [];
    for (let node_index = 0; node_index < admitted.length; node_index++) {
        const node = admitted[node_index];
        const vector = vector_scores[node_index];
        const lexical = bm25[node_index];
        const entity = entity_scores[node_index];
        const spread_value = clamp01(spread.activation.get(node.id) ?? 0);
        const activation = activation_scores[node_index];
        const emotional = emotional_scores[node_index];
        const speaker = speaker_scores[node_index];
        const preference = preference_scores[node_index];
        const polarity = polarity_scores[node_index];
        const entity_gate = entity_gates[node_index];
        const label = status_label_for(node, min_confidence);
        // an unresolved contradiction is exactly the evidence an "did X always go smoothly"
        // question wants surfaced, so exception queries don't pay the usual reliability penalty for it.
        const status_penalty =
            label === 'superseded' || (label === 'contradicted' && !exception_query) ? weights.status_penalty : 0;
        const fusion = fusion_scores[node_index];
        const recency = recency_scores[node_index];
        const session = session_scores?.get(conversation_of(node)) ?? 0;

        const direct_score =
            weights.vector * vector +
            weights.lexical * lexical +
            weights.entity * entity +
            weights.activation * activation +
            weights.emotional * emotional +
            weights.speaker * speaker +
            weights.preference * preference +
            fusion_weight * fusion +
            recency_weight * recency +
            session_weight * session -
            status_penalty;
        const matrix_score = matrix_scores[node_index];
        const graph_gain = matrix_query && !seeds.has(node.id) ? weights.spread * spread_value : 0;
        const matrix_residual = 0.04 * (matrix_score - 0.5);
        const polarity_gain = matrix_query ? 0.2 * polarity : 0;
        const calendar_adjustment = policy.evidence.calendar * calendar_relevance(calendar, node);
        const score = (matrix_query
            ? direct_score + matrix_residual + graph_gain + polarity_gain
            : direct_score + weights.spread * spread_value) + calendar_adjustment;

        if (limit === 0) continue;
        const last = ranked_entries.at(-1);
        if (candidate_limit !== null && ranked_entries.length >= candidate_limit && last && score <= last.item.score) continue;
        const item: AssociativeItem = {
            node,
            score,
            label,
            breakdown: {
                vector,
                lexical,
                entity,
                activation,
                spread: spread_value,
                emotional,
                speaker,
                preference,
                fusion,
                recency,
                session,
                status_penalty,
                matrix: matrix_score,
                polarity,
                entity_gate,
                graph_gain,
                calendar_adjustment,
                score,
            },
        };
        if (candidate_limit === null) {
            ranked_entries.push({ item, order: node_index });
            continue;
        }
        let low = 0;
        let high = ranked_entries.length;
        while (low < high) {
            const middle = (low + high) >>> 1;
            const current = ranked_entries[middle];
            if (score > current.item.score || (score === current.item.score && node_index < current.order)) high = middle;
            else low = middle + 1;
        }
        ranked_entries.splice(low, 0, { item, order: node_index });
        if (ranked_entries.length > candidate_limit) ranked_entries.pop();
    }

    if (limit === null) ranked_entries.sort((left, right) => right.item.score - left.item.score || left.order - right.order);
    const ranked = ranked_entries.map((entry) => entry.item);
    const rerank_weights: RerankWeights = { coverage: policy.evidence.coverage, phrase: policy.evidence.phrase };
    const evidence_weights: EvidenceWeights = {
        attribution: policy.evidence.attribution,
        assertion: policy.evidence.assertion,
        excluded_only: policy.evidence.excluded_only,
        derivation: policy.evidence.derivation,
    };
    if (rerank_query.terms.length > 0 && ranked.length > 1) {
        const head = ranked.slice(0, Math.min(rerank_depth, ranked.length));
        let strongest: AssociativeItem | undefined;
        let strongest_score = -Infinity;
        for (const item of head) {
            const features = rerank_features(rerank_query.terms, rerank_query.pairs, recall_document(item.node));
            item.score = rerank_score(item.score, features, rerank_weights);
            if (item.score > strongest_score) { strongest = item; strongest_score = item.score; }
            if (evidence_query) {
                const adjustment = evidence_adjustment(evidence_support(evidence_query, item.node, policy.flags.derivation_rerank), evidence_weights);
                item.score += adjustment;
                item.breakdown.evidence_adjustment = adjustment;
            }
            item.breakdown.score = item.score;
        }
        const counterevidence = evidence_query?.subject && evidence_query.subject !== 'user' && strongest
            && evidence_support(evidence_query, strongest.node).attribution < 0 ? strongest : undefined;
        const ordered = evidence_query ? order_evidence(head, evidence_query, counterevidence) : head.sort((left, right) => right.score - left.score);
        for (let index = 0; index < ordered.length; index++) ranked[index] = ordered[index];
    }
    const current_query = /\b(?:now|currently|current|latest)\b/i.test(query.text)
        && !/\b(?:before|previously|formerly|historical|history|then|changed|evolved)\b/i.test(query.text)
        && (query.at === undefined || query.at >= query.now);
    const replacements = current_query ? (deps.edges ?? []).filter((edge) => edge.type === 'supersedes') : [];
    const predecessors = new Map<string, string[]>();
    for (const edge of replacements) predecessors.set(edge.from, [...(predecessors.get(edge.from) ?? []), edge.to]);
    const current_terms = new Set(plan.intent.terms);
    const promote_current = (items: AssociativeItem[]): void => {
        if (!current_query) return;
        const by_id = new Map(items.map((item) => [item.node.id, item]));
        for (const replacement of [...items]) {
            if (is_superseded(replacement.node)) continue;
            const pending = [...(predecessors.get(replacement.node.id) ?? [])];
            const visited = new Set<string>([replacement.node.id]);
            let before = items.indexOf(replacement);
            while (pending.length) {
                const id = pending.pop()!;
                if (visited.has(id)) continue;
                visited.add(id);
                pending.push(...(predecessors.get(id) ?? []));
                const previous = by_id.get(id);
                if (!previous || !is_superseded(previous.node)
                    || previous.node.world.world_id !== replacement.node.world.world_id
                    || previous.node.metadata.user_id !== replacement.node.metadata.user_id) continue;
                const topics = new Set(previous.node.content.claims?.map((claim) => claim.topic));
                const relevant = replacement.node.content.claims?.some((claim) => topics.has(claim.topic)
                    && recall_tokens(`${claim.kind} ${claim.predicate} ${claim.object}`).some((term) => current_terms.has(term)));
                if (relevant) before = Math.min(before, items.indexOf(previous));
            }
            const after = items.indexOf(replacement);
            if (after > before) { items.splice(after, 1); items.splice(before, 0, replacement); }
        }
    };
    promote_current(ranked);
    const aggregate_query = policy.flags.session_coverage && aggregate_query_re.test(query.text);
    if (limit !== null && !aggregate_query) ranked.splice(limit);

    const diverse = policy.flags.matrix_retrieval && (exception_query || aggregate_query) ? (() => {
        const depth = Math.min(policy.budgets.evidence_selection_depth, ranked.length);
        const head = ranked.slice(0, depth);
        const selected = select_evidence_set(head, {
            limit: aggregate_query ? Math.min(limit ?? head.length, head.length) : head.length,
            token_budget: query.token_budget ?? Number.POSITIVE_INFINITY,
            query_terms: recall_tokens(query.text),
            exception_query,
            terms: (item) => new Set([...recall_document(item.node).frequencies.keys(), ...recall_document(item.node).speaker_terms]),
            similarity: (left, right) => memory_similarity(left.node, right.node),
            token_cost: (item) => count_tokens(memory_evidence_text(item.node, { query_terms: plan.intent.terms })),
            polarity: (item) => item.breakdown.polarity,
            relevance: (item) => item.score,
            group: aggregate_query ? (item) => conversation_of(item.node) || null : undefined,
        });
        const selected_ids = new Set(selected.map((item) => item.node.id));
        return [...selected, ...head.filter((item) => !selected_ids.has(item.node.id)), ...ranked.slice(depth)];
    })() : evidence_query?.aggregate || calendar !== null ? ranked : select_diverse(ranked, {
        lambda: policy.diversity_lambda,
        similarity: (left, right) => memory_similarity(left.node, right.node),
    });
    promote_current(diverse);
    if (limit !== null) diverse.splice(limit);
    const { bundles, forward_ids } = policy.flags.matrix_retrieval && deps.edges?.length
        ? conversation_bundles(diverse, admitted, deps.edges)
        : { bundles: new Map<string, readonly HydroNode[]>(), forward_ids: new Set<string>() };
    const context = build_context_packet(diverse, query.token_budget ?? Number.POSITIVE_INFINITY, { query_terms: plan.intent.terms, bundles, forward_bundle_ids: forward_ids });
    const included_ids = new Set(context.items.map((n) => n.id));

    for (const item of ranked) {
        candidates.push({
            id: item.node.id,
            admitted: true,
            label: item.label,
            score: item.score,
            included: included_ids.has(item.node.id),
            reasons: [],
        });
    }

    // Step 6: optional Hopfield-style associative retrieval (pattern, not truth).
    let hopfield: HopfieldResult | null = null;
    if (policy.flags.hopfield && query_vector) {
        const memories: HopfieldMemory[] = admitted
            .filter((n) => n.vectors.semantic && n.vectors.semantic.length === query_vector.length)
            .map((n) => ({ id: n.id, key: n.vectors.semantic!, value: n.vectors.semantic! }));
        hopfield = hopfield_recall(query_vector, memories, policy.hopfield_beta);
    }

    const trace: AssociativeTrace = {
        query: query.text,
        now: query.now,
        intent: plan.intent,
        resolved_entities: plan.resolved_entities,
        selected_worlds: plan.world_ids,
        retrieved: retrieved.length,
        admitted: admitted.length,
        rejected: retrieved.length - admitted.length,
        spread: {
            hops: spread.hops,
            visited: spread_enabled ? spread.visited.length : seed_count,
            seeds: seed_count,
            seed_density: admitted.length > 0 ? seed_count / admitted.length : 0,
            entropy: spread.entropy,
            peak: spread.peak,
            bypassed: spread.bypassed,
        },
        matrix: {
            enabled: matrix_query,
            features: matrix.active_features,
            regularization: matrix.regularization,
            temperature: matrix.temperature,
            seed_threshold: policy.flags.matrix_retrieval ? sparse.threshold : policy.seeds.legacy_threshold,
        },
        candidates,
        context_tokens: context.tokens_used,
        budget: context.budget,
        cold_scans: deps.index.cold_scans,
        evidence_rerank: {
            enabled: evidence_enabled,
            candidates: rerank_query.terms.length > 0 && ranked_entries.length > 1 ? Math.min(rerank_depth, ranked_entries.length) : 0,
            subject: evidence_query?.subject ?? null,
            aggregate: evidence_query?.aggregate ?? false,
        },
    };

    return { items: ranked, context, trace, hopfield };
}
