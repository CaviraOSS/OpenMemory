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
 *  file  : src/core/math/surprise.ts
 *  usage : prediction surprise + novelty approximation
 */











import { clamp01, clamp_probability, safe_log } from './utility.js';

export function prediction_surprise(prob: number): number {
    return -safe_log(clamp_probability(prob));
}

function cosine(a: number[], b: number[]): number {
    if (a.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}


export function novelty_score(vector: number[], distribution: readonly number[][]): number {
    if (distribution.length === 0) return 1;
    let max_sim = 0;
    for (const ref of distribution) {
        const s = Math.max(0, cosine(vector, ref));
        if (s > max_sim) max_sim = s;
    }
    return clamp01(1 - max_sim);
}


export function novelty_surprise(vector: number[], distribution: readonly number[][]): number {
    const similarity = 1 - novelty_score(vector, distribution);
    return prediction_surprise(similarity);
}
