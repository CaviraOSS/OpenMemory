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
 *  file  : src/stores/sqlite/integrity.ts
 *  usage : implements the LongMemory integrity component
 */

import type Database from 'better-sqlite3';
import { verify_node_hash } from '../../core/hash/content_hash.js';
import { CountMinSketch } from '../../core/math/count_min.js';
import { FrequentDirections } from '../../core/math/frequent_directions.js';
import { OjaTracker } from '../../core/math/oja.js';
import { MemorySketches } from '../../core/math/sketches.js';
import type { HydroNode } from '../../core/types/hydro_node.js';

export type IntegrityIssue = {
    table: string;
    record_id: string;
    code: 'sqlite' | 'invalid_json' | 'hash_mismatch' | 'id_mismatch' | 'invalid_sketch' | 'dangling_edge';
    message: string;
};

export type IntegrityReport = {
    ok: boolean;
    checked_nodes: number;
    checked_edges: number;
    checked_sketches: number;
    issues: IntegrityIssue[];
};

export type IntegrityScope = { tenant_id: string; user_id: string };

export function decode_node_safely(
    row: { node_json: string; content_hash: string },
    record_id: string,
    issues?: IntegrityIssue[],
): HydroNode | null {
    try {
        const parsed = JSON.parse(row.node_json) as HydroNode;
        const node = parsed.metadata === undefined ? { ...parsed, metadata: {} } : parsed;
        if (node.id !== record_id) {
            issues?.push({ table: 'hydro_nodes', record_id: record_id, code: 'id_mismatch', message: `payload id ${node.id}` });
            return null;
        }
        if (node.content_hash !== row.content_hash || !verify_node_hash(node)) {
            issues?.push({ table: 'hydro_nodes', record_id: record_id, code: 'hash_mismatch', message: 'content hash does not verify' });
            return null;
        }
        return node;
    } catch (error) {
        issues?.push({
            table: 'hydro_nodes', record_id: record_id, code: 'invalid_json',
            message: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

function validate_sketch(state: string): void {
    const data = JSON.parse(state) as { kind?: string };
    if (data.kind === 'memory-sketches') MemorySketches.deserialize(data as never);
    else if (data.kind === 'count-min') CountMinSketch.deserialize(data as never);
    else if (data.kind === 'frequent-directions') FrequentDirections.deserialize(data as never);
    else if (data.kind === 'oja') OjaTracker.deserialize(data as never);
    else throw new Error(`unknown sketch kind ${String(data.kind)}`);
}

export function check_sqlite_integrity(
    db: Database.Database,
    scope: IntegrityScope,
): IntegrityReport {
    const issues: IntegrityIssue[] = [];
    const quick = db.pragma('quick_check') as Array<{ quick_check: string }>;
    for (const row of quick) {
        if (row.quick_check !== 'ok') {
            issues.push({ table: 'sqlite', record_id: 'database', code: 'sqlite', message: row.quick_check });
        }
    }

    const node_rows = db.prepare(`SELECT node_id, node_json, content_hash FROM hydro_nodes
        WHERE tenant_id = ? AND user_id = ?`).all(scope.tenant_id, scope.user_id) as Array<{
        node_id: string; node_json: string; content_hash: string;
    }>;
    const node_ids = new Set<string>();
    for (const row of node_rows) {
        if (decode_node_safely(row, row.node_id, issues)) node_ids.add(row.node_id);
    }

    const world_ids = new Set(
        (db.prepare('SELECT world_id FROM worlds WHERE tenant_id = ? AND user_id = ?')
            .all(scope.tenant_id, scope.user_id) as Array<{ world_id: string }>).map((row) => row.world_id),
    );
    const entity_ids = new Set(
        (db.prepare('SELECT entity_id FROM entities WHERE tenant_id = ? AND user_id = ?')
            .all(scope.tenant_id, scope.user_id) as Array<{ entity_id: string }>).map((row) => row.entity_id),
    );
    const fact_refs = new Set(
        (db.prepare('SELECT fact_ref FROM grounded_facts WHERE tenant_id = ? AND user_id = ?')
            .all(scope.tenant_id, scope.user_id) as Array<{ fact_ref: string }>).map((row) => row.fact_ref),
    );
    const endpoint_exists = (id: string): boolean => node_ids.has(id) || world_ids.has(id) || entity_ids.has(id) || fact_refs.has(id);
    const edge_rows = db.prepare(`SELECT edge_id, from_id, to_id, edge_json FROM hydro_edges
        WHERE tenant_id = ? AND user_id = ?`).all(scope.tenant_id, scope.user_id) as Array<{
        edge_id: string; from_id: string; to_id: string; edge_json: string;
    }>;
    for (const row of edge_rows) {
        try {
            const edge = JSON.parse(row.edge_json) as { id: string; from: string; to: string };
            if (edge.id !== row.edge_id || edge.from !== row.from_id || edge.to !== row.to_id) {
                issues.push({ table: 'hydro_edges', record_id: row.edge_id, code: 'id_mismatch', message: 'edge payload does not match indexed columns' });
            }
            if (!endpoint_exists(row.from_id)) {
                issues.push({ table: 'hydro_edges', record_id: row.edge_id, code: 'dangling_edge', message: `missing from endpoint ${row.from_id}` });
            }
            if (!endpoint_exists(row.to_id)) {
                issues.push({ table: 'hydro_edges', record_id: row.edge_id, code: 'dangling_edge', message: `missing to endpoint ${row.to_id}` });
            }
        } catch (error) {
            issues.push({
                table: 'hydro_edges', record_id: row.edge_id, code: 'invalid_json',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    const sketch_rows = db.prepare(`SELECT sketch_key, state_json FROM sketch_states
        WHERE tenant_id = ? AND user_id = ?`).all(scope.tenant_id, scope.user_id) as Array<{
        sketch_key: string; state_json: string;
    }>;
    for (const row of sketch_rows) {
        try {
            validate_sketch(row.state_json);
        } catch (error) {
            issues.push({
                table: 'sketch_states', record_id: row.sketch_key, code: 'invalid_sketch',
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return {
        ok: issues.length === 0,
        checked_nodes: node_rows.length,
        checked_edges: edge_rows.length,
        checked_sketches: sketch_rows.length,
        issues,
    };
}