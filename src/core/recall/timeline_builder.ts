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
 *  file  : src/core/recall/timeline_builder.ts
 *  usage : implements the LongMemory timeline builder component
 */


import { is_current, is_recorded_at, is_valid_at } from '../temporal/bitemporal.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type { HydroNode } from '../types/hydro_node.js';
import type { NodeStatus } from '../types/node_state.js';

export type TimelineEntry = {
    id: string;
    node: HydroNode;
    valid_from: number;
    valid_to: number | null;
    observed_at: number;
    recorded_at: number;
    superseded_at: number | null;
    status: NodeStatus;
    is_current: boolean;
    valid_at_query: boolean;
    believed_at_query: boolean;
};

export type SupersessionChain = {
    
    ordered: string[];
};

export type Timeline = {
    entries: TimelineEntry[];
    chains: SupersessionChain[];
    
    world_truth_at_time: HydroNode[];
    
    agent_belief_at_time: HydroNode[];
    
    current_truth: HydroNode[];
};

export type TimelineOptions = {
    now: number;
    valid_time?: number;
    recorded_time?: number;
};


export function build_supersession_chains(
    nodes: readonly HydroNode[],
    edges: readonly HydroEdge[],
): SupersessionChain[] {
    const ids = new Set(nodes.map((n) => n.id));
    const successor = new Map<string, string>();
    const predecessor = new Map<string, string>();

    for (const edge of edges) {
        if (edge.type !== 'supersedes') continue;
        
        const old_id = edge.to;
        const new_id = edge.from;
        successor.set(old_id, new_id);
        predecessor.set(new_id, old_id);
    }

    const chains: SupersessionChain[] = [];
    const visited = new Set<string>();

    for (const node of nodes) {
        const start = node.id;
        if (visited.has(start)) continue;
        const pred = predecessor.get(start);
        if (pred && ids.has(pred)) continue; 

        const ordered: string[] = [];
        let current: string | undefined = start;
        while (current && ids.has(current) && !visited.has(current)) {
            ordered.push(current);
            visited.add(current);
            current = successor.get(current);
        }
        if (ordered.length >= 2) chains.push({ ordered });
    }

    return chains;
}

export function build_timeline(
    nodes: readonly HydroNode[],
    edges: readonly HydroEdge[],
    opts: TimelineOptions,
): Timeline {
    const entries: TimelineEntry[] = nodes.map((node) => {
        const t = node.temporal;
        return {
            id: node.id,
            node,
            valid_from: t.valid_from,
            valid_to: t.valid_to,
            observed_at: t.observed_at,
            recorded_at: t.recorded_at,
            superseded_at: t.superseded_at,
            status: node.state.status,
            is_current: is_current(node, opts.now),
            valid_at_query: opts.valid_time !== undefined ? is_valid_at(node, opts.valid_time) : false,
            believed_at_query:
                opts.recorded_time !== undefined ? is_recorded_at(node, opts.recorded_time) : false,
        };
    });

    entries.sort((a, b) => a.valid_from - b.valid_from || a.recorded_at - b.recorded_at);

    return {
        entries,
        chains: build_supersession_chains(nodes, edges),
        world_truth_at_time:
            opts.valid_time !== undefined
                ? nodes.filter((n) => is_valid_at(n, opts.valid_time as number))
                : [],
        agent_belief_at_time:
            opts.recorded_time !== undefined
                ? nodes.filter((n) => is_recorded_at(n, opts.recorded_time as number))
                : [],
        current_truth: nodes.filter((n) => is_current(n, opts.now)),
    };
}
