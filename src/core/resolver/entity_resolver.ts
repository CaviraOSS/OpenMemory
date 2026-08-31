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
 *  file  : src/core/resolver/entity_resolver.ts
 *  usage : implements the LongMemory entity resolver component
 */


import type { HydroEdge } from '../types/hydro_edge.js';
import type { Entity, EntityDriftEntry, EntityMention } from '../types/entity.js';
import { AliasIndex, type alias_index_checkpoint } from './alias_index.js';
import {
    create_entity_candidate,
    create_merge_candidate,
    create_same_as_edge as buildSameAsEdge,
    prevent_unsafe_merge,
    type MergeCandidate,
} from './candidate_merge.js';
import {
    create_semantic_shift_edge,
    detect_semantic_drift,
    type DriftInput,
    type DriftResult,
} from './semantic_drift.js';
import {
    default_score_weights,
    default_thresholds,
    score_entity_match,
    type ResolverThresholds,
    type ScoreBreakdown,
    type ScoreWeights,
} from './entity_score.js';
import { entity_candidate_index } from './entity_candidate_index.js';

export type ResolveAction = 'resolved' | 'candidate' | 'created';

export type ResolveResult = {
    action: ResolveAction;
    entity: Entity;
    score: number;
    breakdown?: ScoreBreakdown;
    matched?: Entity;
    candidate?: MergeCandidate;
};

export type EntityResolverOptions = {
    now?: number;
    weights?: ScoreWeights;
    thresholds?: ResolverThresholds;
};

export type EntityResolverSnapshot = {
    entities: Map<string, Entity>;
    candidates: Map<string, MergeCandidate>;
    aliases: Map<string, string>;
    merged_into: Map<string, string>;
};

export type entity_resolver_checkpoint = {
    readonly entities: Map<string, Entity | undefined>;
    readonly candidates: Map<string, MergeCandidate | undefined>;
    readonly merged_into: Map<string, string | undefined>;
    readonly aliases: alias_index_checkpoint;
};

export class EntityResolver {
    private entities = new Map<string, Entity>();
    private candidates = new Map<string, MergeCandidate>();
    private alias_index = new AliasIndex();
    private merged_into = new Map<string, string>();
    private readonly candidate_index = new entity_candidate_index();
    private readonly checkpoints = new Set<entity_resolver_checkpoint>();

    readonly now: number;
    readonly weights: ScoreWeights;
    readonly thresholds: ResolverThresholds;

    constructor(options: EntityResolverOptions = {}) {
        this.now = options.now ?? Date.now();
        this.weights = options.weights ?? default_score_weights;
        this.thresholds = options.thresholds ?? default_thresholds;
    }



    register_entity(entity: Entity): Entity {
        this.track_entity(entity.id);
        this.entities.set(entity.id, entity);
        this.alias_index.add(entity.canonical_name, entity.id);
        this.candidate_index.add_entity(entity);
        for (const alias of entity.aliases) this.alias_index.add(alias, entity.id);
        return entity;
    }

    add_entity(input: EntityMention): Entity {
        const at = input.observed_at ?? this.now;
        return this.register_entity(create_entity_candidate(input, at));
    }

    get_entity(id: string): Entity | undefined {
        return this.entities.get(id);
    }

    entity_list(): Entity[] {
        return [...this.entities.values()];
    }

    canonical_id_for(name: string): string | undefined {
        const direct = this.alias_index.lookup(name);
        if (!direct) return undefined;
        return this.merged_into.get(direct) ?? direct;
    }



