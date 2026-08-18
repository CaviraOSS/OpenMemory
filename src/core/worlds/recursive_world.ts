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
 *  file  : src/core/worlds/recursive_world.ts
 *  usage : the recursive world graph (create/move/query/hash)
 */










import { hash_canonical } from '../hash/content_hash.js';
import type { Contract } from '../types/contract.js';
import {
    empty_ontology,
    type World,
    type WorldInput,
    type WorldPlacement,
} from '../types/world.js';
import { compose_world_embedding, type WorldEmbeddingWeights } from './world_composer.js';
import { resolve_world_contracts } from './world_contracts.js';

function slug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

const digest_modulus = 1n << 256n;

class incremental_set_digest {
    private readonly values = new Map<string, bigint>();
    private sum = 0n;
    private xor = 0n;

    constructor(values: readonly string[] = []) {
        for (const value of values) this.add(value);
    }

    add(value: string): boolean {
        if (this.values.has(value)) return false;
        const hashed = BigInt(`0x${hash_canonical(['world-reference', value])}`);
        this.values.set(value, hashed);
        this.sum = (this.sum + hashed) % digest_modulus;
        this.xor ^= hashed;
        return true;
    }

    delete(value: string): boolean {
        const hashed = this.values.get(value);
        if (hashed === undefined) return false;
        this.values.delete(value);
        this.sum = (this.sum - hashed + digest_modulus) % digest_modulus;
        this.xor ^= hashed;
        return true;
    }

    digest(): string {
        return hash_canonical({
            count: this.values.size,
            sum: this.sum.toString(16).padStart(64, '0'),
            xor: this.xor.toString(16).padStart(64, '0'),
        });
    }
}

class incremental_map_digest {
    private readonly values = new Map<string, { value: string; hashed: bigint }>();
    private sum = 0n;
    private xor = 0n;

    set(key: string, value: string): boolean {
        const current = this.values.get(key);
        if (current?.value === value) return false;
        if (current) {
            this.sum = (this.sum - current.hashed + digest_modulus) % digest_modulus;
            this.xor ^= current.hashed;
        }
        const hashed = BigInt(`0x${hash_canonical(['world-child', key, value])}`);
        this.values.set(key, { value, hashed });
        this.sum = (this.sum + hashed) % digest_modulus;
        this.xor ^= hashed;
        return true;
    }

    digest(): string {
        return hash_canonical({
            count: this.values.size,
            sum: this.sum.toString(16).padStart(64, '0'),
            xor: this.xor.toString(16).padStart(64, '0'),
        });
    }
}

export type WorldGraphOptions = {
    now?: number;

    dim?: number;

    node_vector?: (node_id: string) => number[] | null;
    embedding_weights?: WorldEmbeddingWeights;
};

export type WorldGraphSnapshot = {
    worlds: Map<string, World>;
    primary_world_of: Map<string, string>;
    placement_history: WorldPlacement[];
};

export type world_graph_checkpoint = {
    readonly worlds: Map<string, World | undefined>;
    readonly primary_worlds: Map<string, string | undefined>;
    readonly placement_history_length: number;
};

export class WorldGraph {
    private worlds = new Map<string, World>();
    private readonly world_ids_by_name = new Map<string, string>();
    private primary_worlds = new Map<string, string>();
    private placement_history: WorldPlacement[] = [];
    private readonly node_digests = new Map<string, incremental_set_digest>();
    private readonly edge_digests = new Map<string, incremental_set_digest>();
    private readonly child_digests = new Map<string, incremental_map_digest>();
    private readonly checkpoints = new Set<world_graph_checkpoint>();

    readonly now: number;
    readonly dim: number;
    private readonly node_vector: (node_id: string) => number[] | null;
    private readonly embedding_weights?: WorldEmbeddingWeights;

    constructor(options: WorldGraphOptions = {}) {
        this.now = options.now ?? Date.now();
        this.dim = options.dim ?? 8;
        this.node_vector = options.node_vector ?? (() => null);
        this.embedding_weights = options.embedding_weights;
    }



