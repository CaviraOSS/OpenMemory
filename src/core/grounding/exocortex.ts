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
 *  file  : src/core/grounding/exocortex.ts
 *  usage : implements the LongMemory exocortex component
 */

import { sha256_hex } from '../hash/content_hash.js';
import type { Zone } from '../types/hydro_node.js';
import {
    compute_grounding_score,
    default_grounding_weights,
    freshness_score,
    type GroundingScoreWeights,
    type GroundingTrace,
} from './grounding_score.js';
import { cosine_similarity } from './resonance.js';
import { InMemoryWorldDB } from './worlddb_adapter.js';
import type { WorldUpdateEvent } from './world_update.js';

export type GroundingSourceKind =
    | 'tool'
    | 'api'
    | 'document'
    | 'database'
    | 'sensor'
    | 'worlddb'
    | 'manual';

export type GroundingSource = {
    id: string;
    kind: GroundingSourceKind;
    
    reliability: number;
};


export type GroundedFact = {
    ref: string;
    statement: string;
    vector: number[] | null;
    source: GroundingSource;
    observed_at: number;
    valid_from: number;
    valid_to: number | null;
    observation_count: number;
    metadata: Record<string, unknown>;
};

export type GroundedFactInput = {
    statement: string;
    source: GroundingSource;
    vector?: number[] | null;
    observed_at?: number;
    valid_from?: number;
    valid_to?: number | null;
    observation_count?: number;
    metadata?: Record<string, unknown>;
    ref?: string;
};


export function create_exocortex_fact(input: GroundedFactInput): GroundedFact {
    const observed_at = input.observed_at ?? Date.now();
    const ref = input.ref ?? `fact:${sha256_hex(`${input.statement}|${input.source.id}|${observed_at}`).slice(0, 16)}`;
    return {
        ref,
        statement: input.statement,
        vector: input.vector ?? null,
        source: input.source,
        observed_at,
        valid_from: input.valid_from ?? observed_at,
        valid_to: input.valid_to ?? null,
        observation_count: input.observation_count ?? 1,
        metadata: input.metadata ?? {},
    };
}


export type GroundableMemory = {
    id: string;
    zone: Zone;
    statement: string;
    vector: number[] | null;
    
    requires_grounding: boolean;
    confidence: number;
    valid_from: number;
    valid_to: number | null;
    observed_at: number;
    grounding_score: number;
};

export type GroundableMemoryInput = {
    id: string;
    zone: Zone;
    statement: string;
    vector?: number[] | null;
    requires_grounding?: boolean;
    confidence?: number;
    valid_from?: number;
    valid_to?: number | null;
    observed_at?: number;
};

type GroundingRecord = { fact_ref: string; trace: GroundingTrace };

export type GroundingLayerOptions = {
    now?: number;
    worlddb?: InMemoryWorldDB;
    weights?: GroundingScoreWeights;
    
    grounding_threshold?: number;
};

function clamp01(x: number): number {
    return Math.min(1, Math.max(0, x));
}

export class GroundingLayer {
    readonly now: number;
    readonly worlddb: InMemoryWorldDB;
    private readonly weights: GroundingScoreWeights;
    private readonly grounding_threshold: number;

    private memories = new Map<string, GroundableMemory>();
    private base_confidence = new Map<string, number>();
    private groundings = new Map<string, GroundingRecord>();

    constructor(options: GroundingLayerOptions = {}) {
        this.now = options.now ?? Date.now();
        this.worlddb = options.worlddb ?? new InMemoryWorldDB(() => this.now);
        this.weights = options.weights ?? default_grounding_weights;
        this.grounding_threshold = options.grounding_threshold ?? 0.6;
        
        this.worlddb.subscribe?.((event) => this.recompute_grounding_on_world_update(event));
    }

    

    create_exocortex_fact(input: GroundedFactInput): GroundedFact {
        const fact = create_exocortex_fact({ ...input, observed_at: input.observed_at ?? this.now });
        this.worlddb.upsert(fact);
        return fact;
    }

    

    add_memory(input: GroundableMemoryInput): GroundableMemory {
        const memory: GroundableMemory = {
            id: input.id,
            zone: input.zone,
            statement: input.statement,
            vector: input.vector ?? null,
            requires_grounding: input.requires_grounding ?? false,
            confidence: input.confidence ?? 1,
            valid_from: input.valid_from ?? this.now,
            valid_to: input.valid_to ?? null,
            observed_at: input.observed_at ?? this.now,
            grounding_score: 0,
        };
        this.memories.set(memory.id, memory);
        this.base_confidence.set(memory.id, memory.confidence);
        return memory;
    }

