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
 *  file  : src/core/grounding/resonance.ts
 *  usage : resonance between a subjective memory and an external fact
 */














export type ResonanceParts = {
    semantic_similarity: number;
    grounding_score: number;
    temporal_overlap: number;
    relation_weight: number;
};

function clamp01(x: number): number {
    return Math.min(1, Math.max(0, x));
}


export function cosine_similarity(a: number[] | null, b: number[] | null): number {
    if (!a || !b || a.length === 0 || a.length !== b.length) return 0.5;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0.5;
    return clamp01(dot / (Math.sqrt(na) * Math.sqrt(nb)));
}


export function temporal_overlap(
    a_from: number,
    a_to: number | null,
    b_from: number,
    b_to: number | null,
): number {
    const a_end = a_to ?? Number.POSITIVE_INFINITY;
    const b_end = b_to ?? Number.POSITIVE_INFINITY;
    const start = Math.max(a_from, b_from);
    const end = Math.min(a_end, b_end);
    if (end <= start) return 0;
    if (!Number.isFinite(a_end) || !Number.isFinite(b_end)) return 1;
    const overlap = end - start;
    const span = Math.min(a_end - a_from, b_end - b_from);
    return span <= 0 ? 0 : clamp01(overlap / span);
}

export function compute_resonance(parts: ResonanceParts): number {
    return (
        clamp01(parts.semantic_similarity) *
        clamp01(parts.grounding_score) *
        clamp01(parts.temporal_overlap) *
        clamp01(parts.relation_weight)
    );
}
