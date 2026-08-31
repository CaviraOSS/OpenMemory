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
 *  file  : src/core/edges/edge_runtime.ts
 *  usage : implements the LongMemory edge runtime component
 */


import type { HydroEdge } from '../types/hydro_edge.js';
import type { EdgeContext, EdgeExecutionResult } from './edge_context.js';
import { default_edge_registry, EdgeRegistry } from './edge_registry.js';

export function validate_edge(edge: HydroEdge): void {
    if (!edge.id) throw new Error('insertEdge: edge is missing an id');
    if (!edge.from || !edge.to) throw new Error(`insertEdge: edge ${edge.id} needs both from and to`);
    if (!edge.type) throw new Error(`insertEdge: edge ${edge.id} is missing a type`);
    if (edge.confidence < 0 || edge.confidence > 1) {
        throw new Error(`insertEdge: edge ${edge.id} confidence out of range: ${edge.confidence}`);
    }
    if (edge.weight < 0) {
        throw new Error(`insertEdge: edge ${edge.id} weight must be >= 0: ${edge.weight}`);
    }
}

export function insert_edge(
    edge: HydroEdge,
    ctx: EdgeContext,
    registry: EdgeRegistry = default_edge_registry(),
): EdgeExecutionResult {
    // 1. validate edge
    validate_edge(edge);

    // 2. find handler
    const handler = registry.get(edge.type);
    if (!handler) {
        throw new Error(
            `insertEdge: unknown edge type "${edge.type}". Known types: ${registry.types().sort().join(', ')}`,
        );
    }

    // 3. run handler atomically (snapshot -> run -> rollback on failure)
    const snap = ctx.snapshot();
    try {
        const outcome = handler.run(edge, ctx);
        // 4/5. update audit trail on success
        const audit = ctx.write_audit(edge, outcome.affected_node_ids, outcome.notes.join('; '));
        // 6. return result
        return {
            ok: true,
            edge,
            affected_node_ids: outcome.affected_node_ids,
            audit,
            notes: outcome.notes,
        };
    } catch (err) {
        ctx.restore(snap);
        throw err instanceof Error ? err : new Error(String(err));
    }
}