    get_memory(id: string): GroundableMemory | undefined {
        return this.memories.get(id);
    }

    

    compute_grounding_score(
        memory: GroundableMemory,
        fact: GroundedFact,
        opts: { conflict?: number; at?: number } = {},
    ): GroundingTrace {
        const at = opts.at ?? this.now;
        const signals = {
            source_reliability: fact.source.reliability,
            freshness: freshness_score(fact.observed_at, fact.valid_to, at),
            observation_count: fact.observation_count,
            external_agreement: cosine_similarity(memory.vector, fact.vector),
            conflict: opts.conflict ?? 0,
        };
        return compute_grounding_score(memory.id, fact.ref, signals, this.weights, at);
    }

    
    ground_memory_to_fact(
        memory_id: string,
        fact_ref: string,
        opts: { conflict?: number } = {},
    ): GroundingTrace {
        const memory = this.require_memory(memory_id);
        const fact = this.worlddb.get(fact_ref);
        if (!fact) throw new Error(`groundMemoryToFact: unknown fact ${fact_ref}`);
        const trace = this.compute_grounding_score(memory, fact, opts);
        this.groundings.set(memory_id, { fact_ref: fact_ref, trace });
        this.apply_grounding(memory, trace.grounding_score);
        return trace;
    }

    /** Rule 4/5: re-evaluate grounded memories when the world changes. */
    recompute_grounding_on_world_update(event: WorldUpdateEvent): {
        affected: string[];
        traces: GroundingTrace[];
    } {
        const affected: string[] = [];
        const traces: GroundingTrace[] = [];
        for (const [memory_id, record] of this.groundings) {
            if (record.fact_ref !== event.ref) continue;
            const memory = this.memories.get(memory_id);
            if (!memory) continue;
            affected.push(memory_id);

            if (event.kind === 'removed' || !event.fact) {
                const trace = compute_grounding_score(
                    memory_id,
                    event.ref,
                    { source_reliability: 0, freshness: 0, observation_count: 0, external_agreement: 0, conflict: 1 },
                    this.weights,
                    event.at,
                );
                this.groundings.set(memory_id, { fact_ref: event.ref, trace });
                this.apply_grounding(memory, 0);
                traces.push(trace);
            } else {
                const trace = this.compute_grounding_score(memory, event.fact, { at: event.at });
                this.groundings.set(memory_id, { fact_ref: event.ref, trace });
                this.apply_grounding(memory, trace.grounding_score);
                traces.push(trace);
            }
        }
        return { affected, traces };
    }

    /** Grounded memories usable by world-grounded recall (rule 3). */
    find_grounded_memories(opts: { min_score?: number } = {}): GroundableMemory[] {
        const min = opts.min_score ?? this.grounding_threshold;
        return [...this.memories.values()]
            .filter((m) => {
                const g = this.groundings.get(m.id);
                return !!g && g.trace.grounding_score >= min && this.worlddb.validate(g.fact_ref);
            })
            .sort((a, b) => (a.id < b.id ? -1 : 1));
    }

    /** Rule 1/2/3: endocortex may be ungrounded, but required grounding must hold. */
    validate_grounding_requirement(memory_id: string): boolean {
        const memory = this.require_memory(memory_id);
        if (!memory.requires_grounding) return true;
        const g = this.groundings.get(memory_id);
        return !!g && g.trace.grounding_score >= this.grounding_threshold && this.worlddb.validate(g.fact_ref);
    }

    grounding_trace_for(memory_id: string): GroundingTrace | undefined {
        return this.groundings.get(memory_id)?.trace;
    }

    // ---- internals -------------------------------------------------------

    private apply_grounding(memory: GroundableMemory, score: number): void {
        memory.grounding_score = score;
        const base = this.base_confidence.get(memory.id) ?? memory.confidence;
        // Rule 5: grounding can lower or raise confidence.
        memory.confidence = clamp01(base + 0.4 * (score - 0.5));
    }

    private require_memory(memory_id: string): GroundableMemory {
        const memory = this.memories.get(memory_id);
        if (!memory) throw new Error(`GroundingLayer: memory not found: ${memory_id}`);
        return memory;
    }
}