    create_world(input: WorldInput, options: { defer_hash?: boolean } = {}): World {
        const at = input.at ?? this.now;
        const world: World = {
            id: `world:${hash_canonical([slug(input.name), input.parent_world_id ?? null, at]).slice(0, 16)}`,
            name: input.name,
            parent_world_id: input.parent_world_id ?? null,
            scope_path: input.scope_path ?? [slug(input.name)],
            ontology: input.ontology ?? empty_ontology(),
            contracts: input.contracts ?? {},
            zone: input.zone ?? 'mixed',
            child_world_ids: [],
            node_refs: [],
            edge_refs: [],
            world_vector: null,
            content_hash: '',
            created_at: at,
            updated_at: at,
            metadata: input.metadata ?? {},
        };
        this.track_world(world.id);
        this.worlds.set(world.id, world);
        const normalized_name = world.name.toLowerCase();
        if (!this.world_ids_by_name.has(normalized_name)) this.world_ids_by_name.set(normalized_name, world.id);
        this.initialize_membership(world);
        if (!options.defer_hash) this.recompute_world_hash(world.id);
        return world;
    }

    create_child_world(parent_id: string, input: WorldInput, options: { defer_hash?: boolean } = {}): World {
        const parent = this.require_world(parent_id);
        const child = this.create_world({
            ...input,
            parent_world_id: parent.id,
            scope_path: [...parent.scope_path, slug(input.name)],
        }, options);
        this.track_world(parent.id);
        parent.child_world_ids.push(child.id);
        if (!options.defer_hash) {
            this.require_child_digest(parent.id).set(child.id, child.content_hash);
            this.propagate_from(parent.id);
        }
        return child;
    }

    // ---- membership ------------------------------------------------------

    add_node_to_world(world_id: string, node_id: string, opts: { primary?: boolean } = {}): void {
        const world = this.require_world(world_id);
        this.track_world(world_id);
        const primary = opts.primary ?? true;
        const changed = this.require_node_digest(world_id).add(node_id);
        if (changed) world.node_refs.push(node_id);
        if (primary) {
            const from = this.primary_worlds.get(node_id) ?? null;
            this.track_primary(node_id);
            this.primary_worlds.set(node_id, world_id);
            this.placement_history.push({ node_id: node_id, from_world_id: from, to_world_id: world_id, at: this.now });
        }
        if (changed) this.propagate_from(world_id);
    }

    add_edge_to_world(world_id: string, edge_id: string): void {
        const world = this.require_world(world_id);
        this.track_world(world_id);
        if (this.require_edge_digest(world_id).add(edge_id)) {
            world.edge_refs.push(edge_id);
            this.propagate_from(world_id);
        }
    }

    /** Move a node's primary placement, keeping the prior placement in history. */
    move_node_between_worlds(node_id: string, from_world_id: string, to_world_id: string): WorldPlacement {
        const from = this.require_world(from_world_id);
        const to = this.require_world(to_world_id);
        this.track_world(from.id);
        this.track_world(to.id);
        this.track_primary(node_id);

        if (this.require_node_digest(from.id).delete(node_id)) from.node_refs = from.node_refs.filter((id) => id !== node_id);
        if (this.require_node_digest(to.id).add(node_id)) to.node_refs.push(node_id);
        this.primary_worlds.set(node_id, to.id);

        const entry: WorldPlacement = {
            node_id: node_id,
            from_world_id: from.id,
            to_world_id: to.id,
            at: this.now,
        };
        this.placement_history.push(entry);

        this.propagate_from(from.id);
        this.propagate_from(to.id);
        return entry;
    }

    // ---- queries ---------------------------------------------------------

    get_world(world_id: string): World | undefined {
        return this.worlds.get(world_id);
    }

    get_world_by_name(name: string): World | undefined {
        const id = this.world_ids_by_name.get(name.toLowerCase());
        return id ? this.worlds.get(id) : undefined;
    }

