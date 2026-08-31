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
 *  file  : src/core/edges/edge_context.ts
 *  usage : implements the LongMemory edge context component
 */


import { deep_freeze } from '../memory/durable_graph.js';
import { hash_merkle_children } from '../hash/merkle.js';
import type { HydroEdge } from '../types/hydro_edge.js';
import type {
    HydroNode,
    NodeGrounding,
    NodeTemporal,
} from '../types/hydro_node.js';
import type { NodeState } from '../types/node_state.js';
import type { Provenance, SourceTraceEntry } from '../types/provenance.js';
import type { Contradiction } from '../types/contradiction.js';
import { clamp01 } from '../math/utility.js';

export type EdgeAuditEntry = {
    edge_id: string;
    edge_type: string;
    at: number;
    affected_node_ids: string[];
    summary: string;
};

export type HandlerOutcome = {
    affected_node_ids: string[];
    notes: string[];
};

export type EdgeHandler = {
    type: string;
    run(edge: HydroEdge, ctx: EdgeContext): HandlerOutcome;
};

export type EdgeExecutionResult = {
    ok: true;
    edge: HydroEdge;
    affected_node_ids: string[];
    audit: EdgeAuditEntry;
    notes: string[];
};

type ContextSnapshot = {
    nodes: Map<string, HydroNode>;
    dirty_node_ids: Set<string>;
    contradictions: Map<string, Contradiction>;
    resolver: Map<string, string>;
    containment: Map<string, Set<string>>;
    references: Map<string, Set<string>>;
    derivations: Map<string, Set<string>>;
    supports: Map<string, string[]>;
    pressure: Map<string, number>;
    history: Map<string, string>;
    semantic_shifts: SemanticShift[];
    audit: EdgeAuditEntry[];
};

export type SemanticShift = {
    from: string;
    to: string;
    at: number;
    note: string;
};

export class EdgeContext {
    private nodes = new Map<string, HydroNode>();
    private dirty_node_ids = new Set<string>();
    private contradictions = new Map<string, Contradiction>();
    private resolver = new Map<string, string>();
    private containment = new Map<string, Set<string>>();
    private references = new Map<string, Set<string>>();
    private derivations = new Map<string, Set<string>>();
    private supports = new Map<string, string[]>();
    private pressure = new Map<string, number>();
    private history = new Map<string, string>();
    private semantic_shifts: SemanticShift[] = [];
    private audit: EdgeAuditEntry[] = [];

    readonly now: number;

    constructor(options: { now?: number; nodes?: readonly HydroNode[] } = {}) {
        this.now = options.now ?? Date.now();
        for (const node of options.nodes ?? []) this.nodes.set(node.id, deep_freeze(node));
    }



    add_node(node: HydroNode): HydroNode {
        this.nodes.set(node.id, deep_freeze(node));
        this.dirty_node_ids.add(node.id);
        return node;
    }

    get_node(id: string): HydroNode {
        const node = this.nodes.get(id);
        if (!node) throw new Error(`EdgeContext: node not found: ${id}`);
        return node;
    }

    has_node(id: string): boolean {
        return this.nodes.has(id);
    }

    node_list(): HydroNode[] {
        return [...this.nodes.values()];
    }

    changed_node_list(): HydroNode[] {
        return [...this.dirty_node_ids].map((id) => this.get_node(id));
    }

    private put_node(node: HydroNode): HydroNode {
        const frozen = deep_freeze(node);
        this.nodes.set(frozen.id, frozen);
        this.dirty_node_ids.add(frozen.id);
        return frozen;
    }

    update_node_state(id: string, patch: Partial<NodeState>): HydroNode {
        const node = this.get_node(id);
        return this.put_node({ ...node, state: { ...node.state, ...patch } });
    }

    update_node_temporal(id: string, patch: Partial<NodeTemporal>): HydroNode {
        const node = this.get_node(id);
        return this.put_node({ ...node, temporal: { ...node.temporal, ...patch } });
    }

    update_node_grounding(id: string, patch: Partial<NodeGrounding>): HydroNode {
        const node = this.get_node(id);
        return this.put_node({ ...node, grounding: { ...node.grounding, ...patch } });
    }

    append_provenance_source(id: string, entry: SourceTraceEntry): HydroNode {
        const node = this.get_node(id);
        const provenance: Provenance = {
            ...node.provenance,
            source_trace: [...node.provenance.source_trace, entry],
        };
        return this.put_node({ ...node, provenance });
    }

    // ---- contradictions --------------------------------------------------

    add_contradiction(node_a: string, node_b: string, pressure: number): Contradiction {
        const id = `contradiction:${node_a}|${node_b}`;
        const contradiction: Contradiction = {
            id,
            node_a: node_a,
            node_b: node_b,
            severity: pressure,
            created_at: this.now,
            resolved: false,
            pressure,
        };
        this.contradictions.set(id, contradiction);
        return contradiction;
    }

