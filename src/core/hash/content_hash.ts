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
 *  file  : src/core/hash/content_hash.ts
 *  usage : implements the LongMemory content hash component
 */

import { createHash } from 'node:crypto';
import { canonicalize } from './canonical_json.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode } from '../types/hydro_node.js';

export function sha256_hex(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hash_canonical(value: unknown): string {
    return sha256_hex(canonicalize(value));
}

export type NodeHashPolicy = {
    content: boolean;
    facets: boolean;
    world: boolean;
    temporal: boolean;
    grounding: boolean;
    contract: boolean;
    provenance: boolean;
};

export const default_node_hash_policy: NodeHashPolicy = {
    content: true,
    facets: true,
    world: true,
    temporal: true,
    grounding: false,
    contract: false,
    provenance: false,
};

export type EdgeHashPolicy = {
    relation: boolean;
    temporal: boolean;
    handler: boolean;
    provenance: boolean;
};

export const default_edge_hash_policy: EdgeHashPolicy = {
    relation: true,
    temporal: true,
    handler: true,
    provenance: false,
};


export function project_node(node: HydroNode, policy: NodeHashPolicy): Record<string, unknown> {
    const projection: Record<string, unknown> = {};

    if (policy.content) {
        projection.content = {
            raw: node.content.raw,
            canonical: node.content.canonical,
            summary: node.content.summary,
            claims: node.content.claims,
        };
    }

    if (policy.facets) {
        projection.facets = node.facets;
    }

    if (policy.world) {
        projection.world = {
            world_id: node.world.world_id,
            parent_world_id: node.world.parent_world_id,
            zone: node.world.zone,
            scope_path: node.world.scope_path,
        };
    }

    if (policy.temporal) {
        
        
        
        projection.temporal = {
            valid_from: node.temporal.valid_from,
            observed_at: node.temporal.observed_at,
        };
    }

    if (policy.grounding) {
        projection.grounding = {
            worlddb_ref: node.grounding.worlddb_ref,
            source_ids: node.grounding.source_ids,
            grounding_score: node.grounding.grounding_score,
        };
    }

    if (policy.contract) {
        projection.contract = node.contract;
    }

    if (policy.provenance) {
        projection.provenance = node.provenance;
    }

    return projection;
}

export function hash_node(node: HydroNode, policy: NodeHashPolicy = default_node_hash_policy): string {
    return hash_canonical(project_node(node, policy));
}

export function verify_node_hash(node: HydroNode, policy: NodeHashPolicy = default_node_hash_policy): boolean {
    return hash_node(node, policy) === node.content_hash;
}


export function project_edge(edge: HydroEdge, policy: EdgeHashPolicy): Record<string, unknown> {
    const projection: Record<string, unknown> = {};

    if (policy.relation) {
        projection.relation = {
            from: edge.from,
            to: edge.to,
            type: edge.type,
        };
    }

    if (policy.temporal) {
        projection.temporal = {
            valid_from: edge.temporal.valid_from,
            valid_to: edge.temporal.valid_to,
            observed_at: edge.temporal.observed_at,
        };
    }

    if (policy.handler) {
        projection.handler = edge.handler;
    }

    if (policy.provenance) {
        projection.provenance = edge.provenance;
    }

    return projection;
}

export function hash_edge(edge: HydroEdge, policy: EdgeHashPolicy = default_edge_hash_policy): string {
    return hash_canonical(project_edge(edge, policy));
}

export function verify_edge_hash(
    edge: HydroEdge,
    expected: string,
    policy: EdgeHashPolicy = default_edge_hash_policy,
): boolean {
    return hash_edge(edge, policy) === expected;
}
