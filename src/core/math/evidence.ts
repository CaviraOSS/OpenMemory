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
 *  file  : src/core/math/evidence.ts
 *  usage : implements the LongMemory evidence component
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
