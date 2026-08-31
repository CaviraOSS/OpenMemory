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
 *  file  : src/core/types/recall_mode.ts
 *  usage : implements the LongMemory recall mode component
 */


export type RecallMode = 'strict' | 'historical' | 'associative' | 'world_grounded';


export type RecallLabel =
    | 'active'
    | 'superseded'
    | 'contradicted'
    | 'emotional_residue'
    | 'weak_pattern'
    | 'historical'
    | 'grounded';

export type GateThresholds = {
    
    min_confidence: number;
    
    grounding_threshold: number;
    
    min_freshness: number;
    
    min_source_reliability: number;
};

export const default_gate_thresholds: GateThresholds = {
    min_confidence: 0.5,
    grounding_threshold: 0.6,
    min_freshness: 0.3,
    min_source_reliability: 0.5,
};

export type GateContext = {
    now: number;
    
    at?: number;
    
    as_of?: number;
    
    grounding_score?: number;
    
    unresolved_contradiction?: boolean;
    
    freshness?: number;
    
    source_reliability?: number;
    permission_context?: {
        user_id?: string;
        team_ids?: string[];
        project_ids?: string[];
        source_ids?: string[];
        allow_private?: boolean;
    };
    thresholds?: Partial<GateThresholds>;
};

export type GateResult = {
    allowed: boolean;
    mode: RecallMode;
    label: RecallLabel;
    
    reasons: string[];
};
