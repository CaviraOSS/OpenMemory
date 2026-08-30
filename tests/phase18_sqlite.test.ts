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
 *  file  : tests/phase18_sqlite.test.ts
 *  usage : verifies LongMemory phase18 sqlite.test behavior
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    MemorySketches,
    IngestEngine,
    create_hydro_edge,
    create_hydro_node,
    default_contract,
    default_node_state,
    empty_facets,
    manual_provenance,
    type HydroNodeInput,
} from '../src/core/index.js';
import { SqliteStore } from '../src/stores/index.js';

const jan = Date.UTC(2026, 0, 1);
const mar = Date.UTC(2026, 2, 1);
const apr = Date.UTC(2026, 3, 1);
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function db_path(): string {
    const dir = mkdtempSync(join(tmpdir(), 'longmemory-sqlite-'));
    dirs.push(dir);
    return join(dir, 'memory.db');
}

function node(
    id: string,
    text: string,
    over: Partial<HydroNodeInput['temporal']> = {},
    status: HydroNodeInput['state']['status'] = 'active',
) {
    return create_hydro_node({
        id,
        content: { raw: text, canonical: text.toLowerCase(), summary: text },
        facets: { ...empty_facets(), semantic: { value: text, weight: 0.9 } },
        world: { world_id: 'world:root', parent_world_id: null, zone: 'endocortex', scope_path: ['root'] },
        temporal: { valid_from: jan, valid_to: null, observed_at: jan, recorded_at: jan, superseded_at: null, ...over },
        contract: default_contract(),
        grounding: { worlddb_ref: null, source_ids: [], grounding_score: 0 },
        state: { ...default_node_state(), status, confidence: 0.9 },
        vectors: { semantic: [1, 0], type_vector: null, world_vector: null },
        provenance: manual_provenance('tester', jan),
    });
}

function supersedes(from: string, to: string) {
    return create_hydro_edge({
        from,
        to,
        type: 'supersedes',
        confidence: 0.95,
        weight: 1,
        temporal: { valid_from: mar, valid_to: null, observed_at: mar, recorded_at: mar },
        handler: { handler: 'supersedes', params: {} },
        provenance: manual_provenance('tester', mar),
    });
}

