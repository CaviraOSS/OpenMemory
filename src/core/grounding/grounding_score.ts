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
 *  file  : src/core/grounding/grounding_score.ts
 *  usage : implements the LongMemory grounding score component
 */


import { sigmoid } from '../math/utility.js';

const day_ms = 86_400_000;

export type GroundingScoreWeights = {
    source: number;
    freshness: number;
    observation: number;
    agreement: number;
    conflict: number;
};

export const default_grounding_weights: GroundingScoreWeights = {
    source: 0.3,
    freshness: 0.25,
    observation: 0.15,
    agreement: 0.3,
    conflict: 0.5,
};

export type GroundingSignals = {
    
    source_reliability: number;
    
    freshness: number;
    
    observation_count: number;
    
    external_agreement: number;
    
    conflict: number;
};

export type GroundingTrace = {
    memory_id: string;
    fact_ref: string | null;
    signals: GroundingSignals;
    weights: GroundingScoreWeights;
    
    linear: number;
    
    grounding_score: number;
    explanation: string[];
    at: number;
};

function clamp01(x: number): number {
    return Math.min(1, Math.max(0, x));
}
export function normalize_observation_count(count: number): number {
    const c = Math.max(0, count);
    return c / (c + 3);
}


export function freshness_score(
    observed_at: number,
    valid_to: number | null,
    now: number,
    halflife_days = 30,
): number {
    const age_days = Math.max(0, (now - observed_at) / day_ms);
    let fresh = Math.exp(-age_days / halflife_days);
    if (valid_to !== null && now >= valid_to) fresh *= 0.2;
    return clamp01(fresh);
}

export function compute_grounding_score(
    memory_id: string,
    fact_ref: string | null,
    signals: GroundingSignals,
    weights: GroundingScoreWeights = default_grounding_weights,
    at: number = Date.now(),
): GroundingTrace {
    const obs = normalize_observation_count(signals.observation_count);

    const parts = {
        source: weights.source * signals.source_reliability,
        freshness: weights.freshness * signals.freshness,
        observation: weights.observation * obs,
        agreement: weights.agreement * signals.external_agreement,
        conflict: weights.conflict * signals.conflict,
    };

    const linear = parts.source + parts.freshness + parts.observation + parts.agreement - parts.conflict;
    const grounding_score = clamp01(sigmoid(linear));

    const explanation = [
        `source_reliability ${signals.source_reliability.toFixed(2)} * w ${weights.source} = ${parts.source.toFixed(3)}`,
        `freshness ${signals.freshness.toFixed(2)} * w ${weights.freshness} = ${parts.freshness.toFixed(3)}`,
        `observation ${obs.toFixed(2)} (count ${signals.observation_count}) * w ${weights.observation} = ${parts.observation.toFixed(3)}`,
        `external_agreement ${signals.external_agreement.toFixed(2)} * w ${weights.agreement} = ${parts.agreement.toFixed(3)}`,
        `conflict ${signals.conflict.toFixed(2)} * w ${weights.conflict} = -${parts.conflict.toFixed(3)}`,
        `linear ${linear.toFixed(3)} -> sigmoid -> grounding_score ${grounding_score.toFixed(3)}`,
    ];

    return { memory_id: memory_id, fact_ref: fact_ref, signals, weights, linear, grounding_score, explanation, at };
}
