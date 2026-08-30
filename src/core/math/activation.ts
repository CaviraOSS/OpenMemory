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
 *  file  : src/core/math/activation.ts
 *  usage : implements the LongMemory activation component
 */

const default_decay = 0.5;

export function base_activation(time_since_accesses: readonly number[], d = default_decay): number {
    let sum = 0;
    for (const t of time_since_accesses) {
        const tt = Math.max(1e-6, t);
        sum += Math.pow(tt, -d);
    }
    if (sum <= 0) return Number.NEGATIVE_INFINITY;
    return Math.log(sum);
}

export type ActivationTerms = {
    base: number;
    context_association: number;
    task_relevance: number;
    grounding_relevance: number;
    contradiction_penalty: number;
};

export function activation(t: ActivationTerms): number {
    return (
        t.base +
        t.context_association +
        t.task_relevance +
        t.grounding_relevance -
        t.contradiction_penalty
    );
}

export function compute_activation(
    time_since_accesses: readonly number[],
    terms: Omit<ActivationTerms, 'base'>,
    d = default_decay,
): number {
    return activation({ base: base_activation(time_since_accesses, d), ...terms });
}
