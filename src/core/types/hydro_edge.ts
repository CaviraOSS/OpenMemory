/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/types/hydro_edge.ts
 *  usage : the executable hydroedge relationship shape
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
