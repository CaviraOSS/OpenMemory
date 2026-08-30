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
 *  file  : src/core/types/entity.ts
 *  usage : implements the LongMemory entity component
 */

export type EntityType =
    | 'person'
    | 'place'
    | 'organization'
    | 'project'
    | 'concept'
    | 'thing'
    | 'unknown';

export type EntityDriftEntry = {
    at: number;
    
    from_context: string;
    
    to_context: string;
    note: string;
    drift_score: number;
    
    shift_edge_id: string | null;
};

export type Entity = {
    id: string;
    canonical_name: string;
    aliases: string[];
    type: EntityType;
    created_at: number;
    updated_at: number;
    world_ids: string[];
    
    vector: number[] | null;
    metadata: Record<string, unknown>;
    drift_history: EntityDriftEntry[];
    
    confidence: number;
};


export type EntityMention = {
    name: string;
    type?: EntityType;
    vector?: number[] | null;
    
    context?: string[];
    world_id?: string;
    observed_at?: number;
    metadata?: Record<string, unknown>;
    aliases?: string[];
};


export function entity_context(entity: Entity): string[] {
    const ctx = entity.metadata['context'];
    return Array.isArray(ctx) ? (ctx as string[]) : [];
}
