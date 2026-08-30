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
 *  file  : src/core/engine/ingest_transaction.ts
 *  usage : implements the LongMemory ingest transaction component
 */

import { InMemoryWorldDB } from '../grounding/worlddb_adapter.js';
import { MemorySketches } from '../math/sketches.js';
import { DurableGraph } from '../memory/durable_graph.js';
import { WorkingMemory } from '../memory/working_memory.js';
import { InMemoryRecallIndex } from '../recall/candidate_selection.js';
import { EntityResolver } from '../resolver/entity_resolver.js';
import { WorldGraph } from '../worlds/recursive_world.js';

export type IngestTransactionStores = {
    graph: DurableGraph;
    resolver: EntityResolver;
    worlds: WorldGraph;
    worlddb: InMemoryWorldDB;
    index: InMemoryRecallIndex;
    sketches: MemorySketches;
    working: WorkingMemory;
};

export type IngestTransactionOptions = {
    snapshot_sketches?: boolean;
    incremental?: boolean;
};

export class IngestTransactionError extends Error {
    readonly rolled_back = true;

    constructor(readonly cause: unknown) {
        super(`ingest transaction rolled back: ${cause instanceof Error ? cause.message : String(cause)}`);
        this.name = 'IngestTransactionError';
    }
}

export class IngestTransaction {
    constructor(private readonly stores: IngestTransactionStores, private readonly options: IngestTransactionOptions = {}) { }

    run<T>(operation: () => T): T {
        if (this.options.incremental) return this.run_incremental(operation);
        const snapshots = {
            graph: this.stores.graph.snapshot(),
            resolver: this.stores.resolver.snapshot(),
            worlds: this.stores.worlds.snapshot(),
            worlddb: this.stores.worlddb.snapshot(),
            index: this.stores.index.snapshot(),
            sketches: this.options.snapshot_sketches === false ? null : this.stores.sketches.serialize(),
            working: this.stores.working.checkpoint(),
        };
        try {
            return operation();
        } catch (error) {
            this.stores.graph.restore(snapshots.graph);
            this.stores.resolver.restore(snapshots.resolver);
            this.stores.worlds.restore(snapshots.worlds);
            this.stores.worlddb.restore(snapshots.worlddb);
            this.stores.index.restore(snapshots.index);
            if (snapshots.sketches !== null) this.stores.sketches.restore(snapshots.sketches);
            this.stores.working.rollback(snapshots.working);
            throw new IngestTransactionError(error);
        }
    }

    private run_incremental<T>(operation: () => T): T {
        const checkpoints = {
            graph: this.stores.graph.checkpoint(),
            worlds: this.stores.worlds.checkpoint(),
            index: this.stores.index.checkpoint(),
            resolver: this.stores.resolver.checkpoint(),
            worlddb: this.stores.worlddb.checkpoint(),
            working: this.stores.working.checkpoint(),
        };
        try {
            const result = operation();
            this.stores.graph.commit(checkpoints.graph);
            this.stores.worlds.commit(checkpoints.worlds);
            this.stores.index.commit(checkpoints.index);
            this.stores.resolver.commit(checkpoints.resolver);
            this.stores.worlddb.commit(checkpoints.worlddb);
            return result;
        } catch (error) {
            this.stores.graph.rollback(checkpoints.graph);
            this.stores.worlds.rollback(checkpoints.worlds);
            this.stores.index.rollback(checkpoints.index);
            this.stores.resolver.rollback(checkpoints.resolver);
            this.stores.worlddb.rollback(checkpoints.worlddb);
            this.stores.working.rollback(checkpoints.working);
            throw new IngestTransactionError(error);
        }
    }
}