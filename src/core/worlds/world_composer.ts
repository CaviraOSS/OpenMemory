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
 *  file  : src/core/worlds/world_composer.ts
 *  usage : implements the LongMemory world composer component
 */

import type { World } from '../types/world.js';
import {
    average_vectors,
    normalize_vector,
    ontology_to_vector,
    scale_add,
    zeros,
} from './world_embedding.js';

export type WorldEmbeddingWeights = {
    node: number;
    child_world: number;
    relation: number;
    grounding: number;
    ontology: number;
};

export const default_world_embedding_weights: WorldEmbeddingWeights = {
    node: 0.4,
    child_world: 0.25,
    relation: 0.15,
    grounding: 0.1,
    ontology: 0.1,
};

export type WorldVectorSources = {
    dim: number;
    node_vector(node_id: string): number[] | null;
    child_world_vector(world_id: string): number[] | null;
    relation_vector?(edge_id: string): number[] | null;
    grounding_vector?(world: World): number[] | null;
};

function collect(ids: string[], get: (id: string) => number[] | null): number[][] {
    const out: number[][] = [];
    for (const id of ids) {
        const v = get(id);
        if (v) out.push(v);
    }
    return out;
}

export function compose_world_embedding(
    world: World,
    sources: WorldVectorSources,
    weights: WorldEmbeddingWeights = default_world_embedding_weights,
): number[] {
    const dim = sources.dim;
    const acc = zeros(dim);

    const add_group = (vectors: number[][], weight: number): void => {
        const avg = average_vectors(vectors, dim);
        if (avg) scale_add(acc, avg, weight);
    };

    add_group(collect(world.node_refs, sources.node_vector), weights.node);
    add_group(collect(world.child_world_ids, sources.child_world_vector), weights.child_world);

    if (sources.relation_vector) {
        add_group(collect(world.edge_refs, sources.relation_vector), weights.relation);
    }

    const grounding = sources.grounding_vector?.(world) ?? null;
    if (grounding) scale_add(acc, grounding, weights.grounding);

    scale_add(acc, ontology_to_vector(world.ontology, dim), weights.ontology);

    return normalize_vector(acc);
}