    resolve(input: EntityMention): ResolveResult {
        const at = input.observed_at ?? this.now;
        const mention_entity = create_entity_candidate(input, at);




        const alias_id = this.canonical_id_for(input.name);
        if (alias_id) {
            const entity = this.entities.get(alias_id);
            if (entity && !prevent_unsafe_merge(mention_entity, entity)) {
                this.absorb_mention(entity, input, at);
                return { action: 'resolved', entity, score: 1, matched: entity };
            }
        }


        let best: Entity | undefined;
        let best_breakdown: ScoreBreakdown | undefined;
        for (const entity of this.match_candidates(input)) {
            const breakdown = score_entity_match(input, entity, this.weights);
            if (
                !best_breakdown ||
                breakdown.score > best_breakdown.score ||
                (breakdown.score === best_breakdown.score && entity.id < (best as Entity).id)
            ) {
                best = entity;
                best_breakdown = breakdown;
            }
        }

        if (best && best_breakdown) {
            const unsafe = prevent_unsafe_merge(mention_entity, best);


            if (!unsafe && best_breakdown.score >= this.thresholds.merge) {
                this.absorb_mention(best, input, at);
                return {
                    action: 'resolved',
                    entity: best,
                    score: best_breakdown.score,
                    breakdown: best_breakdown,
                    matched: best,
                };
            }



            if (best_breakdown.score >= this.thresholds.candidate) {
                this.register_entity(mention_entity);
                const candidate = create_merge_candidate(input, mention_entity, best, best_breakdown, at);
                this.track_candidate(candidate.id);
                this.candidates.set(candidate.id, candidate);
                return {
                    action: 'candidate',
                    entity: mention_entity,
                    score: best_breakdown.score,
                    breakdown: best_breakdown,
                    matched: best,
                    candidate,
                };
            }
        }


        this.register_entity(mention_entity);
        return {
            action: 'created',
            entity: mention_entity,
            score: best_breakdown?.score ?? 0,
            breakdown: best_breakdown,
            matched: best,
        };
    }

    private absorb_mention(entity: Entity, input: EntityMention, at: number): void {
        this.track_entity(entity.id);
        this.add_alias(entity.id, input.name);
        for (const alias of input.aliases ?? []) this.add_alias(entity.id, alias);
        if (input.world_id && !entity.world_ids.includes(input.world_id)) {
            entity.world_ids.push(input.world_id);
        }
        entity.updated_at = at;
    }



    add_alias(entity_id: string, alias: string): Entity {
        const entity = this.entities.get(entity_id);
        if (!entity) throw new Error(`addAlias: unknown entity ${entity_id}`);
        this.track_entity(entity_id);
        const normalized_existing = new Set(entity.aliases.map((a) => a.toLowerCase()));
        if (
            alias.toLowerCase() !== entity.canonical_name.toLowerCase() &&
            !normalized_existing.has(alias.toLowerCase())
        ) {
            entity.aliases.push(alias);
        }
        this.alias_index.add(alias, entity_id);
        this.candidate_index.add_name(entity_id, alias);
        entity.updated_at = Math.max(entity.updated_at, this.now);
        return entity;
    }

    // ---- manual merge ----------------------------------------------------

    /** Confirm a merge: emit a same_as edge and update the canonical mapping. */
    create_same_as_edge(candidate: Entity, canonical: Entity): HydroEdge {
        const at = this.now;
        this.track_entity(candidate.id);
        this.track_entity(canonical.id);
        const edge = buildSameAsEdge(candidate, canonical, at);

        this.add_alias(canonical.id, candidate.canonical_name);
        for (const alias of candidate.aliases) this.add_alias(canonical.id, alias);
        this.alias_index.add(candidate.canonical_name, canonical.id);
        this.track_merged(candidate.id);
        this.merged_into.set(candidate.id, canonical.id);

        for (const c of this.candidates.values()) {
            if (c.candidate_entity_id === candidate.id && c.canonical_entity_id === canonical.id) {
                this.track_candidate(c.id);
                c.resolved = true;
            }
        }
        canonical.updated_at = at;
        return edge;
    }

    // ---- drift -----------------------------------------------------------

    detect_drift(entity: Entity, new_context: DriftInput): DriftResult {
        return detect_semantic_drift(entity, new_context);
    }

