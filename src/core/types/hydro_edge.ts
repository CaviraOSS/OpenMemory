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
 *  file  : src/core/types/hydro_edge.ts
 *  usage : implements the LongMemory hydro edge component
 */

import type { Provenance } from './provenance.js';

export type EdgeTemporal = {
    valid_from: number;
    valid_to: number | null;
    observed_at: number;
    recorded_at: number;
};


export type EdgeHandlerMeta = {
    
    handler: string | null;
    params: Record<string, unknown>;
};

export type HydroEdge = {
    id: string;
    from: string;
    to: string;
    type: string;
    
    confidence: number;
    
    weight: number;
    temporal: EdgeTemporal;
    handler: EdgeHandlerMeta;
    provenance: Provenance;
};


export type HydroEdgeInput = Omit<HydroEdge, 'id'> & { id?: string };
