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
 *  file  : src/core/recall/contract_gate.ts
 *  usage : implements the LongMemory contract gate component
 */


import type { HydroNode } from '../types/hydro_node.js';
import type { GateContext, GateResult, RecallMode } from '../types/recall_mode.js';
import {
    can_use_in_associative_recall,
    can_use_in_historical_recall,
    can_use_in_strict_recall,
    can_use_in_world_grounded_recall,
} from './mode_gates.js';

export function apply_contract_gate(node: HydroNode, mode: RecallMode, ctx: GateContext): GateResult {
    switch (mode) {
        case 'strict':
            return can_use_in_strict_recall(node, ctx);
        case 'historical':
            return can_use_in_historical_recall(node, ctx);
        case 'associative':
            return can_use_in_associative_recall(node, ctx);
        case 'world_grounded':
            return can_use_in_world_grounded_recall(node, ctx);
        default:
            return { allowed: false, mode, label: 'active', reasons: [`unknown recall mode: ${mode}`] };
    }
}

/** Filter a set of nodes to those admitted for a mode, with their labels. */
export function gate_nodes(
    nodes: readonly HydroNode[],
    mode: RecallMode,
    ctx: GateContext,
): Array<{ node: HydroNode; result: GateResult }> {
    const out: Array<{ node: HydroNode; result: GateResult }> = [];
    for (const node of nodes) {
        const result = apply_contract_gate(node, mode, ctx);
        if (result.allowed) out.push({ node, result });
    }
    return out;
}
