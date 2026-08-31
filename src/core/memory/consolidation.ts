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
 *  file  : src/core/memory/consolidation.ts
 *  usage : implements the LongMemory consolidation component
 */


import type { WorldDBAdapter } from '../grounding/worlddb_adapter.js';
import type { Contract, PrivacyLevel } from '../types/contract.js';
import { default_contract } from '../types/contract.js';
import { empty_facets } from '../types/facets.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode } from '../types/hydro_node.js';
import { default_node_state } from '../types/node_state.js';
import type { Provenance, SourceTraceEntry } from '../types/provenance.js';
import { create_derived_from_edge } from './reconsolidation.js';
import { create_hydro_node } from './durable_graph.js';
import {
    detect_consolidation_patterns,
    type ConsolidationPattern,
    type PatternDetectionContext,
} from './pattern_detector.js';
import { build_procedure_memory } from './procedure_builder.js';
import { build_reflection_memory } from './reflection_builder.js';

export type ConsolidationContext = PatternDetectionContext & {
    now: number;
    threshold?: number;
    worlddb?: WorldDBAdapter;
    contract?: Partial<Contract>;
};

export type ConsolidationResult = {
    memories: HydroNode[];
    edges: HydroEdge[];
    patterns: ConsolidationPattern[];
    skipped: Array<{ pattern: ConsolidationPattern; reason: string }>;
    source_count: number;
};

const default_threshold = 0.5;
const preference_re = /\b(prefer|preference|favorite|favourite|like|love|dislike|hate)\b/i;
const privacy_rank: Record<PrivacyLevel, number> = { public: 0, private: 1, sensitive: 2, secret: 3 };

function most_private(values: readonly PrivacyLevel[]): PrivacyLevel {
    return [...values].sort((left, right) => privacy_rank[right] - privacy_rank[left])[0] ?? 'private';
}

function derive_contract(pattern: ConsolidationPattern, override: Partial<Contract> = {}): Contract {
    const sources = pattern.sources;
    const base = default_contract();
    const inherited: Contract = {
        ...base,
        use_for_reasoning: sources.every((node) => node.contract.use_for_reasoning),
        use_for_personalization: sources.every((node) => node.contract.use_for_personalization),
        use_for_prediction: sources.every((node) => node.contract.use_for_prediction),
        use_for_emotional_context: sources.some((node) => node.contract.use_for_emotional_context),
        use_for_associative_recall: sources.every((node) => node.contract.use_for_associative_recall),
        requires_grounding: pattern.kind === 'corrected_belief' || sources.some((node) => node.contract.requires_grounding),
        expires_if_unconfirmed: sources.some((node) => node.contract.expires_if_unconfirmed),
        privacy_level: most_private(sources.map((node) => node.contract.privacy_level)),
        max_valid_duration: sources.reduce<number | null>((limit, node) => {
            const next = node.contract.max_valid_duration;
            if (next === null) return limit;
            return limit === null ? next : Math.min(limit, next);
        }, null),
        source_required: true,
    };
    return { ...inherited, ...override };
}

function derived_provenance(pattern: ConsolidationPattern, now: number): Provenance {
    const source_trace: SourceTraceEntry[] = pattern.sources.flatMap((node) => [
        ...node.provenance.source_trace,
        { source_id: node.id, ref: node.content_hash, at: node.temporal.recorded_at },
    ]);
    return { created_by: 'consolidation', extraction_method: 'heuristic', source_trace };
}

function avg_vector(nodes: readonly HydroNode[]): number[] | null {
    const vectors = nodes.map((node) => node.vectors.semantic).filter((item): item is number[] => item !== null);
    if (vectors.length === 0) return null;
    const dim = vectors[0].length;
    const same = vectors.filter((vector) => vector.length === dim);
    const out = new Array<number>(dim).fill(0);
    for (const vector of same) for (let i = 0; i < dim; i++) out[i] += vector[i];
    return out.map((value) => value / same.length);
}

function newest_source(pattern: ConsolidationPattern): HydroNode {
    return [...pattern.sources].sort(
        (left, right) => right.temporal.observed_at - left.temporal.observed_at,
    )[0];
}

function sources_stale(pattern: ConsolidationPattern, now: number): boolean {
    return pattern.sources.every((node) =>
        node.state.status === 'superseded' ||
        node.state.status === 'expired' ||
        node.temporal.superseded_at !== null ||
        (node.temporal.valid_to !== null && now >= node.temporal.valid_to),
    );
}

function grounding_for(
    pattern: ConsolidationPattern,
    ctx: ConsolidationContext,
): { worlddb_ref: string | null; source_ids: string[]; grounding_score: number; current: boolean } {
    if (pattern.fact) {
        const current = pattern.fact.valid_to === null || ctx.now < pattern.fact.valid_to;
        return {
            worlddb_ref: pattern.fact.ref,
            source_ids: [pattern.fact.source.id],
            grounding_score: current ? pattern.fact.source.reliability : 0,
            current,
        };
    }
    const grounded = [...pattern.sources]
        .sort((left, right) => right.grounding.grounding_score - left.grounding.grounding_score)
        .find((node) => node.grounding.worlddb_ref !== null);
    if (!grounded) return { worlddb_ref: null, source_ids: [], grounding_score: 0, current: false };
    const fact = grounded.grounding.worlddb_ref && ctx.worlddb
        ? ctx.worlddb.get(grounded.grounding.worlddb_ref)
        : null;
    const current = fact
        ? fact.valid_to === null || ctx.now < fact.valid_to
        : !ctx.worlddb && !sources_stale(pattern, ctx.now);
    return {
        worlddb_ref: grounded.grounding.worlddb_ref,
        source_ids: grounded.grounding.source_ids,
        grounding_score: current ? grounded.grounding.grounding_score : 0,
        current,
    };
}

