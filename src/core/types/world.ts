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
 *  file  : src/core/types/world.ts
 *  usage : implements the LongMemory world component
 */

import type { Contract } from './contract.js';

export type WorldZone = 'endocortex' | 'exocortex' | 'mixed';

export type WorldOntology = {
    
    types: string[];
    
    terms: string[];
};

export function empty_ontology(): WorldOntology {
    return { types: [], terms: [] };
}


export type WorldPlacement = {
    node_id: string;
    from_world_id: string | null;
    to_world_id: string;
    at: number;
};

export type World = {
    id: string;
    name: string;
    parent_world_id: string | null;
    scope_path: string[];
    ontology: WorldOntology;
    
    contracts: Partial<Contract>;
    zone: WorldZone;
    child_world_ids: string[];
    node_refs: string[];
    edge_refs: string[];
    world_vector: number[] | null;
    content_hash: string;
    created_at: number;
    updated_at: number;
    metadata: Record<string, unknown>;
};

export type WorldInput = {
    name: string;
    parent_world_id?: string | null;
    scope_path?: string[];
    ontology?: WorldOntology;
    contracts?: Partial<Contract>;
    zone?: WorldZone;
    metadata?: Record<string, unknown>;
    at?: number;
};
