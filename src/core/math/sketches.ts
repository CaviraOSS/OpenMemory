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
 *  file  : src/core/math/sketches.ts
 *  usage : implements the LongMemory sketches component
 */


import { CountMinSketch, type CountMinSerialized } from './count_min.js';
import { FrequentDirections, type FrequentDirectionsSerialized } from './frequent_directions.js';
import { OjaTracker, type OjaSerialized } from './oja.js';

export type FrequencyDomain = 'entities' | 'tags' | 'relations' | 'worlds' | 'patterns';

export type MemorySketchOperation =
    | { type: 'frequency'; domain: FrequencyDomain; key: string }
    | { type: 'world'; id: string; vector: number[] }
    | { type: 'drift'; id: string; vector: number[] };

export const frequency_domains: readonly FrequencyDomain[] = [
    'entities', 'tags', 'relations', 'worlds', 'patterns',
] as const;

export type MemorySketchOptions = {
    width?: number;
    depth?: number;
    vector_dimension?: number;
    world_rows?: number;
    oja_learning_rate?: number;
};

export type SketchCandidate<T = unknown> = {
    id: string;
    keys: string[];
    base_score: number;
    value: T;

    valid?: boolean;
};

export type RankedSketchCandidate<T = unknown> = SketchCandidate<T> & {
    sketch_score: number;
    score: number;
};

export type MemorySketchSerialized = {
    kind: 'memory-sketches';
    version: 1;
    options: Required<MemorySketchOptions>;
    frequencies: Record<FrequencyDomain, CountMinSerialized>;
    worlds: Record<string, FrequentDirectionsSerialized>;
    drift: Record<string, OjaSerialized>;
};

const defaults: Required<MemorySketchOptions> = {
    width: 1024,
    depth: 4,
    vector_dimension: 8,
    world_rows: 8,
    oja_learning_rate: 0.05,
};

export class MemorySketches {
    readonly options: Required<MemorySketchOptions>;
    private frequencies: Record<FrequencyDomain, CountMinSketch>;
    private worlds = new Map<string, FrequentDirections>();
    private drift = new Map<string, OjaTracker>();

    constructor(options: MemorySketchOptions = {}) {
        this.options = { ...defaults, ...options };
        this.frequencies = Object.fromEntries(
            frequency_domains.map((domain) => [domain, new CountMinSketch(this.options.width, this.options.depth)]),
        ) as Record<FrequencyDomain, CountMinSketch>;
    }

    add(domain: FrequencyDomain, key: string, count = 1): this {
        this.frequencies[domain].add(key, count);
        return this;
    }

    apply_operation(operation: MemorySketchOperation): this {
        if (operation.type === 'frequency') return this.add(operation.domain, operation.key);
        if (operation.type === 'world') return this.update_world(operation.id, operation.vector);
        return this.update_drift(operation.id, operation.vector);
    }

    estimate(domain: FrequencyDomain, key: string): number {
        return this.frequencies[domain].estimate(key);
    }

    relevance(domain: FrequencyDomain, keys: readonly string[]): number {
        if (keys.length === 0) return 0;
        const sketch = this.frequencies[domain];
        const estimate = Math.max(...keys.map((key) => sketch.estimate(key)));
        if (estimate <= 0 || sketch.total <= 0) return 0;
        return Math.min(1, Math.log1p(estimate) / Math.log1p(sketch.total));
    }

    update_world(world_id: string, vector: readonly number[], weight = 1): this {
        const sketch = this.worlds.get(world_id) ?? new FrequentDirections(
            this.options.vector_dimension,
            this.options.world_rows,
        );
        sketch.update(vector, weight);
        this.worlds.set(world_id, sketch);
        this.add('worlds', world_id, weight);
        return this;
    }

    world_sketch(world_id: string): FrequentDirections | undefined {
        return this.worlds.get(world_id);
    }

