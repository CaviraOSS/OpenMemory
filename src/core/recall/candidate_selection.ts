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
 *  file  : src/core/recall/candidate_selection.ts
 *  usage : active-index candidate retrieval (never scans cold logs)
 */








import type { HydroNode } from '../types/hydro_node.js';
import { prepare_recall_node } from './recall_text.js';

export interface RecallIndex {

    active_nodes(world_ids: string[] | null): HydroNode[];

    readonly cold_scans: number;
}

export type recall_index_checkpoint = {
    readonly nodes: Map<string, HydroNode | undefined>;
};

export class InMemoryRecallIndex implements RecallIndex {
    private _cold_scans = 0;
    private readonly hot_by_id = new Map<string, HydroNode>();
    private readonly hot_by_world = new Map<string, Map<string, HydroNode>>();
    private readonly checkpoints = new Set<recall_index_checkpoint>();

    constructor(
        hot: HydroNode[],
        private readonly cold: HydroNode[] = [],
    ) {
        for (const node of hot) this.set_node(node);
    }

    active_nodes(world_ids: string[] | null): HydroNode[] {
        if (world_ids === null) return [...this.hot_by_id.values()];
        if (world_ids.length === 1) return [...(this.hot_by_world.get(world_ids[0])?.values() ?? [])];
        const set = new Set(world_ids);
        return [...this.hot_by_id.values()].filter((node) => set.has(node.world.world_id));
    }

    get cold_scans(): number {
        return this._cold_scans;
    }

    add(node: HydroNode): void {
        this.set_node(node);
    }

    snapshot(): HydroNode[] {
        return [...this.hot_by_id.values()];
    }

    checkpoint(): recall_index_checkpoint {
        const checkpoint = { nodes: new Map<string, HydroNode | undefined>() };
        this.checkpoints.add(checkpoint);
        return checkpoint;
    }

    commit(checkpoint: recall_index_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('InMemoryRecallIndex: unknown checkpoint');
    }

    rollback(checkpoint: recall_index_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('InMemoryRecallIndex: unknown checkpoint');
        for (const [id, node] of checkpoint.nodes) {
            this.delete_node(id);
            if (node) this.set_node(node);
        }
    }

    restore(snapshot: readonly HydroNode[]): void {
        this.hot_by_id.clear();
        this.hot_by_world.clear();
        for (const node of snapshot) this.set_node(node);
    }


    scan_cold(): HydroNode[] {
        this._cold_scans++;
        return [...this.cold];
    }

    private set_node(node: HydroNode): void {
        prepare_recall_node(node);
        const prior = this.hot_by_id.get(node.id);
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.nodes.has(node.id)) checkpoint.nodes.set(node.id, prior);
        }
        if (prior && prior.world.world_id !== node.world.world_id) {
            const prior_world = this.hot_by_world.get(prior.world.world_id);
            prior_world?.delete(node.id);
            if (prior_world?.size === 0) this.hot_by_world.delete(prior.world.world_id);
        }
        this.hot_by_id.set(node.id, node);
        let world = this.hot_by_world.get(node.world.world_id);
        if (!world) {
            world = new Map<string, HydroNode>();
            this.hot_by_world.set(node.world.world_id, world);
        }
        world.set(node.id, node);
    }

    private delete_node(id: string): void {
        const prior = this.hot_by_id.get(id);
        if (!prior) return;
        this.hot_by_id.delete(id);
        const world = this.hot_by_world.get(prior.world.world_id);
        world?.delete(id);
        if (world?.size === 0) this.hot_by_world.delete(prior.world.world_id);
    }
}
