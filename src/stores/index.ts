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
 *  file  : src/stores/index.ts
 *  usage : implements the LongMemory index component
 */


import type { EdgeExecutionResult } from '../core/edges/edge_context.js';
import type { EdgeRegistry } from '../core/edges/edge_registry.js';
import type { IngestResult } from '../core/engine/ingest_engine.js';
import type { MemorySketches } from '../core/math/sketches.js';
import type { HydroEdge } from '../core/types/hydro_edge.js';
import type { HydroNode } from '../core/types/hydro_node.js';
import type { IntegrityReport } from './sqlite/integrity.js';
import type { NodeQueryOptions, StrictQueryOptions } from './sqlite/queries.js';

export type StoreKind = 'sqlite';

export type memory_maintenance_event = {
    kind: 'decay' | 'reinforce';
    at: number;
    node_ids: string[];
    details?: Record<string, unknown>;
};

export interface MemoryStore {
    readonly kind: StoreKind;
    transaction<T>(operation: () => T): T;
    save_node(node: HydroNode): void;
    load_node(node_id: string): HydroNode | null;
    load_edge(edge_id: string): HydroEdge | null;
    save_batch(nodes: readonly HydroNode[], edges?: readonly HydroEdge[]): void;
    persist_maintenance(nodes: readonly HydroNode[], event: memory_maintenance_event): void;
    persist_ingest(result: IngestResult): void;
    execute_edge_transaction(edge: HydroEdge, registry?: EdgeRegistry): EdgeExecutionResult;
    query_current_truth(options: NodeQueryOptions): HydroNode[];
    query_historical_truth(options: NodeQueryOptions): HydroNode[];
    query_strict_candidates(options: StrictQueryOptions): HydroNode[];
    save_sketch_state(key: string, sketches: MemorySketches, at?: number): void;
    load_sketch_state(key: string): MemorySketches | null;
    check_integrity(): IntegrityReport;
    close(): void;
}

export function stores_ready(): true {
    return true;
}

export * from './sqlite/index.js';
