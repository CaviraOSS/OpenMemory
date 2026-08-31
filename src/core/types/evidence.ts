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
 *  file  : src/core/types/evidence.ts
 *  usage : implements the LongMemory evidence component
 */


export type Evidence = {
    
    source_reliability: number;
    
    likelihood_ratio: number;
    
    grounded?: boolean;
    at?: number;
};

export type EvidenceUpdate = {
    
    prior: number;
    evidence: Evidence[];
    
    conflict_penalty?: number;
    
    age_penalty?: number;
};
