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
 *  file  : src/core/recall/explain_trace.ts
 *  usage : explainable trace of accepted/rejected recall candidates
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
