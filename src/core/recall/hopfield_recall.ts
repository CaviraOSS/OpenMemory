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
 *  file  : src/core/recall/hopfield_recall.ts
 *  usage : modern-hopfield associative pattern retrieval (associative mode only)
 */













export type HopfieldMemory = {
    id: string;
    
    key: number[];
    
    value: number[];
};

export type HopfieldWeight = {
    id: string;
    
    weight: number;
};

export type HopfieldResult = {
    
    retrieved: number[];
    
    weights: HopfieldWeight[];
    
    best: HopfieldWeight | null;
};

const default_beta = 8;

function dot(a: number[], b: number[]): number {
    const n = Math.min(a.length, b.length);
    let s = 0;
    for (let i = 0; i < n; i++) s += a[i] * b[i];
    return s;
}

function softmax(scores: number[]): number[] {
    if (scores.length === 0) return [];
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const total = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map((e) => e / total);
}








export function hopfield_recall(
    query: number[],
    memories: readonly HopfieldMemory[],
    beta: number = default_beta,
): HopfieldResult {
    if (memories.length === 0) {
        return { retrieved: [], weights: [], best: null };
    }

    const scores = memories.map((m) => beta * dot(m.key, query));
    const attention = softmax(scores);

    const dim = memories[0].value.length;
    const retrieved = new Array<number>(dim).fill(0);
    for (let i = 0; i < memories.length; i++) {
        const v = memories[i].value;
        const w = attention[i];
        for (let d = 0; d < dim; d++) retrieved[d] += w * (v[d] ?? 0);
    }

    const weights: HopfieldWeight[] = memories.map((m, i) => ({ id: m.id, weight: attention[i] }));
    let best = weights[0];
    for (const w of weights) if (w.weight > best.weight) best = w;

    return { retrieved, weights, best };
}
