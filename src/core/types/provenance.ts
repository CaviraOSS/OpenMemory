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
 *  file  : src/core/types/provenance.ts
 *  usage : implements the LongMemory provenance component
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
