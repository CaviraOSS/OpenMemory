import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as pkg from '../src/index.js';

const jan = Date.UTC(2026, 0, 1);
const mar = Date.UTC(2026, 2, 1);
const apr = Date.UTC(2026, 3, 1);
const dirs: string[] = [];

afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const sqlite_path = () => {
    const dir = mkdtempSync(join(tmpdir(), 'openmemory-public-'));
    dirs.push(dir);
    return join(dir, 'memory.db');
};

describe('phase 19 public package api', () => {
    it('1. imports createMemory from the package root', () => {
        expect(typeof pkg.createMemory).toBe('function');
    });

    it('2. creates an in-memory engine without setup', async () => {
        const memory = await pkg.createMemory();
        expect(memory.status().ready).toBe(true);
        expect((await memory.getStats()).store).toBe('memory');
        await memory.close();
    });

    it('3. ingests a semantic endocortex preference', async () => {
        const memory = await pkg.createMemory();
        const result = await memory.ingest({ user_id: 'u1', text: 'I prefer tea', at: jan });
        expect(result.node.facets.semantic?.value).toBe('I prefer tea');
        expect(result.node.world.zone).toBe('endocortex');
        await memory.close();
    });

    it('4. strict recall returns only the current preference', async () => {
        const memory = await pkg.createMemory();
        const old = await memory.ingest({ user_id: 'u1', text: 'I prefer tea', at: jan });
        const current = await memory.ingest({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: mar });
        const recalled = await memory.recall({ text: 'what do I prefer', mode: 'strict', now: apr });
        expect('items' in recalled).toBe(true);
        const ids = 'items' in recalled ? recalled.items.map((item) => item.node.id) : [];
        expect(ids).toContain(current.node.id);
        expect(ids).not.toContain(old.node.id);
        await memory.close();
    });

    it('5. historical recall returns the old preference at past valid time', async () => {
        const memory = await pkg.createMemory();
        const old = await memory.ingest({ user_id: 'u1', text: 'I prefer tea', at: jan });
        await memory.ingest({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: mar });
        const recalled = await memory.recall({ text: 'what did I prefer', mode: 'historical', now: apr, valid_time: jan + 1 });
        expect('timeline' in recalled).toBe(true);
        const ids = 'timeline' in recalled ? recalled.timeline.world_truth_at_time.map((node) => node.id) : [];
        expect(ids).toContain(old.node.id);
        await memory.close();
    });

    it('6. explains a memory and its executable edges', async () => {
        const memory = await pkg.createMemory();
        const old = await memory.ingest({ user_id: 'u1', text: 'I prefer tea', at: jan });
        const current = await memory.ingest({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: mar });
        const explanation = await memory.explain(old.node.id);
        expect(explanation.node?.id).toBe(old.node.id);
        expect(explanation.incoming_edges.some((edge) => edge.from === current.node.id && edge.type === 'supersedes')).toBe(true);
        expect(explanation.ingest).not.toBeNull();
        await memory.close();
    });

    it('7. closes idempotently and rejects further operations', async () => {
        const memory = await pkg.createMemory();
        await memory.close();
        await memory.close();
        expect(memory.status().ready).toBe(false);
        await expect(memory.recall({ text: 'anything' })).rejects.toThrow('closed');
    });

    it('8. creates and recovers a SQLite-backed engine', async () => {
        const db_path = sqlite_path();
        const first = await pkg.createMemory({ store: 'sqlite', db_path, tenant_id: 't1', user_id: 'u1' });
        const ingested = await first.ingest({ user_id: 'u1', text: 'I prefer coffee', at: jan });
        await first.close();

        const reopened = await pkg.createMemory({ store: 'sqlite', db_path, tenant_id: 't1', user_id: 'u1' });
        const explanation = await reopened.explain(ingested.node.id);
        expect(explanation.node?.content.raw).toBe('I prefer coffee');
        expect((await reopened.getStats()).nodes).toBe(1);
        const changed = await reopened.ingest({ user_id: 'u1', text: 'I now prefer tea instead of coffee', at: mar });
        expect(changed.edges.some((edge) => edge.type === 'supersedes' && edge.to === ingested.node.id)).toBe(true);
        expect((await reopened.getStats()).nodes).toBe(2);
        await reopened.close();
    });

    it('exposes worlds, entities, timeline, and stats without internal wiring', async () => {
        const memory = await pkg.createMemory({ default_world: 'personal' });
        const ingested = await memory.ingest({
            user_id: 'u1',
            text: 'Alice Chen prefers tea',
            at: jan,
            entity_hints: [{ name: 'Alice Chen', type: 'person', aliases: ['A. Chen'] }],
        });
        const entity_id = ingested.diff.resolved_entities[0].id;
        const world = await memory.getWorld(ingested.node.world.world_id);
        const worlds = await memory.listWorlds({ zone: 'endocortex' });
        const entity = await memory.getEntity(entity_id);
        const resolved = await memory.resolveEntity({ name: 'A. Chen', observed_at: mar });
        const timeline = await memory.getTimeline({ now: apr, valid_time: jan + 1 });
        const stats = await memory.getStats();

        expect(world?.name).toBe('personal');
        expect(worlds.some((item) => item.id === world?.id)).toBe(true);
        expect(entity?.canonical_name).toBe('Alice Chen');
        expect(resolved.entity.id).toBe(entity_id);
        expect(timeline.timeline.entries.some((entry) => entry.id === ingested.node.id)).toBe(true);
        expect(stats.nodes).toBe(1);
        expect(stats.entities).toBeGreaterThanOrEqual(1);
        await memory.close();
    });
});