function build_semantic(pattern: ConsolidationPattern, ctx: ConsolidationContext): HydroNode {
    const newest = newest_source(pattern);
    const stale = sources_stale(pattern, ctx.now);
    const grounding = grounding_for(pattern, ctx);
    const preference = preference_re.test(pattern.statement);
    const factual = !preference && (pattern.sources.some((node) => node.contract.requires_grounding) || grounding.worlddb_ref !== null);
    const stale_fact = stale || (factual && !grounding.current);
    const statement = `Stable semantic memory: ${pattern.statement}`;
    const contract = derive_contract(pattern, ctx.contract);
    return create_hydro_node({
        content: { raw: statement, canonical: statement.toLowerCase(), summary: statement },
        facets: { ...empty_facets(), semantic: { value: pattern.statement, weight: 1 } },
        world: newest.world,
        temporal: {
            valid_from: ctx.now,
            valid_to: stale_fact ? ctx.now : null,
            observed_at: newest.temporal.observed_at,
            recorded_at: ctx.now,
            superseded_at: stale_fact ? ctx.now : null,
        },
        contract: { ...contract, requires_grounding: factual || contract.requires_grounding },
        grounding: {
            worlddb_ref: grounding.worlddb_ref,
            source_ids: grounding.source_ids,
            grounding_score: grounding.grounding_score,
        },
        state: {
            ...default_node_state(),
            status: stale_fact ? 'superseded' : 'active',
            confidence: Math.min(1, pattern.signals.confidence + 0.1),
            salience: Math.min(1, pattern.signals.salience + 0.1),
        },
        vectors: { semantic: avg_vector(pattern.sources), type_vector: null, world_vector: newest.vectors.world_vector },
        provenance: derived_provenance(pattern, ctx.now),
    });
}

function build_corrected(pattern: ConsolidationPattern, ctx: ConsolidationContext): HydroNode | null {
    if (!pattern.fact || (pattern.fact.valid_to !== null && ctx.now >= pattern.fact.valid_to)) return null;
    const newest = newest_source(pattern);
    const statement = `Corrected grounded belief: ${pattern.fact.statement}`;
    return create_hydro_node({
        content: { raw: statement, canonical: statement.toLowerCase(), summary: statement },
        facets: { ...empty_facets(), semantic: { value: pattern.fact.statement, weight: 1 } },
        world: newest.world,
        temporal: {
            valid_from: pattern.fact.valid_from,
            valid_to: pattern.fact.valid_to,
            observed_at: pattern.fact.observed_at,
            recorded_at: ctx.now,
            superseded_at: null,
        },
        contract: derive_contract(pattern, { ...ctx.contract, requires_grounding: true, source_required: true }),
        grounding: {
            worlddb_ref: pattern.fact.ref,
            source_ids: [pattern.fact.source.id],
            grounding_score: pattern.fact.source.reliability,
        },
        state: {
            ...default_node_state(),
            confidence: pattern.fact.source.reliability,
            salience: Math.min(1, pattern.signals.salience + 0.1),
        },
        vectors: { semantic: pattern.fact.vector, type_vector: null, world_vector: newest.vectors.world_vector },
        provenance: derived_provenance(pattern, ctx.now),
    });
}

export function consolidate_memories(
    sources: readonly HydroNode[],
    ctx: ConsolidationContext,
): ConsolidationResult {
    const patterns = detect_consolidation_patterns(sources, ctx);
    const memories: HydroNode[] = [];
    const edges: HydroEdge[] = [];
    const skipped: ConsolidationResult['skipped'] = [];

    for (const pattern of patterns) {
        if (pattern.signals.score < (ctx.threshold ?? default_threshold)) {
            skipped.push({ pattern, reason: `trigger score ${pattern.signals.score.toFixed(3)} below threshold` });
            continue;
        }
        const contract = derive_contract(pattern, ctx.contract);
        const provenance = derived_provenance(pattern, ctx.now);
        const vector = avg_vector(pattern.sources);
        let memory: HydroNode | null;
        if (pattern.kind === 'procedural') {
            memory = build_procedure_memory(pattern, { now: ctx.now, contract, provenance, vector });
        } else if (pattern.kind === 'reflection') {
            memory = build_reflection_memory(pattern, { now: ctx.now, contract, provenance, vector });
        } else if (pattern.kind === 'corrected_belief') {
            memory = build_corrected(pattern, ctx);
        } else {
            memory = build_semantic(pattern, ctx);
        }

        if (!memory) {
            skipped.push({ pattern, reason: 'external correction is already stale' });
            continue;
        }
        memories.push(memory);
        for (const source of pattern.sources) {
            edges.push(create_derived_from_edge(memory.id, source.id, ctx.now, provenance));
        }
    }

    return { memories, edges, patterns, skipped, source_count: sources.length };
}