    primary_world_of(node_id: string): string | undefined {
        return this.primary_worlds.get(node_id);
    }

    placement_history_for(node_id: string): WorldPlacement[] {
        return this.placement_history.filter((p) => p.node_id === node_id);
    }

    world_list(): World[] {
        return [...this.worlds.values()];
    }

    snapshot(): WorldGraphSnapshot {
        return {
            worlds: new Map([...this.worlds].map(([id, world]) => [id, clone_world(world)])),
            primary_world_of: new Map(this.primary_worlds),
            placement_history: this.placement_history.map((placement) => ({ ...placement })),
        };
    }

    checkpoint(): world_graph_checkpoint {
        const checkpoint = {
            worlds: new Map<string, World | undefined>(),
            primary_worlds: new Map<string, string | undefined>(),
            placement_history_length: this.placement_history.length,
        };
        this.checkpoints.add(checkpoint);
        return checkpoint;
    }

    commit(checkpoint: world_graph_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('WorldGraph: unknown checkpoint');
    }

    rollback(checkpoint: world_graph_checkpoint): void {
        if (!this.checkpoints.delete(checkpoint)) throw new Error('WorldGraph: unknown checkpoint');
        for (const [id, world] of checkpoint.worlds) {
            if (world === undefined) {
                this.worlds.delete(id);
                this.node_digests.delete(id);
                this.edge_digests.delete(id);
                this.child_digests.delete(id);
            } else {
                const restored = clone_world(world);
                this.worlds.set(id, restored);
                this.initialize_membership(restored);
            }
        }
        for (const [node_id, world_id] of checkpoint.primary_worlds) {
            if (world_id === undefined) this.primary_worlds.delete(node_id);
            else this.primary_worlds.set(node_id, world_id);
        }
        this.placement_history.length = checkpoint.placement_history_length;
        this.rebuild_name_index();
    }

    restore(snapshot: WorldGraphSnapshot): void {
        this.worlds = new Map([...snapshot.worlds].map(([id, world]) => [id, clone_world(world)]));
        this.primary_worlds = new Map(snapshot.primary_world_of);
        this.placement_history = snapshot.placement_history.map((placement) => ({ ...placement }));
        this.rebuild_name_index();
        this.node_digests.clear();
        this.edge_digests.clear();
        this.child_digests.clear();
        for (const world of this.worlds.values()) this.initialize_membership(world);
    }

    /** Root -> ... -> target world chain. */
    get_world_path(world_id: string): World[] {
        const chain: World[] = [];
        let current: string | null = world_id;
        const seen = new Set<string>();
        while (current && !seen.has(current)) {
            seen.add(current);
            const world = this.require_world(current);
            chain.push(world);
            current = world.parent_world_id;
        }
        return chain.reverse();
    }

    /** All world ids and node ids in a world's subtree (world included). */
    query_world_subtree(world_id: string): { world_ids: string[]; node_ids: string[] } {
        const world_ids: string[] = [];
        const node_ids = new Set<string>();
        const stack = [world_id];
        const seen = new Set<string>();
        while (stack.length) {
            const id = stack.pop() as string;
            if (seen.has(id)) continue;
            seen.add(id);
            const world = this.require_world(id);
            world_ids.push(id);
            for (const n of world.node_refs) node_ids.add(n);
            for (const c of world.child_world_ids) stack.push(c);
        }
        return { world_ids: world_ids.sort(), node_ids: [...node_ids].sort() };
    }

    /** Effective contract for a world, inherited/overridden down the tree. */
    resolve_contracts(world_id: string): Contract {
        return resolve_world_contracts(this.get_world_path(world_id));
    }

    // ---- hashing + embedding --------------------------------------------

    recompute_world_hash(world_id: string): string {
        const world = this.require_world(world_id);
        this.track_world(world_id);
        const projection = {
            hash_version: 3,
            name: world.name,
            parent_world_id: world.parent_world_id,
            scope_path: world.scope_path,
            ontology: world.ontology,
            contracts: world.contracts,
            zone: world.zone,
            child_worlds_hash: this.require_child_digest(world_id).digest(),
            node_refs_hash: this.require_node_digest(world_id).digest(),
            edge_refs_hash: this.require_edge_digest(world_id).digest(),
        };
        world.content_hash = hash_canonical(projection);
        world.updated_at = this.now;
        return world.content_hash;
    }