    update_drift(concept_id: string, vector: readonly number[], weight = 1): this {
        const tracker = this.drift.get(concept_id) ?? new OjaTracker(this.options.vector_dimension, {
            learning_rate: this.options.oja_learning_rate,
        });
        tracker.update(vector, weight);
        this.drift.set(concept_id, tracker);
        return this;
    }

    drift_tracker(concept_id: string): OjaTracker | undefined {
        return this.drift.get(concept_id);
    }

    rank_candidates<T>(
        candidates: readonly SketchCandidate<T>[],
        domain: FrequencyDomain = 'patterns',
        weight = 0.15,
    ): RankedSketchCandidate<T>[] {
        return candidates.map((candidate) => {
            const sketch_score = this.relevance(domain, candidate.keys);
            return { ...candidate, sketch_score, score: candidate.base_score + weight * sketch_score };
        }).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
    }

    prune_candidates<T>(
        candidates: readonly SketchCandidate<T>[],
        limit: number,
        domain: FrequencyDomain = 'patterns',
        weight = 0.15,
    ): RankedSketchCandidate<T>[] {
        if (!Number.isInteger(limit) || limit < 0) throw new Error('limit must be a non-negative integer');
        return this.rank_candidates(candidates, domain, weight).slice(0, limit);
    }

    merge(other: MemorySketches): this {
        if (other.options.vector_dimension !== this.options.vector_dimension) {
            throw new Error('cannot merge sketch layers with different vector dimensions');
        }
        for (const domain of frequency_domains) this.frequencies[domain].merge(other.frequencies[domain]);
        for (const [world_id, source] of other.worlds) {
            const target = this.worlds.get(world_id) ?? new FrequentDirections(this.options.vector_dimension, this.options.world_rows);
            target.merge(source);
            this.worlds.set(world_id, target);
        }
        for (const [concept_id, source] of other.drift) {
            const target = this.drift.get(concept_id) ?? OjaTracker.deserialize(source.serialize());
            if (this.drift.has(concept_id)) target.merge(source);
            this.drift.set(concept_id, target);
        }
        return this;
    }

    snapshot(): MemorySketchSerialized {
        return {
            kind: 'memory-sketches',
            version: 1,
            options: { ...this.options },
            frequencies: Object.fromEntries(
                frequency_domains.map((domain) => [domain, this.frequencies[domain].snapshot()]),
            ) as Record<FrequencyDomain, CountMinSerialized>,
            worlds: Object.fromEntries([...this.worlds].map(([id, sketch]) => [id, sketch.snapshot()])),
            drift: Object.fromEntries([...this.drift].map(([id, tracker]) => [id, tracker.snapshot()])),
        };
    }

    serialize(): string {
        return JSON.stringify(this.snapshot());
    }

    restore(value: string | MemorySketchSerialized): void {
        const restored = MemorySketches.deserialize(value);
        if (restored.options.vector_dimension !== this.options.vector_dimension) {
            throw new Error('cannot restore sketch layer with different vector dimensions');
        }
        this.frequencies = restored.frequencies;
        this.worlds = restored.worlds;
        this.drift = restored.drift;
    }

    static deserialize(value: string | MemorySketchSerialized): MemorySketches {
        const data = typeof value === 'string' ? JSON.parse(value) as MemorySketchSerialized : value;
        if (data.kind !== 'memory-sketches' || data.version !== 1) throw new Error('unsupported sketch-layer serialization');
        const sketches = new MemorySketches(data.options);
        sketches.frequencies = Object.fromEntries(
            frequency_domains.map((domain) => [domain, CountMinSketch.deserialize(data.frequencies[domain])]),
        ) as Record<FrequencyDomain, CountMinSketch>;
        sketches.worlds = new Map(Object.entries(data.worlds).map(([id, item]) => [id, FrequentDirections.deserialize(item)]));
        sketches.drift = new Map(Object.entries(data.drift).map(([id, item]) => [id, OjaTracker.deserialize(item)]));
        return sketches;
    }
}

export { MemorySketches as SketchLayer };