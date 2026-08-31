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
 *  file  : src/core/math/contradiction.ts
 *  usage : implements the LongMemory contradiction component
 */


import type { Contradiction } from '../types/contradiction.js';
import { clamp_probability, logit, sigmoid } from './utility.js';

export type ContradictionSignal = {
    severity: number;
    confidence: number;
    unresolved: boolean;
};

export function contradiction_pressure(signals: ContradictionSignal[]): number {
    let max = 0;
    for (const s of signals) {
        const p = s.severity * s.confidence * (s.unresolved ? 1 : 0);
        if (p > max) max = p;
    }
    return max;
}


export function pressure_from_contradictions(
    contradictions: readonly Contradiction[],
    confidence_of: (node_id: string) => number,
): number {
    return contradiction_pressure(
        contradictions.map((c) => ({
            severity: c.severity,
            confidence: Math.max(confidence_of(c.node_a), confidence_of(c.node_b)),
            unresolved: !c.resolved,
        })),
    );
}


export function apply_contradiction_pressure(confidence: number, pressure: number): number {
    return clamp_probability(sigmoid(logit(confidence) - pressure));
}

export function has_unresolved_contradiction(contradictions: readonly Contradiction[]): boolean {
    return contradictions.some((c) => !c.resolved);
}


export function blocks_strict_recall(pressure: number, threshold = 0): boolean {
    return pressure > threshold;
}
