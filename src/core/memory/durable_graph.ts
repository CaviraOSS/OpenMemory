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
 *  file  : src/core/memory/durable_graph.ts
 *  usage : implements the LongMemory durable graph component
 */

import {
    default_edge_hash_policy,
    default_node_hash_policy,
    hash_edge,
    hash_node,
    verify_node_hash,
    type EdgeHashPolicy,
    type NodeHashPolicy,
} from '../hash/content_hash.js';
import { hash_merkle_children } from '../hash/merkle.js';
import type { HydroEdge, HydroEdgeInput } from '../types/hydro_edge.js';
import type { HydroNode, HydroNodeInput } from '../types/hydro_node.js';

export type DurableGraphSnapshot = {
    nodes: Map<string, HydroNode>;
    edges: Map<string, HydroEdge>;
};

export type durable_graph_checkpoint = {
    readonly nodes: Map<string, HydroNode | undefined>;
    readonly edges: Map<string, HydroEdge | undefined>;
    readonly revision: number;
};


export function deep_freeze<T>(value: T): T {
    if (value === null || typeof value !== 'object') return value;
    if (Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
        deep_freeze((value as Record<string, unknown>)[key]);
    }
    return value;
}


export function create_hydro_node(
    input: HydroNodeInput,
    policy: NodeHashPolicy = default_node_hash_policy,
): HydroNode {
    const normalized = { ...input, metadata: input.metadata ?? {} };
    const draft: HydroNode = { ...normalized, id: input.id ?? '', content_hash: '' };
    const content_hash = hash_node(draft, policy);
    const node: HydroNode = {
        ...normalized,
        content_hash,
        id: input.id ?? `node:${content_hash}`,
    };
    return deep_freeze(node);
}

/** Build a durable, frozen edge with a computed id from its identity hash. */
export function create_hydro_edge(
    input: HydroEdgeInput,
    policy: EdgeHashPolicy = default_edge_hash_policy,
): HydroEdge {
    const draft: HydroEdge = { ...input, id: input.id ?? '' };
    const edge_hash = hash_edge(draft, policy);
    const edge: HydroEdge = { ...input, id: input.id ?? `edge:${edge_hash}` };
    return deep_freeze(edge);
}

export class DurableGraph {
    private readonly nodes = new Map<string, HydroNode>();
    private readonly edges = new Map<string, HydroEdge>();
    private readonly checkpoints = new Set<durable_graph_checkpoint>();
    private _revision = 0;

    constructor(private readonly node_policy: NodeHashPolicy = default_node_hash_policy) { }

    /**
     * Insert a durable node. Idempotent for identical content (dedupe); throws
     * when a different node claims an existing id (no silent rewrite).
     */
    add_node(node: HydroNode): HydroNode {
        if (!verify_node_hash(node, this.node_policy)) {
            throw new Error(`addNode: content hash does not verify for ${node.id}`);
        }
        const existing = this.nodes.get(node.id);
        if (existing) {
            if (existing.content_hash !== node.content_hash) {
                throw new Error(`addNode: refusing to overwrite immutable node ${node.id}`);
            }
            return existing;
        }
        const frozen = deep_freeze(node);
        this.track_node(frozen.id);
        this.nodes.set(frozen.id, frozen);
        this._revision++;
        return frozen;
    }

    /** Commit a new mutable-envelope version without changing durable identity. */
    apply_node_version(node: HydroNode): HydroNode {
        if (!verify_node_hash(node, this.node_policy)) {
            throw new Error(`applyNodeVersion: content hash does not verify for ${node.id}`);
        }
        const existing = this.nodes.get(node.id);
        if (existing && existing.content_hash !== node.content_hash) {
            throw new Error(`applyNodeVersion: refusing identity change for ${node.id}`);
        }
        const frozen = deep_freeze(node);
        this.track_node(frozen.id);
        this.nodes.set(frozen.id, frozen);
        this._revision++;
        return frozen;
    }

    add_edge(edge: HydroEdge): HydroEdge {
        const existing = this.edges.get(edge.id);
        if (existing) {
            if (existing.from !== edge.from || existing.to !== edge.to || existing.type !== edge.type) {
                throw new Error(`addEdge: refusing to overwrite immutable edge ${edge.id}`);
            }
            return existing;
        }
        const frozen = deep_freeze(edge);
        this.track_edge(frozen.id);
        this.edges.set(frozen.id, frozen);
        this._revision++;
        return frozen;
    }

    get_node(id: string): HydroNode | undefined {
        return this.nodes.get(id);
    }

    has_node(id: string): boolean {
        return this.nodes.has(id);
    }

    get_edge(id: string): HydroEdge | undefined {
        return this.edges.get(id);
    }

    node_count(): number {
        return this.nodes.size;
    }

    edge_count(): number {
        return this.edges.size;
    }

    get revision(): number {
        return this._revision;
    }

    node_list(): HydroNode[] {
        return [...this.nodes.values()];
    }

    edge_list(): HydroEdge[] {
        return [...this.edges.values()];
    }

    snapshot(): DurableGraphSnapshot {
        return { nodes: new Map(this.nodes), edges: new Map(this.edges) };
    }

    checkpoint(): durable_graph_checkpoint {
        const checkpoint = { nodes: new Map(), edges: new Map(), revision: this._revision };
        this.checkpoints.add(checkpoint);
        return checkpoint;
    }

    commit(checkpoint: durable_graph_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('DurableGraph: unknown checkpoint');
    }

    rollback(checkpoint: durable_graph_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('DurableGraph: unknown checkpoint');
        for (const [id, node] of checkpoint.nodes) {
            if (node === undefined) this.nodes.delete(id);
            else this.nodes.set(id, node);
        }
        for (const [id, edge] of checkpoint.edges) {
            if (edge === undefined) this.edges.delete(id);
            else this.edges.set(id, edge);
        }
        this._revision++;
    }

    restore(snapshot: DurableGraphSnapshot): void {
        this.nodes.clear();
        this.edges.clear();
        for (const [id, node] of snapshot.nodes) this.nodes.set(id, node);
        for (const [id, edge] of snapshot.edges) this.edges.set(id, edge);
        this._revision++;
    }

    private track_node(id: string): void {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.nodes.has(id)) checkpoint.nodes.set(id, this.nodes.get(id));
        }
    }

    private track_edge(id: string): void {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.edges.has(id)) checkpoint.edges.set(id, this.edges.get(id));
        }
    }

    /** Deterministic, sorted list of node content hashes. */
    node_hashes(): string[] {
        return [...this.nodes.values()].map((n) => n.content_hash).sort();
    }

    /** Single Merkle integrity root over all durable node hashes. */
    merkle_root(): string {
        return hash_merkle_children(this.node_hashes());
    }

    /** Verify every node still matches its content hash. */
    verify_integrity(): boolean {
        for (const node of this.nodes.values()) {
            if (!verify_node_hash(node, this.node_policy)) return false;
        }
        return true;
    }
}
