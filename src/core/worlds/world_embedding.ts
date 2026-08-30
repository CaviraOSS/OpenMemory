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
 *  file  : src/core/worlds/world_embedding.ts
 *  usage : implements the LongMemory world embedding component
 */

import type { WorldOntology } from '../types/world.js';

export function zeros(dim: number): number[] {
    return new Array<number>(dim).fill(0);
}

export function scale_add(acc: number[], v: number[], scale: number): void {
    const n = Math.min(acc.length, v.length);
    for (let i = 0; i < n; i++) acc[i] += v[i] * scale;
}

export function normalize_vector(v: number[]): number[] {
    let norm = 0;
    for (const x of v) norm += x * x;
    norm = Math.sqrt(norm);
    if (norm === 0) return v.slice();
    return v.map((x) => x / norm);
}

export function average_vectors(vectors: number[][], dim: number): number[] | null {
    if (vectors.length === 0) return null;
    const acc = zeros(dim);
    for (const v of vectors) scale_add(acc, v, 1);
    for (let i = 0; i < acc.length; i++) acc[i] /= vectors.length;
    return acc;
}

const token_re = /[a-z0-9]+/g;

function hash32(s: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}


export function text_to_vector(text: string, dim: number): number[] {
    const vec = zeros(dim);
    const tokens = (text || '').toLowerCase().match(token_re) ?? [];
    for (const tok of tokens) {
        const h = hash32(tok);
        const idx = h % dim;
        const sign = (h & 0x100) === 0 ? 1 : -1;
        vec[idx] += sign;
    }
    return normalize_vector(vec);
}


export function ontology_to_vector(ontology: WorldOntology, dim: number): number[] {
    const text = [...ontology.types, ...ontology.terms].join(' ');
    return text_to_vector(text, dim);
}
