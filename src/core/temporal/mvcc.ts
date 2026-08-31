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
 *  file  : src/core/temporal/mvcc.ts
 *  usage : implements the LongMemory mvcc component
 */


import { deep_freeze } from '../memory/durable_graph.js';
import type { HydroNode, NodeTemporal } from '../types/hydro_node.js';
import { is_current, is_recorded_at, is_valid_at } from './bitemporal.js';

function with_temporal(node: HydroNode, patch: Partial<NodeTemporal>): HydroNode {
    return deep_freeze({ ...node, temporal: { ...node.temporal, ...patch } });
}


export function close_validity(node: HydroNode, valid_to: number): HydroNode {
    return with_temporal(node, { valid_to });
}


export function close_transaction(node: HydroNode, superseded_at: number): HydroNode {
    return with_temporal(node, { superseded_at });
}

export type Supersession = {
    
    superseded: HydroNode;
    
    current: HydroNode;
};





export function supersede_node(
    old_node: HydroNode,
    new_node: HydroNode,
    now: number,
): Supersession {
    const closed_validity =
        old_node.temporal.valid_to === null || old_node.temporal.valid_to > now
            ? close_validity(old_node, now)
            : old_node;
    const superseded = close_transaction(closed_validity, now);
    return { superseded, current: new_node };
}


export function query_current_truth(candidates: readonly HydroNode[], now: number): HydroNode[] {
    return candidates.filter((n) => is_current(n, now));
}


export function query_history(candidates: readonly HydroNode[], valid_time: number): HydroNode[] {
    return candidates.filter((n) => is_valid_at(n, valid_time));
}


export function query_belief_as_of(
    candidates: readonly HydroNode[],
    recorded_time: number,
): HydroNode[] {
    return candidates.filter((n) => is_recorded_at(n, recorded_time));
}


export function query_bitemporal(
    candidates: readonly HydroNode[],
    valid_time: number,
    recorded_time: number,
): HydroNode[] {
    return candidates.filter((n) => is_valid_at(n, valid_time) && is_recorded_at(n, recorded_time));
}
