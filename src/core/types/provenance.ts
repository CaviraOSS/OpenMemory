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
 *  file  : src/core/types/provenance.ts
 *  usage : where a durable fact came from + how it was extracted
 */






export type ExtractionMethod =
    | 'manual'
    | 'llm'
    | 'heuristic'
    | 'import'
    | 'synthetic';

export type SourceTraceEntry = {
    
    source_id: string;
    
    ref: string | null;
    
    at: number;
};

export type Provenance = {
    created_by: string;
    extraction_method: ExtractionMethod;
    source_trace: SourceTraceEntry[];
};

export function manual_provenance(created_by: string, at: number): Provenance {
    return {
        created_by: created_by,
        extraction_method: 'manual',
        source_trace: [{ source_id: created_by, ref: null, at }],
    };
}
