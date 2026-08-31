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
 *  file  : src/core/resolver/candidate_merge.ts
 *  usage : implements the LongMemory candidate merge component
 */


import { sha256_hex } from '../hash/content_hash.js';
import { create_hydro_edge } from '../memory/durable_graph.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import { manual_provenance } from '../types/provenance.js';
import type { Entity, EntityMention } from '../types/entity.js';
import { normalize_name, type ScoreBreakdown } from './entity_score.js';

export type MergeCandidate = {
    id: string;
    mention_name: string;
    candidate_entity_id: string;
    canonical_entity_id: string;
    score: number;
    breakdown: ScoreBreakdown;
    created_at: number;
    resolved: boolean;
};


export function entity_id(name: string, type: string, at: number, discriminator = ''): string {
    const digest = sha256_hex(`${normalize_name(name)}|${type}|${at}|${discriminator}`);
    return `entity:${digest.slice(0, 16)}`;
}

/** Build a fresh entity from a mention. Used for new entities and candidates. */
export function create_entity_candidate(input: EntityMention, at: number): Entity {
    const type = input.type ?? 'unknown';
    const aliases = [...new Set((input.aliases ?? []).map((a) => a))];
    const domain = typeof input.metadata?.['domain'] === 'string' ? input.metadata['domain'] : '';
    const disambiguator =
        typeof input.metadata?.['disambiguator'] === 'string' ? input.metadata['disambiguator'] : '';
    const discriminator = `${domain}|${disambiguator}|${input.world_id ?? ''}`;
    return {
        id: entity_id(input.name, type, at, discriminator),
        canonical_name: input.name,
        aliases,
        type,
        created_at: at,
        updated_at: at,
        world_ids: input.world_id ? [input.world_id] : [],
        vector: input.vector ?? null,
        metadata: { ...(input.metadata ?? {}), context: input.context ?? [] },
        drift_history: [],
        confidence: input.type ? 0.6 : 0.5,
    };
}

export function create_merge_candidate(
    mention: EntityMention,
    candidate_entity: Entity,
    canonical: Entity,
    breakdown: ScoreBreakdown,
    at: number,
): MergeCandidate {
    return {
        id: `candidate:${candidate_entity.id}->${canonical.id}`,
        mention_name: mention.name,
        candidate_entity_id: candidate_entity.id,
        canonical_entity_id: canonical.id,
        score: breakdown.score,
        breakdown,
        created_at: at,
        resolved: false,
    };
}

/** Strong-conflict guard: true means these entities must NOT be merged. */
export function prevent_unsafe_merge(entity_a: Entity, entity_b: Entity): boolean {
    if (
        entity_a.type !== 'unknown' &&
        entity_b.type !== 'unknown' &&
        entity_a.type !== entity_b.type
    ) {
        return true;
    }
    for (const key of ['domain', 'disambiguator']) {
        const a = entity_a.metadata[key];
        const b = entity_b.metadata[key];
        if (typeof a === 'string' && typeof b === 'string' && a !== b) return true;
    }
    return false;
}

/** Build (but do not register) a same_as edge from a candidate to a canonical. */
export function create_same_as_edge(candidate: Entity, canonical: Entity, at: number): HydroEdge {
    return create_hydro_edge({
        from: candidate.id,
        to: canonical.id,
        type: 'same_as',
        confidence: 0.99,
        weight: 1,
        temporal: { valid_from: at, valid_to: null, observed_at: at, recorded_at: at },
        handler: { handler: 'same_as', params: { alias: candidate.canonical_name } },
        provenance: manual_provenance('entity-resolver', at),
    });
}
