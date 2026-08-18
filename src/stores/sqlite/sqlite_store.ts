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
 *  file  : src/stores/sqlite/sqlite_store.ts
 *  usage : durable SQLite MemoryStore preserving Hydrograph semantics
 */

import Database from 'better-sqlite3';
import { EdgeContext, type EdgeAuditEntry, type EdgeExecutionResult } from '../../core/edges/edge_context.js';
import { default_edge_registry, type EdgeRegistry } from '../../core/edges/edge_registry.js';
import { insert_edge } from '../../core/edges/edge_runtime.js';
import { sketch_operations_for, type IngestResult } from '../../core/engine/ingest_engine.js';
import type { GroundedFact } from '../../core/grounding/exocortex.js';
import { MemorySketches, type MemorySketchOperation } from '../../core/math/sketches.js';
import type { Contradiction } from '../../core/types/contradiction.js';
import type { Entity } from '../../core/types/entity.js';
import type { HydroEdge } from '../../core/types/hydro_edge.js';
import type { HydroNode } from '../../core/types/hydro_node.js';
import type { World } from '../../core/types/world.js';
import type { MemoryStore, StoreKind } from '../index.js';
import { check_sqlite_integrity, decode_node_safely, type IntegrityIssue, type IntegrityReport } from './integrity.js';
import { apply_migrations } from './migrations.js';
import { queries, type NodeQueryOptions, type StrictQueryOptions } from './queries.js';

export type SqliteStoreOptions = {
    tenant_id?: string;
    user_id?: string;
    readonly?: boolean;
    file_must_exist?: boolean;
    startup_integrity_check?: boolean;
    now?: () => number;
};

type NodeRow = { node_id: string; node_json: string; content_hash: string };

