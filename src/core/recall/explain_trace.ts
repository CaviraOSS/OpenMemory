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
 *  file  : src/core/recall/explain_trace.ts
 *  usage : implements the LongMemory explain trace component
 */

import type { RecallLabel } from '../types/recall_mode.js';

export type CandidateTraceEntry = {
    id: string;
    accepted: boolean;
    label: RecallLabel;
    score: number | null;
    reasons: string[];
    included: boolean;
};

export type ExplainTrace = {
    query: string;
    at: number;
    intent: { terms: string[]; entity_names: string[] };
    resolved_entities: string[];
    selected_worlds: string[] | null;
    retrieved: number;
    accepted: number;
    rejected: number;
    candidates: CandidateTraceEntry[];
    context_tokens: number;
    budget: number;
    cold_scans: number;
};
