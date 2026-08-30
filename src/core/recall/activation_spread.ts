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
 *  file  : src/core/recall/activation_spread.ts
 *  usage : implements the LongMemory activation spread component
 */

import type { HydroEdge } from '../types/hydro_edge.js';

export type ActivationSpreadOptions = {

    alpha?: number;

    max_hops?: number;

    min_activation?: number;

    bidirectional?: boolean;
    relation_weights?: Readonly<Record<string, number>>;
    max_entropy?: number;
};

export type SpreadResult = {

    activation: Map<string, number>;

    hops: number;

    visited: string[];

    frontier_by_hop: string[][];
    entropy: number;
    peak: number;
    bypassed: boolean;
};

const default_alpha = 0.8;
const default_max_hops = 2;
const default_min_activation = 1e-3;
const default_relation_weights: Readonly<Record<string, number>> = {
    refers_to: 1,
    supports: 0.9,
    derived_from: 0.75,
    same_as: 0.65,
    grounds: 0.55,
    supersedes: 0.35,
    contradicts: 0.25,
    semantic_shift: 0.2,
};

type Transition = { to: string; weight: number };


function build_transitions(
    edges: readonly HydroEdge[],
    bidirectional: boolean,
    relation_weights: Readonly<Record<string, number>>,
): Map<string, Transition[]> {
    const raw = new Map<string, Transition[]>();
    const push = (from: string, to: string, weight: number) => {
        if (weight <= 0 || from === to) return;
        const list = raw.get(from) ?? [];
        list.push({ to, weight });
        raw.set(from, list);
    };

    for (const edge of edges) {
        const relation = relation_weights[edge.type] ?? 0.2;
        const w = relation * Math.max(0, edge.weight) * Math.max(0, Math.min(1, edge.confidence));
        push(edge.from, edge.to, w);
        if (bidirectional) push(edge.to, edge.from, w);
    }

    const degree = new Map<string, number>();
    for (const [from, list] of raw) {
        degree.set(from, (degree.get(from) ?? 0) + list.reduce((sum, item) => sum + item.weight, 0));
        for (const item of list) degree.set(item.to, degree.get(item.to) ?? 0);
    }
    const normalized = new Map<string, Transition[]>();
    for (const [from, list] of raw) {
        const from_degree = degree.get(from) ?? 0;
        if (from_degree <= 0) continue;
        normalized.set(
            from,
            list.map((item) => ({
                to: item.to,
                weight: item.weight / Math.sqrt(from_degree * Math.max(epsilon, degree.get(item.to) ?? 0)),
            })),
        );
    }
    return normalized;
}

function build_legacy_transitions(edges: readonly HydroEdge[], bidirectional: boolean): Map<string, Transition[]> {
    const raw = new Map<string, Transition[]>();
    const push = (from: string, to: string, weight: number) => {
        if (weight <= 0 || from === to) return;
        const list = raw.get(from) ?? [];
        list.push({ to, weight });
        raw.set(from, list);
    };
    for (const edge of edges) {
        const weight = Math.max(0, edge.weight) * Math.max(0, Math.min(1, edge.confidence));
        push(edge.from, edge.to, weight);
        if (bidirectional) push(edge.to, edge.from, weight);
    }
    const normalized = new Map<string, Transition[]>();
    for (const [from, list] of raw) {
        const total = list.reduce((sum, item) => sum + item.weight, 0);
        if (total > 0) normalized.set(from, list.map((item) => ({ to: item.to, weight: item.weight / total })));
    }
    return normalized;
}

const epsilon = 1e-12;

