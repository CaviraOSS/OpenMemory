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
 *  file  : src/core/resolver/semantic_drift.ts
 *  usage : implements the LongMemory semantic drift component
 */


import { create_hydro_edge } from '../memory/durable_graph.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import { manual_provenance } from '../types/provenance.js';
import { entity_context, type Entity } from '../types/entity.js';
import { context_overlap, vector_similarity } from './entity_score.js';

export type DriftInput = {
    context?: string[];
    vector?: number[] | null;
    at?: number;
};

export type DriftResult = {
    drifted: boolean;
    drift_score: number;
    from_context: string;
    to_context: string;
    note: string;
};

const default_drift_threshold = 0.5;

export function detect_semantic_drift(
    entity: Entity,
    new_context: DriftInput,
    threshold: number = default_drift_threshold,
): DriftResult {
    const prev = entity_context(entity);
    const overlap = context_overlap(prev, new_context.context);
    const vec_sim =
        entity.vector && new_context.vector
            ? vector_similarity(entity.vector, new_context.vector)
            : 1;
    const similarity = 0.5 * overlap + 0.5 * vec_sim;
    const drift = 1 - similarity;

    return {
        drifted: drift >= threshold,
        drift_score: drift,
        from_context: prev.join(','),
        to_context: (new_context.context ?? []).join(','),
        note: `context drift ${drift.toFixed(3)}`,
    };
}

/** Build a semantic_shift edge for a detected drift on a single entity. */
export function create_semantic_shift_edge(entity: Entity, drift: DriftResult, at: number): HydroEdge {
    return create_hydro_edge({
        from: entity.id,
        to: `${entity.id}@${at}`,
        type: 'semantic_shift',
        confidence: 0.9,
        weight: 1,
        temporal: { valid_from: at, valid_to: null, observed_at: at, recorded_at: at },
        handler: {
            handler: 'semantic_shift',
            params: { note: drift.note, drift_score: drift.drift_score },
        },
        provenance: manual_provenance('entity-resolver', at),
    });
}
