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
 *  file  : src/core/recall/grounding_trace.ts
 *  usage : explainable trace for world-grounded recall
 */









export type Reconciliation = 'confirmed' | 'contradicted' | 'unconfirmed' | 'subjective_only';

export type GroundedCandidateTrace = {
    memory_id: string;
    grounded: boolean;
    fact_ref: string | null;
    source_id: string | null;
    source_kind: string | null;
    source_reliability: number | null;
    freshness: number;
    grounding_score: number;
    reconciliation: Reconciliation;
    accepted: boolean;
    reasons: string[];
};

export type WorldGroundedTrace = {
    query: string;
    now: number;
    intent: { terms: string[]; entity_names: string[] };
    resolved_entities: string[];
    selected_worlds: string[] | null;
    retrieved: number;
    endocortex: number;
    grounded_accepted: number;
    rejected: number;
    candidates: GroundedCandidateTrace[];
};