    /** Recompute a world's embedding (children first) and return it. */
    compose_world_embedding(world_id: string, recurse = true): number[] {
        const world = this.require_world(world_id);
        this.track_world(world_id);
        if (recurse) {
            for (const child_id of world.child_world_ids) this.compose_world_embedding(child_id, true);
        }
        const vector = compose_world_embedding(
            world,
            {
                dim: this.dim,
                node_vector: (id) => this.node_vector(id),
                child_world_vector: (id) => this.worlds.get(id)?.world_vector ?? null,
            },
            this.embedding_weights,
        );
        world.world_vector = vector;
        return vector;
    }

    // ---- internals -------------------------------------------------------

    private require_world(world_id: string): World {
        const world = this.worlds.get(world_id);
        if (!world) throw new Error(`WorldGraph: world not found: ${world_id}`);
        return world;
    }

    private rebuild_name_index(): void {
        this.world_ids_by_name.clear();
        for (const world of this.worlds.values()) {
            const normalized_name = world.name.toLowerCase();
            if (!this.world_ids_by_name.has(normalized_name)) this.world_ids_by_name.set(normalized_name, world.id);
        }
    }

    private initialize_membership(world: World): void {
        this.node_digests.set(world.id, new incremental_set_digest(world.node_refs));
        this.edge_digests.set(world.id, new incremental_set_digest(world.edge_refs));
        const children = new incremental_map_digest();
        for (const child_id of world.child_world_ids) children.set(child_id, this.worlds.get(child_id)?.content_hash ?? '');
        this.child_digests.set(world.id, children);
    }

    private require_node_digest(world_id: string): incremental_set_digest {
        const digest = this.node_digests.get(world_id);
        if (!digest) throw new Error(`WorldGraph: node digest not found: ${world_id}`);
        return digest;
    }

    private require_edge_digest(world_id: string): incremental_set_digest {
        const digest = this.edge_digests.get(world_id);
        if (!digest) throw new Error(`WorldGraph: edge digest not found: ${world_id}`);
        return digest;
    }

    private require_child_digest(world_id: string): incremental_map_digest {
        const digest = this.child_digests.get(world_id);
        if (!digest) throw new Error(`WorldGraph: child digest not found: ${world_id}`);
        return digest;
    }

    private track_world(world_id: string): void {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.worlds.has(world_id)) {
                const world = this.worlds.get(world_id);
                checkpoint.worlds.set(world_id, world ? clone_world(world) : undefined);
            }
        }
    }

    private track_primary(node_id: string): void {
        for (const checkpoint of this.checkpoints) {
            if (!checkpoint.primary_worlds.has(node_id)) checkpoint.primary_worlds.set(node_id, this.primary_worlds.get(node_id));
        }
    }

    /** Recompute hashes from a world up to the root so parents pick up changes. */
    private propagate_from(world_id: string): void {
        let current: string | null = world_id;
        const seen = new Set<string>();
        while (current && !seen.has(current)) {
            seen.add(current);
            const hash = this.recompute_world_hash(current);
            const parent_id: string | null = this.worlds.get(current)?.parent_world_id ?? null;
            if (parent_id) this.require_child_digest(parent_id).set(current, hash);
            current = parent_id;
        }
    }
}

function clone_world(world: World): World {
    return {
        ...world,
        scope_path: [...world.scope_path],
        ontology: structuredClone(world.ontology),
        contracts: structuredClone(world.contracts),
        child_world_ids: [...world.child_world_ids],
        node_refs: [...world.node_refs],
        edge_refs: [...world.edge_refs],
        world_vector: world.world_vector ? [...world.world_vector] : null,
        metadata: structuredClone(world.metadata),
    };
}
