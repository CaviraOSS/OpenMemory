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
 *  file  : src/core/math/decay.ts
 *  usage : implements the LongMemory decay component
 */

import { sigmoid } from './utility.js';

export type RetentionSignals = {
    importance: number;
    surprise: number;
    grounding: number;
    emotional_intensity: number;
    utility: number;
    confirmation: number;
    noise: number;
};

export function retention(s: RetentionSignals): number {
    return sigmoid(
        s.importance +
        s.surprise +
        s.grounding +
        s.emotional_intensity +
        s.utility +
        s.confirmation -
        s.noise,
    );
}

export type DecayRateInput = {
    base_lambda: number;
    noise: number;
    conflict: number;
    retention: number;
    reinforcement: number;
};

export function decay_rate(i: DecayRateInput): number {
    return (i.base_lambda * (1 + i.noise + i.conflict)) / (1 + i.retention + i.reinforcement);
}

export type ReinforcementPulse = {
    
    at_delta: number;
    amplitude: number;
};

export type MemoryWeightInput = {
    w0: number;
    lambda: number;
    delta_t: number;
    pulses?: ReinforcementPulse[];
};

export function memory_weight(i: MemoryWeightInput): number {
    let w = i.w0 * Math.exp(-i.lambda * i.delta_t);
    for (const pulse of i.pulses ?? []) {
        const dt = i.delta_t - pulse.at_delta;
        if (dt >= 0) w += pulse.amplitude * Math.exp(-i.lambda * dt);
    }
    return w;
}
