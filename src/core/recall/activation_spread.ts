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
 *  file  : src/core/recall/activation_spread.ts
 *  usage : controlled, bounded spreading activation over the graph
 */













import type { HydroEdge } from '../types/hydro_edge.js';

export type ActivationSpreadOptions = {
    
    alpha?: number;
    
    max_hops?: number;
    
    min_activation?: number;
    
    bidirectional?: boolean;
};

export type SpreadResult = {
    
    activation: Map<string, number>;
    
    hops: number;
    
    visited: string[];
    
    frontier_by_hop: string[][];
};

const default_alpha = 0.8;
const default_max_hops = 2;
const default_min_activation = 1e-3;

type Transition = { to: string; weight: number };


function build_transitions(edges: readonly HydroEdge[], bidirectional: boolean): Map<string, Transition[]> {
    const raw = new Map<string, Transition[]>();
    const push = (from: string, to: string, weight: number) => {
        if (weight <= 0 || from === to) return;
        const list = raw.get(from) ?? [];
        list.push({ to, weight });
        raw.set(from, list);
    };

    for (const edge of edges) {
        const w = Math.max(0, edge.weight) * Math.max(0, Math.min(1, edge.confidence));
        push(edge.from, edge.to, w);
        if (bidirectional) push(edge.to, edge.from, w);
    }

    
    const normalized = new Map<string, Transition[]>();
    for (const [from, list] of raw) {
        const total = list.reduce((s, t) => s + t.weight, 0);
        if (total <= 0) continue;
        normalized.set(
            from,
            list.map((t) => ({ to: t.to, weight: t.weight / total })),
        );
    }
    return normalized;
}


function bounded_neighbourhood(
    seeds: readonly string[],
    transitions: Map<string, Transition[]>,
    max_hops: number,
): { allowed: Set<string>; frontier_by_hop: string[][] } {
    const allowed = new Set<string>(seeds);
    const frontier_by_hop: string[][] = [[...seeds]];
    let frontier = [...seeds];

    for (let hop = 1; hop <= max_hops; hop++) {
        const next: string[] = [];
        for (const node of frontier) {
            for (const t of transitions.get(node) ?? []) {
                if (!allowed.has(t.to)) {
                    allowed.add(t.to);
                    next.push(t.to);
                }
            }
        }
        frontier_by_hop.push(next);
        if (next.length === 0) break;
        frontier = next;
    }

    return { allowed, frontier_by_hop: frontier_by_hop };
}







export function spread_activation(
    seeds: ReadonlyMap<string, number>,
    edges: readonly HydroEdge[],
    options: ActivationSpreadOptions = {},
): SpreadResult {
    const alpha = options.alpha ?? default_alpha;
    const max_hops = Math.max(0, options.max_hops ?? default_max_hops);
    const min_activation = options.min_activation ?? default_min_activation;
    const bidirectional = options.bidirectional ?? true;

    const transitions = build_transitions(edges, bidirectional);
    const seed_ids = [...seeds.keys()];
    const { allowed, frontier_by_hop: frontier_by_hop } = bounded_neighbourhood(seed_ids, transitions, max_hops);

    const seed_of = (id: string) => seeds.get(id) ?? 0;
    let current = new Map<string, number>();
    for (const id of allowed) current.set(id, seed_of(id));

    for (let hop = 0; hop < max_hops; hop++) {
        const next = new Map<string, number>();
        
        const incoming = new Map<string, number>();
        for (const [from, act] of current) {
            if (act === 0) continue;
            for (const t of transitions.get(from) ?? []) {
                if (!allowed.has(t.to)) continue;
                incoming.set(t.to, (incoming.get(t.to) ?? 0) + t.weight * act);
            }
        }
        for (const id of allowed) {
            const value = (1 - alpha) * seed_of(id) + alpha * (incoming.get(id) ?? 0);
            next.set(id, value);
        }
        current = next;
    }

    const activation = new Map<string, number>();
    for (const [id, value] of current) {
        if (value >= min_activation) activation.set(id, value);
    }

    return {
        activation,
        hops: max_hops,
        visited: [...allowed],
        frontier_by_hop: frontier_by_hop,
    };
}
