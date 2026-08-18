import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemory as create_memory } from '../src/index.js';
import { migrate_legacy, write_migration_report } from '../src/core/migration/index.js';

const jan = Date.UTC(2026, 0, 1);
const mar = Date.UTC(2026, 2, 1);
const apr = Date.UTC(2026, 3, 1);
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function paths() {
    const dir = mkdtempSync(join(tmpdir(), 'openmemory-legacy-'));
    dirs.push(dir);
    return { dir, source: join(dir, 'legacy.json'), destination: join(dir, 'hydro.db'), report: join(dir, 'report.json') };
}

async function migrate(records: unknown[], relations: unknown[] = []) {
    const target = paths();
    writeFileSync(target.source, JSON.stringify({ memories: records, relations }), 'utf8');
    const report = await migrate_legacy({ from: target.source, to: target.destination });
    return { ...target, migration: report };
}

describe('phase 22 legacy migration', () => {
    it('1. imports an old preference as a strict semantic memory', async () => {
        const target = await migrate([{ id: 'pref', user_id: 'u1', content: 'I prefer tea', primary_sector: 'semantic', created_at: jan }]);
        const memory = await create_memory({ store: 'sqlite', db_path: target.destination });
        const recalled = await memory.recall({ text: 'what do I prefer', mode: 'strict', now: apr });
        expect(recalled).toHaveProperty('items');
        expect('items' in recalled && recalled.items[0]?.node.content.raw).toBe('I prefer tea');
        expect('items' in recalled && recalled.items[0]?.node.facets.semantic?.value).toBe('I prefer tea');
        await memory.close();
    });

    it('2. converts changed preferences into a supersession chain', async () => {
        const target = await migrate([
            { id: 'old', user_id: 'u1', content: 'I prefer tea', sector: 'preference', created_at: jan },
            { id: 'new', user_id: 'u1', content: 'I now prefer coffee instead of tea', sector: 'preference', created_at: mar },
        ]);
        const memory = await create_memory({ store: 'sqlite', db_path: target.destination });
        const strict = await memory.recall({ text: 'what do I prefer', mode: 'strict', now: apr });
        const historical = await memory.recall({ text: 'what did I prefer', mode: 'historical', now: apr, valid_time: jan + 1 });
        const old = await memory.explain('legacy:old');
        expect('items' in strict && strict.items.map((item) => item.node.id)).toContain('legacy:new');
        expect('items' in strict && strict.items.map((item) => item.node.id)).not.toContain('legacy:old');
        expect('timeline' in historical && historical.timeline.world_truth_at_time.map((item) => item.id)).toContain('legacy:old');
        expect(old.incoming_edges.some((edge) => edge.type === 'supersedes' && edge.from === 'legacy:new')).toBe(true);
        await memory.close();
    });

    it('3. collapses duplicate records into one strict memory', async () => {
        const target = await migrate([
            { id: 'a', user_id: 'u1', content: 'I prefer tea', sector: 'semantic', created_at: jan },
            { id: 'b', user_id: 'u1', content: '  I PREFER TEA  ', sector: 'semantic', created_at: jan + 1 },
        ]);
        const memory = await create_memory({ store: 'sqlite', db_path: target.destination });
        const recalled = await memory.recall({ text: 'what do I prefer', mode: 'strict', now: apr });
        expect(target.migration.detected_duplicates).toHaveLength(1);
        expect(target.migration.imported_nodes).toBe(1);
        expect('items' in recalled && recalled.items).toHaveLength(1);
        await memory.close();
    });

    it('4. skips corrupted records without aborting useful migration', async () => {
        const target = await migrate([
            { id: 'good', user_id: 'u1', content: 'I prefer tea', sector: 'semantic', created_at: jan },
            { id: 'missing' },
            'broken',
            { id: 'garbage', content: '!!!' },
        ]);
        expect(target.migration.imported_nodes).toBe(1);
        expect(target.migration.skipped_records.map((item) => item.record_id)).toEqual(expect.arrayContaining(['missing', 'record:3', 'garbage']));
        expect(target.migration.benchmark_result.passed).toBe(true);
    });

    it('5. keeps stale old facts out of strict recall', async () => {
        const target = await migrate([{ id: 'stale', user_id: 'u1', content: 'I prefer tea', sector: 'preference', created_at: jan, status: 'stale' }]);
        const memory = await create_memory({ store: 'sqlite', db_path: target.destination });
        const strict = await memory.recall({ text: 'what do I prefer', mode: 'strict', now: apr });
        const historical = await memory.recall({ text: 'what did I prefer', mode: 'historical', now: apr, valid_time: jan });
        expect('items' in strict && strict.items).toHaveLength(0);
        expect('timeline' in historical && historical.timeline.world_truth_at_time.map((item) => item.id)).toContain('legacy:stale');
        await memory.close();
    });

    it('6. writes a complete migration report', async () => {
        const target = await migrate([{ id: 'pref', user_id: 'u1', content: 'I prefer tea', sector: 'semantic', created_at: jan }]);
        const path = write_migration_report(target.migration, target.report);
        const saved = JSON.parse(readFileSync(path, 'utf8')) as typeof target.migration;
        expect(saved.imported_nodes).toBe(1);
        expect(saved).toHaveProperty('imported_edges');
        expect(saved).toHaveProperty('created_worlds');
        expect(saved).toHaveProperty('created_entities');
        expect(saved).toHaveProperty('detected_duplicates');
        expect(saved).toHaveProperty('contradictions_found');
        expect(saved).toHaveProperty('skipped_records');
        expect(saved).toHaveProperty('errors');
        expect(saved).toHaveProperty('benchmark_result');
    });

    it('7. passes the post-migration database benchmark smoke test', async () => {
        const target = await migrate([{ id: 'pref', user_id: 'u1', content: 'I prefer tea', sector: 'semantic', created_at: jan }]);
        expect(target.migration.benchmark_result.passed).toBe(true);
        expect(target.migration.benchmark_result.checks.every((check) => check.passed)).toBe(true);
    });

    it('maps episodes, source-backed external facts, contradictions, and supported relations', async () => {
        const target = await migrate([
            { id: 'episode', user_id: 'u1', content: 'I visited Kyoto with Alice and spent the afternoon exploring temples.', sector: 'episodic', created_at: jan },
            { id: 'external', user_id: 'u1', content: 'The deployment region is Sweden', sector: 'external', source_id: 'ops-db', source_kind: 'database', created_at: jan },
            { id: 'claim-a', user_id: 'u1', content: 'The server is in Finland', sector: 'semantic', created_at: jan },
            { id: 'claim-b', user_id: 'u1', content: 'The server is in Sweden', sector: 'semantic', created_at: mar },
        ], [{ id: 'waypoint', src_id: 'episode', dst_id: 'external', type: 'related', weight: 0.7, created_at: mar }]);
        const memory = await create_memory({ store: 'sqlite', db_path: target.destination });
        const episode = await memory.explain('legacy:episode');
        const external = await memory.explain('legacy:external');
        expect(episode.node?.facets.episodic?.value).toContain('Kyoto');
        expect(external.node?.world.zone).toBe('exocortex');
        expect(episode.outgoing_edges.some((edge) => edge.type === 'refers_to' && edge.to === 'legacy:external')).toBe(true);
        expect(target.migration.contradictions_found).toBeGreaterThanOrEqual(1);
        await memory.close();
    });

    it('reads historical memories and waypoints tables from SQLite', async () => {
        const target = paths();
        const legacy = new Database(target.source);
        legacy.exec(`
            CREATE TABLE memories (
                id TEXT PRIMARY KEY, user_id TEXT, project_id TEXT, segment TEXT,
                primary_sector TEXT, tags TEXT, meta TEXT, created_at INTEGER,
                updated_at INTEGER, last_seen_at INTEGER
            );
            CREATE TABLE waypoints (
                id TEXT PRIMARY KEY, src_id TEXT, dst_id TEXT, type TEXT,
                weight REAL, created_at INTEGER
            );
        `);
        legacy.prepare('INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            'sqlite-a', 'u1', 'personal', 'I prefer tea', 'semantic', '["preference"]', '{}', jan, jan, jan,
        );
        legacy.prepare('INSERT INTO memories VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            'sqlite-b', 'u1', 'personal', 'I visited Kyoto with Alice', 'episodic', '[]', '{}', mar, mar, mar,
        );
        legacy.prepare('INSERT INTO waypoints VALUES (?, ?, ?, ?, ?, ?)').run(
            'sqlite-waypoint', 'sqlite-b', 'sqlite-a', 'related', 0.8, mar,
        );
        legacy.close();
        const report = await migrate_legacy({ from: target.source, to: target.destination });
        const memory = await create_memory({ store: 'sqlite', db_path: target.destination });
        const episode = await memory.explain('legacy:sqlite-b');
        expect(report.source_format).toBe('sqlite');
        expect(report.imported_nodes).toBe(2);
        expect(episode.outgoing_edges.some((edge) => edge.type === 'refers_to' && edge.to === 'legacy:sqlite-a')).toBe(true);
        await memory.close();
    });
});