    get_contradiction(id: string): Contradiction | undefined {
        return this.contradictions.get(id);
    }

    unresolved_contradictions(): Contradiction[] {
        return [...this.contradictions.values()].filter((c) => !c.resolved);
    }

    bump_pressure(id: string, delta: number): number {
        const next = (this.pressure.get(id) ?? 0) + delta;
        this.pressure.set(id, next);
        return next;
    }

    pressure_of(id: string): number {
        return this.pressure.get(id) ?? 0;
    }

    // ---- entity resolution ----------------------------------------------

    set_alias(alias_id: string, canonical_id: string): void {
        this.resolver.set(alias_id, canonical_id);
    }

    resolve_entity(id: string): string {
        let current = id;
        const seen = new Set<string>();
        while (this.resolver.has(current) && !seen.has(current)) {
            seen.add(current);
            current = this.resolver.get(current) as string;
        }
        return current;
    }

    // ---- containment / worlds -------------------------------------------

    add_containment(parent_id: string, child_id: string): void {
        let set = this.containment.get(parent_id);
        if (!set) {
            set = new Set<string>();
            this.containment.set(parent_id, set);
        }
        set.add(child_id);
    }

    children_of(parent_id: string): string[] {
        return [...(this.containment.get(parent_id) ?? new Set<string>())];
    }

    /** Merkle root over the content hashes of a parent's contained children. */
    world_merkle_root(parent_id: string): string {
        const hashes = this.children_of(parent_id)
            .map((id) => this.get_node(id).content_hash)
            .sort();
        return hash_merkle_children(hashes);
    }

    // ---- references / derivations / support / drift ---------------------

    add_reference(from_id: string, to_id: string): void {
        this.add_to_set_map(this.references, from_id, to_id);
    }

    add_derivation(derived_id: string, source_id: string): void {
        this.add_to_set_map(this.derivations, derived_id, source_id);
    }

    sources_of(derived_id: string): string[] {
        return [...(this.derivations.get(derived_id) ?? new Set<string>())];
    }

    add_support(target_id: string, source_id: string): void {
        const list = this.supports.get(target_id) ?? [];
        list.push(source_id);
        this.supports.set(target_id, list);
    }

    supports_of(target_id: string): string[] {
        return [...(this.supports.get(target_id) ?? [])];
    }

    link_history(old_id: string, new_id: string): void {
        this.history.set(old_id, new_id);
    }

    successor_of(old_id: string): string | undefined {
        return this.history.get(old_id);
    }

    record_semantic_shift(from_id: string, to_id: string, note: string): void {
        this.semantic_shifts.push({ from: from_id, to: to_id, at: this.now, note });
    }

    shifts(): SemanticShift[] {
        return [...this.semantic_shifts];
    }

    private add_to_set_map(map: Map<string, Set<string>>, key: string, value: string): void {
        let set = map.get(key);
        if (!set) {
            set = new Set<string>();
            map.set(key, set);
        }
        set.add(value);
    }

    // ---- audit -----------------------------------------------------------

    write_audit(edge: HydroEdge, affected_node_ids: string[], summary: string): EdgeAuditEntry {
        const entry: EdgeAuditEntry = {
            edge_id: edge.id,
            edge_type: edge.type,
            at: this.now,
            affected_node_ids: affected_node_ids,
            summary,
        };
        this.audit.push(entry);
        return entry;
    }

    audit_log(): EdgeAuditEntry[] {
        return [...this.audit];
    }

    // ---- transaction control --------------------------------------------

    snapshot(): ContextSnapshot {
        return {
            nodes: new Map(this.nodes),
            dirty_node_ids: new Set(this.dirty_node_ids),
            contradictions: new Map(this.contradictions),
            resolver: new Map(this.resolver),
            containment: clone_set_map(this.containment),
            references: clone_set_map(this.references),
            derivations: clone_set_map(this.derivations),
            supports: clone_array_map(this.supports),
            pressure: new Map(this.pressure),
            history: new Map(this.history),
            semantic_shifts: [...this.semantic_shifts],
            audit: [...this.audit],
        };
    }

    restore(snap: ContextSnapshot): void {
        this.nodes = new Map(snap.nodes);
        this.dirty_node_ids = new Set(snap.dirty_node_ids);
        this.contradictions = new Map(snap.contradictions);
        this.resolver = new Map(snap.resolver);
        this.containment = clone_set_map(snap.containment);
        this.references = clone_set_map(snap.references);
        this.derivations = clone_set_map(snap.derivations);
        this.supports = clone_array_map(snap.supports);
        this.pressure = new Map(snap.pressure);
        this.history = new Map(snap.history);
        this.semantic_shifts = [...snap.semantic_shifts];
        this.audit = [...snap.audit];
    }
}

function clone_set_map(map: Map<string, Set<string>>): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    for (const [k, v] of map) out.set(k, new Set(v));
    return out;
}

function clone_array_map(map: Map<string, string[]>): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const [k, v] of map) out.set(k, [...v]);
    return out;
}