    /** Record drift as a semantic_shift edge + drift_history entry (no overwrite). */
    record_semantic_drift(
        entity: Entity,
        new_context: DriftInput,
    ): { drift: DriftResult; edge: HydroEdge | null } {
        const drift = detect_semantic_drift(entity, new_context);
        if (!drift.drifted) return { drift, edge: null };

        this.track_entity(entity.id);
        const at = new_context.at ?? this.now;
        const edge = create_semantic_shift_edge(entity, drift, at);
        const entry: EntityDriftEntry = {
            at,
            from_context: drift.from_context,
            to_context: drift.to_context,
            note: drift.note,
            drift_score: drift.drift_score,
            shift_edge_id: edge.id,
        };
        entity.drift_history.push(entry);
        entity.updated_at = at;
        return { drift, edge };
    }

    candidate_list(): MergeCandidate[] {
        return [...this.candidates.values()];
    }

    snapshot(): EntityResolverSnapshot {
        return {
            entities: structuredClone(this.entities),
            candidates: structuredClone(this.candidates),
            aliases: this.alias_index.snapshot(),
            merged_into: new Map(this.merged_into),
        };
    }

    checkpoint(): entity_resolver_checkpoint {
        const checkpoint = {
            entities: new Map<string, Entity | undefined>(),
            candidates: new Map<string, MergeCandidate | undefined>(),
            merged_into: new Map<string, string | undefined>(),
            aliases: this.alias_index.checkpoint(),
        };
        this.checkpoints.add(checkpoint);
        return checkpoint;
    }

    commit(checkpoint: entity_resolver_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('EntityResolver: unknown checkpoint');
        this.alias_index.commit(checkpoint.aliases);
    }

    rollback(checkpoint: entity_resolver_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('EntityResolver: unknown checkpoint');
        for (const [id, entity] of checkpoint.entities) {
            if (entity === undefined) this.entities.delete(id);
            else this.entities.set(id, entity);
        }
        for (const [id, candidate] of checkpoint.candidates) {
            if (candidate === undefined) this.candidates.delete(id);
            else this.candidates.set(id, candidate);
        }
        for (const [id, canonical] of checkpoint.merged_into) {
            if (canonical === undefined) this.merged_into.delete(id);
            else this.merged_into.set(id, canonical);
        }
        this.alias_index.rollback(checkpoint.aliases);
        this.rebuild_candidate_index();
    }

    restore(snapshot: EntityResolverSnapshot): void {
        this.entities = structuredClone(snapshot.entities);
        this.candidates = structuredClone(snapshot.candidates);
        this.alias_index.restore(snapshot.aliases);
        this.merged_into = new Map(snapshot.merged_into);
        this.rebuild_candidate_index();
    }

    private match_candidates(input: EntityMention): Iterable<Entity> {
        const vector_max = input.vector?.length ? this.weights.vector : 0;
        const context_max = input.context?.length ? this.weights.context : 0;
        const non_name_max = vector_max + context_max + this.weights.temporal;
        if (this.weights.name <= 0 || non_name_max >= this.thresholds.candidate) return this.entities.values();
        const required_name = (this.thresholds.candidate - non_name_max) / this.weights.name;
        if (required_name > 1) return [];
        return [...this.candidate_index.candidates(input)].flatMap((id) => this.entities.get(id) ?? []);
    }

    private track_entity(id: string): void {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.entities.has(id)) {
                const entity = this.entities.get(id);
                checkpoint.entities.set(id, entity ? structuredClone(entity) : undefined);
            }
        }
    }

    private track_candidate(id: string): void {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.candidates.has(id)) {
                const candidate = this.candidates.get(id);
                checkpoint.candidates.set(id, candidate ? structuredClone(candidate) : undefined);
            }
        }
    }

    private track_merged(id: string): void {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.merged_into.has(id)) checkpoint.merged_into.set(id, this.merged_into.get(id));
        }
    }

    private rebuild_candidate_index(): void {
        this.candidate_index.clear();
        for (const entity of this.entities.values()) this.candidate_index.add_entity(entity);
    }
}

// ---- free-function wrappers matching the phase spec ---------------------

export function resolve_entity(input: EntityMention, context: EntityResolver): ResolveResult {
    return context.resolve(input);
}

export function create_entity_candidate_in(
    input: EntityMention,
    context: EntityResolver,
): Entity {
    return context.add_entity(input);
}
