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
 *  file  : src/core/resolver/entity_score.ts
 *  usage : implements the LongMemory entity score component
 */

import { entity_context, type Entity, type EntityMention } from '../types/entity.js';

const day_ms = 86_400_000;

export type ScoreWeights = {
    name: number;
    vector: number;
    context: number;
    temporal: number;
    conflict: number;
};

export const default_score_weights: ScoreWeights = {
    name: 0.4,
    vector: 0.3,
    context: 0.2,
    temporal: 0.1,
    conflict: 0.5,
};

export type ResolverThresholds = {
    merge: number;
    candidate: number;
};

export const default_thresholds: ResolverThresholds = {
    merge: 0.82,
    candidate: 0.55,
};

export type ScoreBreakdown = {
    score: number;
    name: number;
    vector: number;
    context: number;
    temporal: number;
    conflict: number;
};

function clamp01(x: number): number {
    return Math.min(1, Math.max(0, x));
}

export function normalize_name(s: string): string {
    return s
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Mark}\p{Number}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function bigrams(s: string): Map<string, number> {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
        const g = s.slice(i, i + 2);
        out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
}

function dice_coefficient(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const ga = bigrams(a);
    const gb = bigrams(b);
    let overlap = 0;
    let total_a = 0;
    for (const v of ga.values()) total_a += v;
    let total_b = 0;
    for (const [g, v] of gb) {
        total_b += v;
        const av = ga.get(g);
        if (av) overlap += Math.min(av, v);
    }
    return (2 * overlap) / (total_a + total_b);
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const union = a.size + b.size - inter;
    return union === 0 ? 0 : inter / union;
}

export function name_similarity(a: string, b: string): number {
    const na = normalize_name(a);
    const nb = normalize_name(b);
    if (na === nb) return 1;
    const dice = dice_coefficient(na.replace(/ /g, ''), nb.replace(/ /g, ''));
    const token_jac = jaccard(new Set(na.split(' ')), new Set(nb.split(' ')));
    return clamp01(0.5 * dice + 0.5 * token_jac);
}

export function vector_similarity(a: number[] | null | undefined, b: number[] | null | undefined): number {
    if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (na === 0 || nb === 0) return 0;
    const cos = dot / (Math.sqrt(na) * Math.sqrt(nb));
    return clamp01(cos);
}

export function context_overlap(a: string[] | undefined, b: string[] | undefined): number {
    const sa = new Set((a ?? []).map((t) => t.toLowerCase()));
    const sb = new Set((b ?? []).map((t) => t.toLowerCase()));
    return jaccard(sa, sb);
}

export function temporal_compatibility(a: number | undefined, b: number | undefined): number {
    if (a === undefined || b === undefined) return 0.5;
    const days = Math.abs(a - b) / day_ms;
    return clamp01(Math.exp(-days / 90));
}

function meta_value(meta: Record<string, unknown> | undefined, key: string): string | undefined {
    const v = meta?.[key];
    return typeof v === 'string' ? v : undefined;
}


export function conflict_penalty(mention: EntityMention, entity: Entity): number {
    if (mention.type && entity.type !== 'unknown' && mention.type !== entity.type) return 1;

    for (const key of ['domain', 'disambiguator']) {
        const m = meta_value(mention.metadata, key);
        const e = meta_value(entity.metadata, key);
        if (m && e && m !== e) return 1;
    }

    
    if (mention.context && mention.context.length > 0) {
        const overlap = context_overlap(mention.context, entity_context(entity));
        if (overlap === 0) return 0.3;
    }
    return 0;
}

export function score_entity_match(
    mention: EntityMention,
    entity: Entity,
    weights: ScoreWeights = default_score_weights,
): ScoreBreakdown {
    const name = name_similarity(mention.name, entity.canonical_name);
    const vector = vector_similarity(mention.vector ?? null, entity.vector);
    const context = context_overlap(mention.context, entity_context(entity));
    const temporal = temporal_compatibility(mention.observed_at, entity.updated_at);
    const conflict = conflict_penalty(mention, entity);

    const score =
        weights.name * name +
        weights.vector * vector +
        weights.context * context +
        weights.temporal * temporal -
        weights.conflict * conflict;

    return { score, name, vector, context, temporal, conflict };
}
