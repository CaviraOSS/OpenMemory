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
 *  file  : src/core/math/evidence.ts
 *  usage : log-odds evidence confidence update + support fusion
 */













import type { Evidence, EvidenceUpdate } from '../types/evidence.js';
import { clamp_probability, logit, safe_log, sigmoid } from './utility.js';

export function update_confidence_with_evidence(update: EvidenceUpdate): number {
    let l = logit(update.prior);
    for (const e of update.evidence) {
        l += e.source_reliability * safe_log(e.likelihood_ratio);
    }
    l -= update.conflict_penalty ?? 0;
    l -= update.age_penalty ?? 0;
    return clamp_probability(sigmoid(l));
}


export function fuse_support(prior: number, supports: Evidence[]): number {
    return update_confidence_with_evidence({ prior, evidence: supports });
}