describe('phase 18 SQLite persistence', () => {
    it('1. stores and loads an immutable node', () => {
        const store = new SqliteStore(':memory:', { tenant_id: 't1', user_id: 'u1' });
        const original = node('n1', 'I prefer tea');

        store.save_node(original);
        const loaded = store.load_node(original.id);

        expect(loaded).toEqual(original);
        expect(loaded?.content_hash).toBe(original.content_hash);
        expect(store.startup_integrity_report.ok).toBe(true);
        store.close();
    });

    it('2. executes edge and node envelope updates in one transaction', () => {
        const store = new SqliteStore(':memory:');
        const old = node('old', 'I prefer tea');
        const current = node('new', 'I prefer coffee', { valid_from: mar, observed_at: mar, recorded_at: mar });
        store.save_batch([old, current]);

        const edge = supersedes(current.id, old.id);
        const result = store.execute_edge_transaction(edge);

        expect(result.ok).toBe(true);
        expect(store.load_edge(edge.id)).toEqual(edge);
        expect(store.load_node(old.id)?.state.status).toBe('superseded');
        expect(store.load_node(old.id)?.temporal.valid_to).toBe(mar);
        const audit = store.database.prepare('SELECT COUNT(*) AS count FROM audit_log').get() as { count: number };
        expect(audit.count).toBe(1);
        store.close();
    });

    it('persists a complete ingest diff atomically', () => {
        const engine = new IngestEngine({ now: () => jan });
        const store = new SqliteStore(':memory:');
        const first = engine.ingest({ user_id: 'default', text: 'I prefer tea', at: jan });
        store.persist_ingest(first);
        const second = engine.ingest({ user_id: 'default', text: 'I now prefer coffee instead of tea', at: mar });
        store.persist_ingest(second);

        expect(store.load_node(first.node.id)?.state.status).toBe('superseded');
        expect(store.load_node(second.node.id)?.state.status).toBe('active');
        expect(store.load_edge(second.edges[0].id)?.type).toBe('supersedes');
        const audits = store.database.prepare(`SELECT COUNT(*) AS count FROM audit_log WHERE edge_type='ingest'`).get() as { count: number };
        expect(audits.count).toBe(2);
        store.close();
    });

    it('persists decay envelope updates with an audit event', () => {
        const store = new SqliteStore(':memory:');
        const original = node('decay', 'A memory that can decay');
        store.save_node(original);
        const version = { ...original, state: { ...original.state, activation: 0.25, decay_updated_at: mar } };
        store.persist_maintenance([version], { kind: 'decay', at: mar, node_ids: [original.id], details: { tier: 'cold' } });

        expect(store.load_node(original.id)?.state.activation).toBe(0.25);
        expect(store.load_node(original.id)?.content_hash).toBe(original.content_hash);
        const audit = store.database.prepare(`SELECT edge_type, affected_node_ids_json FROM audit_log WHERE edge_type='decay'`).get() as { edge_type: string; affected_node_ids_json: string };
        expect(audit.edge_type).toBe('decay');
        expect(JSON.parse(audit.affected_node_ids_json)).toEqual([original.id]);
        store.close();
    });

    it('3. queries current truth efficiently', () => {
        const store = new SqliteStore(':memory:');
        const old = node('old', 'I prefer tea');
        const current = node('new', 'I prefer coffee', { valid_from: mar, observed_at: mar, recorded_at: mar });
        store.save_batch([old, current]);
        store.execute_edge_transaction(supersedes(current.id, old.id));

        const ids = store.query_current_truth({ at: apr }).map((item) => item.id);
        expect(ids).toContain(current.id);
        expect(ids).not.toContain(old.id);
        store.close();
    });

    it('4. queries historical valid-time truth', () => {
        const store = new SqliteStore(':memory:');
        const old = node('old', 'I prefer tea');
        const current = node('new', 'I prefer coffee', { valid_from: mar, observed_at: mar, recorded_at: mar });
        store.save_batch([old, current]);
        store.execute_edge_transaction(supersedes(current.id, old.id));

        const ids = store.query_historical_truth({ at: jan + 1000 }).map((item) => item.id);
        expect(ids).toContain(old.id);
        expect(ids).not.toContain(current.id);
        store.close();
    });

    it('5. queries strict candidates without superseded or contradicted nodes', () => {
        const store = new SqliteStore(':memory:');
        const old = node('old', 'I prefer tea');
        const current = node('new', 'I prefer coffee', { valid_from: mar, observed_at: mar, recorded_at: mar });
        const contradicted = node('bad', 'server is in Finland', {}, 'contradicted');
        store.save_batch([old, current, contradicted]);
        store.execute_edge_transaction(supersedes(current.id, old.id));

        const ids = store.query_strict_candidates({ at: apr }).map((item) => item.id);
        expect(ids).toEqual([current.id]);
        store.close();
    });

    it('6. recovers nodes and sketches after restart', () => {
        const path = db_path();
        const original = node('restart', 'restart-safe memory');
        const sketches = new MemorySketches().add('entities', 'alice', 12);
        const first = new SqliteStore(path, { tenant_id: 'tenant', user_id: 'user' });
        first.save_node(original);
        first.save_sketch_state('global', sketches, apr);
        first.close();

        const reopened = new SqliteStore(path, { tenant_id: 'tenant', user_id: 'user', file_must_exist: true });
        expect(reopened.load_node(original.id)).toEqual(original);
        expect(reopened.load_sketch_state('global')?.estimate('entities', 'alice')).toBeGreaterThanOrEqual(12);
        expect(reopened.startup_integrity_report.ok).toBe(true);
        reopened.close();
    });

    it('replays uncheckpointed sketch operations after an interrupted ingest', () => {
        const path = db_path();
        const engine = new IngestEngine({ now: () => jan });
        const first = new SqliteStore(path, { tenant_id: 'tenant', user_id: 'user' });
        first.save_sketch_state('global', engine.sketches, jan);
        const ingested = engine.ingest({ user_id: 'user', text: 'I prefer jasmine tea', at: mar, tags: ['jasmine'] });
        first.persist_ingest(ingested);
        first.close();

        const reopened = new SqliteStore(path, { tenant_id: 'tenant', user_id: 'user', file_must_exist: true });
        expect(reopened.load_sketch_state('global')?.estimate('tags', 'jasmine')).toBe(1);
        reopened.close();
    });

    it('stores world memberships separately from compact world metadata', () => {
        const engine = new IngestEngine({ now: () => jan });
        const store = new SqliteStore(':memory:');
        const first = engine.ingest({ user_id: 'default', text: 'First project note', conversation_id: 'thread', at: jan });
        const second = engine.ingest({ user_id: 'default', text: 'Second project note', conversation_id: 'thread', at: mar });
        store.save_batch(engine.graph.node_list(), engine.graph.edge_list());
        for (const world of engine.worlds.world_list()) store.save_world(world);

        const child = engine.worlds.get_world(first.node.world.world_id)!;
        const row = store.database.prepare(`SELECT world_json FROM worlds WHERE world_id=?`).get(child.id) as { world_json: string };
        expect(JSON.parse(row.world_json)).toMatchObject({ node_refs: [], edge_refs: [] });
        const loaded = store.load_worlds().find((world) => world.id === child.id)!;
        expect(loaded.node_refs).toEqual(expect.arrayContaining([first.node.id, second.node.id]));
        expect(loaded.edge_refs).toEqual(second.edges.map((edge) => edge.id));
        store.close();
    });

    it('7. integrity check catches hash mismatch and skips corrupted load safely', () => {
        const store = new SqliteStore(':memory:');
        const original = node('corrupt', 'protected content');
        store.save_node(original);
        store.database.prepare(`UPDATE hydro_nodes
            SET node_json = json_set(node_json, '$.content_hash', 'bad-hash')
            WHERE tenant_id=? AND user_id=? AND node_id=?`)
            .run(store.tenant_id, store.user_id, original.id);

        const report = store.check_integrity();
        expect(report.ok).toBe(false);
        expect(report.issues.some((issue) => issue.code === 'hash_mismatch' && issue.record_id === original.id)).toBe(true);
        expect(store.load_node(original.id)).toBeNull();
        store.close();
    });

    it('8. passes SQLite store benchmark smoke workload', () => {
        const store = new SqliteStore(':memory:', { startup_integrity_check: false });
        const start = performance.now();
        const nodes = Array.from({ length: 250 }, (_, index) => node(`smoke:${index}`, `benchmark memory ${index}`));
        store.save_batch(nodes);
        const current = store.query_current_truth({ at: apr, limit: 300 });
        const elapsed = performance.now() - start;

        expect(current).toHaveLength(250);
        expect(store.check_integrity().ok).toBe(true);
        expect(elapsed).toBeLessThan(2000);
        store.close();
    });
});