function normalize_alias(value: string): string {
    return value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function sketch_kind(state: string): string {
    return String((JSON.parse(state) as { kind?: string }).kind ?? 'unknown');
}

export class SqliteStore implements MemoryStore {
    readonly kind: StoreKind = 'sqlite';
    readonly tenant_id: string;
    readonly user_id: string;
    readonly database: Database.Database;
    readonly startup_integrity_report: IntegrityReport;
    private readonly now: () => number;
    private readonly runtime_issues: IntegrityIssue[] = [];
    private readonly statements = new Map<string, Database.Statement>();

    constructor(path = ':memory:', options: SqliteStoreOptions = {}) {
        this.tenant_id = options.tenant_id ?? 'default';
        this.user_id = options.user_id ?? 'default';
        this.now = options.now ?? (() => Date.now());
        this.database = new Database(path, {
            readonly: options.readonly ?? false,
            fileMustExist: options.file_must_exist ?? false,
        });
        this.database.pragma('foreign_keys = ON');
        this.database.pragma('busy_timeout = 5000');
        if (!(options.readonly ?? false)) {
            if (path !== ':memory:') this.database.pragma('journal_mode = WAL');
            this.database.pragma('synchronous = NORMAL');
            apply_migrations(this.database, this.now());
        }
        this.startup_integrity_report = options.startup_integrity_check === false
            ? { ok: true, checked_nodes: 0, checked_edges: 0, checked_sketches: 0, issues: [] }
            : this.check_integrity();
    }

    transaction<T>(operation: () => T): T {
        return this.database.transaction(operation)();
    }

    private prepare(sql: string): Database.Statement {
        const cached = this.statements.get(sql);
        if (cached) return cached;
        const statement = this.database.prepare(sql);
        this.statements.set(sql, statement);
        return statement;
    }

    save_node(node: HydroNode): void {
        this.transaction(() => this.save_node_internal(node));
    }

    private save_node_internal(node: HydroNode): void {
        this.prepare(`INSERT INTO hydro_nodes (
            tenant_id, user_id, node_id, content_hash, content_json, facets_json, node_json,
            world_id, parent_world_id, zone, status, confidence, salience,
            valid_from, valid_to, observed_at, recorded_at, superseded_at,
            grounding_ref, grounding_score, requires_grounding, use_for_reasoning, source_required
        ) VALUES (
            @tenant_id, @user_id, @node_id, @content_hash, @content_json, @facets_json, @node_json,
            @world_id, @parent_world_id, @zone, @status, @confidence, @salience,
            @valid_from, @valid_to, @observed_at, @recorded_at, @superseded_at,
            @grounding_ref, @grounding_score, @requires_grounding, @use_for_reasoning, @source_required
        ) ON CONFLICT (tenant_id, user_id, node_id) DO UPDATE SET
            node_json = excluded.node_json,
            status = excluded.status,
            confidence = excluded.confidence,
            salience = excluded.salience,
            valid_to = excluded.valid_to,
            recorded_at = excluded.recorded_at,
            superseded_at = excluded.superseded_at,
            grounding_ref = excluded.grounding_ref,
            grounding_score = excluded.grounding_score,
            requires_grounding = excluded.requires_grounding,
            use_for_reasoning = excluded.use_for_reasoning,
            source_required = excluded.source_required`).run({
            tenant_id: this.tenant_id,
            user_id: this.user_id,
            node_id: node.id,
            content_hash: node.content_hash,
            content_json: JSON.stringify(node.content),
            facets_json: JSON.stringify(node.facets),
            node_json: JSON.stringify(node),
            world_id: node.world.world_id,
            parent_world_id: node.world.parent_world_id,
            zone: node.world.zone,
            status: node.state.status,
            confidence: node.state.confidence,
            salience: node.state.salience,
            valid_from: node.temporal.valid_from,
            valid_to: node.temporal.valid_to,
            observed_at: node.temporal.observed_at,
            recorded_at: node.temporal.recorded_at,
            superseded_at: node.temporal.superseded_at,
            grounding_ref: node.grounding.worlddb_ref,
            grounding_score: node.grounding.grounding_score,
            requires_grounding: Number(node.contract.requires_grounding),
            use_for_reasoning: Number(node.contract.use_for_reasoning),
            source_required: Number(node.contract.source_required),
        });
        this.prepare(`INSERT INTO memory_contracts (tenant_id, user_id, node_id, contract_json)
            VALUES (?, ?, ?, ?) ON CONFLICT (tenant_id, user_id, node_id)
            DO UPDATE SET contract_json = excluded.contract_json`)
            .run(this.tenant_id, this.user_id, node.id, JSON.stringify(node.contract));
    }

    load_node(node_id: string): HydroNode | null {
        const row = this.prepare(queries.load_node).get(this.tenant_id, this.user_id, node_id) as NodeRow | undefined;
        return row ? decode_node_safely(row, row.node_id, this.runtime_issues) : null;
    }

    load_edge(edge_id: string): HydroEdge | null {
        const row = this.prepare(queries.load_edge).get(this.tenant_id, this.user_id, edge_id) as { edge_json: string } | undefined;
        if (!row) return null;
        try {
            const edge = JSON.parse(row.edge_json) as HydroEdge;
            return edge.id === edge_id ? edge : null;
        } catch (error) {
            this.runtime_issues.push({
                table: 'hydro_edges', record_id: edge_id, code: 'invalid_json',
                message: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    load_nodes(): HydroNode[] {
        const rows = this.prepare(`SELECT node_id, node_json, content_hash FROM hydro_nodes
            WHERE tenant_id = ? AND user_id = ? ORDER BY recorded_at, node_id`)
            .all(this.tenant_id, this.user_id) as NodeRow[];
        return rows.flatMap((row) => {
            const node = decode_node_safely(row, row.node_id, this.runtime_issues);
            return node ? [node] : [];
        });
    }

    load_edges(): HydroEdge[] {
        const rows = this.prepare(`SELECT edge_id, edge_json FROM hydro_edges
            WHERE tenant_id = ? AND user_id = ? ORDER BY recorded_at, edge_id`)
            .all(this.tenant_id, this.user_id) as Array<{ edge_id: string; edge_json: string }>;
        return rows.flatMap((row) => {
            try {
                const edge = JSON.parse(row.edge_json) as HydroEdge;
                return edge.id === row.edge_id ? [edge] : [];
            } catch {
                return [];
            }
        });
    }

    load_worlds(): World[] {
        const rows = this.prepare(`SELECT world_json FROM worlds
            WHERE tenant_id = ? AND user_id = ? ORDER BY updated_at, world_id`)
            .all(this.tenant_id, this.user_id) as Array<{ world_json: string }>;
        const worlds = rows.flatMap((row) => {
            try { return [JSON.parse(row.world_json) as World]; } catch { return []; }
        });
        const normalized = this.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_node_refs'`).get();
        if (!normalized) return worlds;
        const by_id = new Map(worlds.map((world) => [world.id, world]));
        for (const world of worlds) {
            world.node_refs = [];
            world.edge_refs = [];
        }
        const node_refs = this.prepare(`SELECT world_id, node_id FROM world_node_refs
            WHERE tenant_id=? AND user_id=? ORDER BY world_id, node_id`)
            .all(this.tenant_id, this.user_id) as Array<{ world_id: string; node_id: string }>;
        for (const ref of node_refs) by_id.get(ref.world_id)?.node_refs.push(ref.node_id);
        const edge_refs = this.prepare(`SELECT world_id, edge_id FROM world_edge_refs
            WHERE tenant_id=? AND user_id=? ORDER BY world_id, edge_id`)
            .all(this.tenant_id, this.user_id) as Array<{ world_id: string; edge_id: string }>;
        for (const ref of edge_refs) by_id.get(ref.world_id)?.edge_refs.push(ref.edge_id);
        return worlds;
    }

    load_entities(): Entity[] {
        const rows = this.prepare(`SELECT entity_json FROM entities
            WHERE tenant_id = ? AND user_id = ? ORDER BY updated_at, entity_id`)
            .all(this.tenant_id, this.user_id) as Array<{ entity_json: string }>;
        return rows.flatMap((row) => {
            try { return [JSON.parse(row.entity_json) as Entity]; } catch { return []; }
        });
    }

    load_grounded_facts(): GroundedFact[] {
        const rows = this.prepare(`SELECT fact_json FROM grounded_facts
            WHERE tenant_id = ? AND user_id = ? ORDER BY observed_at, fact_ref`)
            .all(this.tenant_id, this.user_id) as Array<{ fact_json: string }>;
        return rows.flatMap((row) => {
            try { return [JSON.parse(row.fact_json) as GroundedFact]; } catch { return []; }
        });
    }

    save_batch(nodes: readonly HydroNode[], edges: readonly HydroEdge[] = []): void {
        this.transaction(() => {
            for (const node of nodes) this.save_node_internal(node);
            for (const edge of edges) this.save_edge(edge);
        });
    }

    persist_ingest(result: IngestResult): void {
        const persist = () => {
            for (const node of result.changed_nodes) this.save_node_internal(node);
            for (const edge of result.edges) this.save_edge(edge);
            this.prepare(`INSERT INTO audit_log
                (tenant_id, user_id, edge_id, edge_type, at, affected_node_ids_json, summary, audit_json)
                VALUES (?, ?, NULL, 'ingest', ?, ?, ?, ?)`)
                .run(
                    this.tenant_id,
                    this.user_id,
                    result.node.temporal.recorded_at,
                    JSON.stringify(result.diff.index_updates),
                    `ingest committed ${result.diff.created_node_ids.length} nodes and ${result.diff.created_edge_ids.length} edges`,
                    JSON.stringify({ diff: result.diff, trace: result.trace }),
                );
            for (const operation of sketch_operations_for(result)) this.save_sketch_operation('global', operation, result.node.temporal.recorded_at);
        };
        if (this.database.inTransaction) persist();
        else this.transaction(persist);
    }

    private save_edge(edge: HydroEdge): void {
        this.prepare(`INSERT OR IGNORE INTO hydro_edges (
            tenant_id, user_id, edge_id, from_id, to_id, edge_type, confidence, weight,
            valid_from, valid_to, observed_at, recorded_at, handler, edge_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(
                this.tenant_id, this.user_id, edge.id, edge.from, edge.to, edge.type,
                edge.confidence, edge.weight, edge.temporal.valid_from, edge.temporal.valid_to,
                edge.temporal.observed_at, edge.temporal.recorded_at,
                edge.handler.handler, JSON.stringify(edge),
            );
    }

    execute_edge_transaction(
        edge: HydroEdge,
        registry: EdgeRegistry = default_edge_registry(),
    ): EdgeExecutionResult {
        return this.transaction(() => {
            const from = this.load_node(edge.from);
            const to = this.load_node(edge.to);
            if (!from || !to) throw new Error(`edge endpoints must be valid stored nodes: ${edge.from}, ${edge.to}`);
            const context = new EdgeContext({ now: edge.temporal.recorded_at, nodes: [from, to] });
            const result = insert_edge(edge, context, registry);
            for (const node of context.node_list()) this.save_node_internal(node);
            this.save_edge(edge);
            for (const contradiction of context.unresolved_contradictions()) this.save_contradiction(contradiction);
            this.save_audit(result.audit);
            return result;
        });
    }

    query_current_truth(options: NodeQueryOptions): HydroNode[] {
        return this.query_nodes(queries.current_truth, options);
    }

    query_historical_truth(options: NodeQueryOptions): HydroNode[] {
        return this.query_nodes(queries.historical_truth, options);
    }

    query_strict_candidates(options: StrictQueryOptions): HydroNode[] {
        const rows = this.prepare(queries.strict_candidates).all({
            tenant_id: this.tenant_id,
            user_id: this.user_id,
            at: options.at,
            world_id: options.world_id ?? null,
            limit: options.limit ?? 100,
            min_confidence: options.min_confidence ?? 0.5,
            grounding_threshold: options.grounding_threshold ?? 0.6,
        }) as NodeRow[];
        return rows.flatMap((row) => {
            const node = decode_node_safely(row, row.node_id, this.runtime_issues);
            return node ? [node] : [];
        });
    }

    private query_nodes(sql: string, options: NodeQueryOptions): HydroNode[] {
        const rows = this.prepare(sql).all({
            tenant_id: this.tenant_id,
            user_id: this.user_id,
            at: options.at,
            world_id: options.world_id ?? null,
            limit: options.limit ?? 100,
        }) as NodeRow[];
        return rows.flatMap((row) => {
            const node = decode_node_safely(row, row.node_id, this.runtime_issues);
            return node ? [node] : [];
        });
    }

    save_world(world: World, sync_references = true): void {
        const compact = { ...world, node_refs: [], edge_refs: [] };
        this.prepare(`INSERT INTO worlds
            (tenant_id, user_id, world_id, parent_world_id, name, zone, content_hash, world_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (tenant_id, user_id, world_id) DO UPDATE SET
                parent_world_id=excluded.parent_world_id, name=excluded.name, zone=excluded.zone,
                content_hash=excluded.content_hash, world_json=excluded.world_json, updated_at=excluded.updated_at`)
            .run(this.tenant_id, this.user_id, world.id, world.parent_world_id, world.name, world.zone, world.content_hash, JSON.stringify(compact), world.updated_at);
        if (!sync_references) return;
        this.prepare(`DELETE FROM world_node_refs WHERE tenant_id=? AND user_id=? AND world_id=?`)
            .run(this.tenant_id, this.user_id, world.id);
        this.prepare(`DELETE FROM world_edge_refs WHERE tenant_id=? AND user_id=? AND world_id=?`)
            .run(this.tenant_id, this.user_id, world.id);
        for (const node_id of world.node_refs) this.add_world_node_ref(world.id, node_id);
        for (const edge_id of world.edge_refs) this.add_world_edge_ref(world.id, edge_id);
    }

    add_world_node_ref(world_id: string, node_id: string): void {
        this.prepare(`INSERT OR IGNORE INTO world_node_refs (tenant_id, user_id, world_id, node_id)
            VALUES (?, ?, ?, ?)`)
            .run(this.tenant_id, this.user_id, world_id, node_id);
    }

    add_world_edge_ref(world_id: string, edge_id: string): void {
        this.prepare(`INSERT OR IGNORE INTO world_edge_refs (tenant_id, user_id, world_id, edge_id)
            VALUES (?, ?, ?, ?)`)
            .run(this.tenant_id, this.user_id, world_id, edge_id);
    }

    save_entity(entity: Entity): void {
        this.transaction(() => {
            this.prepare(`INSERT INTO entities
                (tenant_id, user_id, entity_id, canonical_name, entity_type, confidence, entity_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (tenant_id, user_id, entity_id) DO UPDATE SET
                    canonical_name=excluded.canonical_name, entity_type=excluded.entity_type,
                    confidence=excluded.confidence, entity_json=excluded.entity_json, updated_at=excluded.updated_at`)
                .run(this.tenant_id, this.user_id, entity.id, entity.canonical_name, entity.type, entity.confidence, JSON.stringify(entity), entity.updated_at);
            for (const alias of [entity.canonical_name, ...entity.aliases]) {
                this.prepare(`INSERT INTO entity_aliases
                    (tenant_id, user_id, normalized_alias, entity_id, alias) VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT (tenant_id, user_id, normalized_alias) DO UPDATE SET entity_id=excluded.entity_id, alias=excluded.alias`)
                    .run(this.tenant_id, this.user_id, normalize_alias(alias), entity.id, alias);
            }
        });
    }

    load_entity(entity_id: string): Entity | null {
        const row = this.prepare(`SELECT entity_json FROM entities
            WHERE tenant_id=? AND user_id=? AND entity_id=?`).get(this.tenant_id, this.user_id, entity_id) as { entity_json: string } | undefined;
        if (!row) return null;
        try { return JSON.parse(row.entity_json) as Entity; } catch { return null; }
    }

    canonical_entity_id(alias: string): string | null {
        const row = this.prepare(queries.canonical_alias)
            .get(this.tenant_id, this.user_id, normalize_alias(alias)) as { entity_id: string } | undefined;
        return row?.entity_id ?? null;
    }

    save_grounded_fact(fact: GroundedFact): void {
        this.prepare(`INSERT INTO grounded_facts
            (tenant_id, user_id, fact_ref, statement, source_id, source_kind, source_reliability,
             observed_at, valid_from, valid_to, fact_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (tenant_id, user_id, fact_ref) DO UPDATE SET
                statement=excluded.statement, source_id=excluded.source_id, source_kind=excluded.source_kind,
                source_reliability=excluded.source_reliability, observed_at=excluded.observed_at,
                valid_from=excluded.valid_from, valid_to=excluded.valid_to, fact_json=excluded.fact_json`)
            .run(this.tenant_id, this.user_id, fact.ref, fact.statement, fact.source.id, fact.source.kind,
                fact.source.reliability, fact.observed_at, fact.valid_from, fact.valid_to, JSON.stringify(fact));
    }

    load_grounded_fact(ref: string): GroundedFact | null {
        const row = this.prepare(`SELECT fact_json FROM grounded_facts
            WHERE tenant_id=? AND user_id=? AND fact_ref=?`).get(this.tenant_id, this.user_id, ref) as { fact_json: string } | undefined;
        if (!row) return null;
        try { return JSON.parse(row.fact_json) as GroundedFact; } catch { return null; }
    }

    save_sketch_state(key: string, sketches: MemorySketches, at = this.now()): void {
        this.transaction(() => {
            const state = sketches.serialize();
            const row = this.prepare(`SELECT COALESCE(MAX(operation_id), 0) AS operation_id FROM sketch_operations
                WHERE tenant_id=? AND user_id=? AND sketch_key=?`)
                .get(this.tenant_id, this.user_id, key) as { operation_id: number };
            this.prepare(`INSERT INTO sketch_states
            (tenant_id, user_id, sketch_key, sketch_kind, state_json, updated_at, applied_operation_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (tenant_id, user_id, sketch_key) DO UPDATE SET
                sketch_kind=excluded.sketch_kind, state_json=excluded.state_json,
                updated_at=excluded.updated_at, applied_operation_id=excluded.applied_operation_id`)
                .run(this.tenant_id, this.user_id, key, sketch_kind(state), state, at, row.operation_id);
            this.prepare(`DELETE FROM sketch_operations
                WHERE tenant_id=? AND user_id=? AND sketch_key=? AND operation_id<=?`)
                .run(this.tenant_id, this.user_id, key, row.operation_id);
        });
    }

    load_sketch_state(key: string): MemorySketches | null {
        const row = this.prepare(`SELECT state_json, applied_operation_id FROM sketch_states
            WHERE tenant_id=? AND user_id=? AND sketch_key=?`).get(this.tenant_id, this.user_id, key) as { state_json: string; applied_operation_id: number } | undefined;
        if (!row) return null;
        try {
            const sketches = MemorySketches.deserialize(row.state_json);
            const operations = this.prepare(`SELECT operation_json FROM sketch_operations
                WHERE tenant_id=? AND user_id=? AND sketch_key=? AND operation_id>?
                ORDER BY operation_id`)
                .all(this.tenant_id, this.user_id, key, row.applied_operation_id) as Array<{ operation_json: string }>;
            for (const operation of operations) sketches.apply_operation(JSON.parse(operation.operation_json) as MemorySketchOperation);
            return sketches;
        } catch (error) {
            this.runtime_issues.push({
                table: 'sketch_states', record_id: key, code: 'invalid_sketch',
                message: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }

    private save_sketch_operation(key: string, operation: MemorySketchOperation, recorded_at: number): void {
        this.prepare(`INSERT INTO sketch_operations
            (tenant_id, user_id, sketch_key, operation_json, recorded_at) VALUES (?, ?, ?, ?, ?)`)
            .run(this.tenant_id, this.user_id, key, JSON.stringify(operation), recorded_at);
    }

    append_cold_log(payload: unknown, event_id?: string, recorded_at = this.now()): number {
        const result = this.prepare(`INSERT INTO cold_logs
            (tenant_id, user_id, event_id, recorded_at, payload_json) VALUES (?, ?, ?, ?, ?)`)
            .run(this.tenant_id, this.user_id, event_id ?? null, recorded_at, JSON.stringify(payload));
        return Number(result.lastInsertRowid);
    }

    private save_contradiction(contradiction: Contradiction): void {
        this.prepare(`INSERT INTO contradictions
            (tenant_id, user_id, contradiction_id, node_a, node_b, severity, pressure, resolved, created_at, contradiction_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (tenant_id, user_id, contradiction_id) DO UPDATE SET
                severity=excluded.severity, pressure=excluded.pressure, resolved=excluded.resolved,
                contradiction_json=excluded.contradiction_json`)
            .run(this.tenant_id, this.user_id, contradiction.id, contradiction.node_a, contradiction.node_b,
                contradiction.severity, contradiction.pressure, Number(contradiction.resolved), contradiction.created_at,
                JSON.stringify(contradiction));
    }

    private save_audit(audit: EdgeAuditEntry): void {
        this.prepare(`INSERT INTO audit_log
            (tenant_id, user_id, edge_id, edge_type, at, affected_node_ids_json, summary, audit_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(this.tenant_id, this.user_id, audit.edge_id, audit.edge_type, audit.at,
                JSON.stringify(audit.affected_node_ids), audit.summary, JSON.stringify(audit));
    }

    check_integrity(): IntegrityReport {
        const report = check_sqlite_integrity(this.database, { tenant_id: this.tenant_id, user_id: this.user_id });
        if (this.runtime_issues.length === 0) return report;
        return { ...report, ok: false, issues: [...report.issues, ...this.runtime_issues] };
    }

    corruption_issues(): IntegrityIssue[] {
        return [...this.runtime_issues];
    }

    close(): void {
        this.database.close();
    }
}