function distribution(values: Iterable<number>): { entropy: number; peak: number } {
    const positive = [...values].filter((value) => value > 0 && Number.isFinite(value));
    const total = positive.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return { entropy: 0, peak: 0 };
    let entropy = 0;
    let peak = 0;
    for (const value of positive) {
        const probability = value / total;
        entropy -= probability * Math.log(probability);
        if (probability > peak) peak = probability;
    }
    return { entropy: positive.length > 1 ? entropy / Math.log(positive.length) : 0, peak };
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

    const transitions = build_transitions(edges, bidirectional, { ...default_relation_weights, ...options.relation_weights });
    const seed_ids = [...seeds.keys()];
    const { allowed, frontier_by_hop: frontier_by_hop } = bounded_neighbourhood(seed_ids, transitions, max_hops);

    const seed_total = [...seeds.values()].reduce((sum, value) => sum + Math.max(0, value), 0);
    const seed_of = (id: string) => seed_total > 0 ? Math.max(0, seeds.get(id) ?? 0) / seed_total : 0;
    let current = new Map<string, number>();
    for (const id of allowed) current.set(id, seed_of(id));
    const accumulated = new Map<string, number>();
    for (let hop = 0; hop <= max_hops; hop++) {
        for (const [id, value] of current) accumulated.set(id, (accumulated.get(id) ?? 0) + (1 - alpha) * value);
        if (hop === max_hops) break;
        const next = new Map<string, number>();
        for (const [from, act] of current) {
            if (act === 0) continue;
            for (const t of transitions.get(from) ?? []) {
                if (!allowed.has(t.to)) continue;
                next.set(t.to, (next.get(t.to) ?? 0) + alpha * t.weight * act);
            }
        }
        current = next;
    }

    const spread_distribution = distribution(accumulated.values());
    const max_entropy = options.max_entropy ?? 0.9;
    const bypassed = accumulated.size > Math.max(8, seeds.size * 4) && spread_distribution.entropy > max_entropy;
    const activation = new Map<string, number>();
    const maximum = Math.max(0, ...accumulated.values());
    if (!bypassed && maximum > 0) {
        for (const [id, value] of accumulated) {
            const normalized = value / maximum;
            if (normalized >= min_activation) activation.set(id, normalized);
        }
    }

    return {
        activation,
        hops: max_hops,
        visited: [...allowed],
        frontier_by_hop: frontier_by_hop,
        entropy: spread_distribution.entropy,
        peak: spread_distribution.peak,
        bypassed,
    };
}

export function legacy_spread_activation(
    seeds: ReadonlyMap<string, number>,
    edges: readonly HydroEdge[],
    options: ActivationSpreadOptions = {},
): SpreadResult {
    const alpha = options.alpha ?? default_alpha;
    const max_hops = Math.max(0, options.max_hops ?? default_max_hops);
    const min_activation = options.min_activation ?? default_min_activation;
    const bidirectional = options.bidirectional ?? true;
    const transitions = build_legacy_transitions(edges, bidirectional);
    const seed_ids = [...seeds.keys()];
    const { allowed, frontier_by_hop } = bounded_neighbourhood(seed_ids, transitions, max_hops);
    const seed_of = (id: string) => seeds.get(id) ?? 0;
    let current = new Map<string, number>();
    for (const id of allowed) current.set(id, seed_of(id));
    for (let hop = 0; hop < max_hops; hop++) {
        const incoming = new Map<string, number>();
        for (const [from, activation] of current) {
            if (activation === 0) continue;
            for (const transition of transitions.get(from) ?? []) {
                if (!allowed.has(transition.to)) continue;
                incoming.set(transition.to, (incoming.get(transition.to) ?? 0) + transition.weight * activation);
            }
        }
        const next = new Map<string, number>();
        for (const id of allowed) next.set(id, (1 - alpha) * seed_of(id) + alpha * (incoming.get(id) ?? 0));
        current = next;
    }
    const activation = new Map<string, number>();
    for (const [id, value] of current) if (value >= min_activation) activation.set(id, value);
    const summary = distribution(activation.values());
    return {
        activation,
        hops: max_hops,
        visited: [...allowed],
        frontier_by_hop,
        entropy: summary.entropy,
        peak: summary.peak,
        bypassed: false,
    };
}
