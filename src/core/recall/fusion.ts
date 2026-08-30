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
 *  file  : src/core/recall/fusion.ts
 *  usage : implements the LongMemory fusion component
 */

export const default_fusion_k = 60;
export const default_fusion_depth = 64;

export function rank_indices(scores: ArrayLike<number>): number[] {
    const order: number[] = [];
    for (let index = 0; index < scores.length; index++) order.push(index);
    order.sort((left, right) => scores[right] - scores[left] || left - right);
    return order;
}

export function reciprocal_rank_fusion(
    rankings: readonly (readonly number[])[],
    size: number,
    k = default_fusion_k,
    depth = default_fusion_depth,
): Float64Array {
    const fused = new Float64Array(size);
    if (size === 0) return fused;
    for (const ranking of rankings) {
        const limit = Math.min(ranking.length, depth);
        for (let position = 0; position < limit; position++) {
            const index = ranking[position];
            if (index >= 0 && index < size) fused[index] += 1 / (k + position + 1);
        }
    }
    let max = 0;
    for (let index = 0; index < fused.length; index++) if (fused[index] > max) max = fused[index];
    if (max > 0) for (let index = 0; index < fused.length; index++) fused[index] /= max;
    return fused;
}

export type diversity_options<T> = {
    limit?: number;
    lambda?: number;
    similarity: (left: T, right: T) => number;
};

export function select_diverse<T>(items: readonly T[], options: diversity_options<T>): T[] {
    const limit = Math.min(options.limit ?? items.length, items.length);
    const lambda = Math.min(1, Math.max(0, options.lambda ?? 0.75));
    if (limit <= 1 || lambda >= 1) return items.slice(0, limit);

    const count = items.length;
    const pool = new Int32Array(count);
    for (let index = 0; index < count; index++) pool[index] = index;
    const redundancy = new Float64Array(count);
    const selected: T[] = [];
    let size = count;

    while (selected.length < limit && size > 0) {
        let best = 0;
        let best_value = Number.NEGATIVE_INFINITY;
        for (let position = 0; position < size; position++) {
            const index = pool[position];
            const value = lambda * (1 - index / count) - (1 - lambda) * redundancy[index];
            if (value > best_value || (value === best_value && index < pool[best])) {
                best_value = value;
                best = position;
            }
        }
        const picked = pool[best];
        selected.push(items[picked]);
        size--;
        pool[best] = pool[size];
        for (let position = 0; position < size; position++) {
            const candidate = pool[position];
            const similarity = options.similarity(items[candidate], items[picked]);
            if (similarity > redundancy[candidate]) redundancy[candidate] = similarity;
        }
    }
    return selected;
}
