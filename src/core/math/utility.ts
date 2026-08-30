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
 *  file  : src/core/math/utility.ts
 *  usage : implements the LongMemory utility component
 */

const eps = 1e-9;

export function clamp01(x: number): number {
    return Math.min(1, Math.max(0, x));
}


export function clamp_probability(p: number, eps = 1e-6): number {
    return Math.min(1 - eps, Math.max(eps, p));
}

export function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

export function logit(p: number): number {
    const q = clamp_probability(p);
    return Math.log(q / (1 - q));
}


export function safe_log(x: number): number {
    return Math.log(Math.max(eps, x));
}

export type UtilitySignals = {
    
    recall_frequency: number;
    
    task_relevance: number;
    
    grounding: number;
};


export function memory_utility(signals: UtilitySignals): number {
    return clamp01(
        0.4 * signals.recall_frequency + 0.3 * signals.task_relevance + 0.3 * signals.grounding,
    );
}
