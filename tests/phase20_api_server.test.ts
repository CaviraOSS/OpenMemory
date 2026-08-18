import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { load_server_config } from '../src/server/config.js';
import { create_open_memory_server } from '../src/server/app.js';

const jan = Date.UTC(2026, 0, 1);
const mar = Date.UTC(2026, 2, 1);
const apr = Date.UTC(2026, 3, 1);
const dirs: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    })));
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function start(api_key?: string) {
    const dir = mkdtempSync(join(tmpdir(), 'openmemory-server-'));
    dirs.push(dir);
    const config = load_server_config({
        OPENMEMORY_DB_PATH: join(dir, 'memory.db'),
        ...(api_key ? { OPENMEMORY_API_KEY: api_key } : {}),
    });
    const server = create_open_memory_server({ config });
    servers.push(server);
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    return { server, base: `http://127.0.0.1:${address.port}` };
}

async function json(base: string, path: string, init?: RequestInit) {
    const response = await fetch(`${base}${path}`, init);
    return { response, body: await response.json() as Record<string, any> };
}

const post = (body: unknown, api_key?: string): RequestInit => ({
    method: 'POST',
    headers: {
        'content-type': 'application/json',
        ...(api_key ? { authorization: `Bearer ${api_key}` } : {}),
    },
    body: JSON.stringify(body),
});

describe('phase 20 self-hosted api server', () => {
    it('1. starts with SQLite as the default store', async () => {
        const { server, base } = await start();
        expect(server.listening).toBe(true);
        const { body } = await json(base, '/health');
        expect(body.data.status.store).toBe('sqlite');
    });

    it('2. reports store-aware health and timing metadata', async () => {
        const { base } = await start();
        const { response, body } = await json(base, '/health');
        expect(response.status).toBe(200);
        expect(response.headers.get('server-timing')).toContain('app;dur=');
        expect(body.data.ok).toBe(true);
        expect(body.data.store.closed).toBe(false);
        expect(body.meta.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it('3. ingests through the core engine', async () => {
        const { base } = await start();
        const { response, body } = await json(base, '/v1/ingest', post({ user_id: 'u1', text: 'I prefer tea', at: jan }));
        expect(response.status).toBe(201);
        expect(body.data.node.facets.semantic.value).toBe('I prefer tea');
        expect(body.data.trace).toHaveLength(14);
    });

    it('4. returns strict current truth from the recall endpoint', async () => {
        const { base } = await start();
        const old = await json(base, '/v1/ingest', post({ user_id: 'u1', text: 'I prefer tea', at: jan }));
        const current = await json(base, '/v1/ingest', post({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: mar }));
        const recalled = await json(base, '/v1/recall', post({ text: 'what do I prefer', mode: 'strict', now: apr }));
        const ids = recalled.body.data.items.map((item: { node: { id: string } }) => item.node.id);
        expect(ids).toContain(current.body.data.node.id);
        expect(ids).not.toContain(old.body.data.node.id);
    });

    it('5. returns historical truth through the same recall endpoint', async () => {
        const { base } = await start();
        const old = await json(base, '/v1/ingest', post({ user_id: 'u1', text: 'I prefer tea', at: jan }));
        await json(base, '/v1/ingest', post({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: mar }));
        const recalled = await json(base, '/v1/recall', post({
            text: 'what did I prefer',
            mode: 'historical',
            now: apr,
            valid_time: jan + 1,
        }));
        const ids = recalled.body.data.timeline.world_truth_at_time.map((item: { id: string }) => item.id);
        expect(ids).toContain(old.body.data.node.id);
    });

    it('6. returns the ingest and edge trace from explain', async () => {
        const { base } = await start();
        const old = await json(base, '/v1/ingest', post({ user_id: 'u1', text: 'I prefer tea', at: jan }));
        await json(base, '/v1/ingest', post({ user_id: 'u1', text: 'I now prefer coffee instead of tea', at: mar }));
        const explained = await json(base, `/v1/explain/${encodeURIComponent(old.body.data.node.id)}`);
        expect(explained.body.data.node.id).toBe(old.body.data.node.id);
        expect(explained.body.data.incoming_edges.some((edge: { type: string }) => edge.type === 'supersedes')).toBe(true);
        expect(explained.body.data.ingest.trace).toHaveLength(14);
    });

    it('7. blocks unauthorized v1 requests when an API key is enabled', async () => {
        const { base } = await start('secret');
        const blocked = await json(base, '/v1/stats');
        const allowed = await json(base, '/v1/stats', { headers: { 'x-api-key': 'secret' } });
        expect(blocked.response.status).toBe(401);
        expect(blocked.body.error).toEqual({ code: 'unauthorized', message: 'A valid API key is required' });
        expect(allowed.response.status).toBe(200);
        expect((await json(base, '/health')).response.status).toBe(200);
    });

    it('validates JSON requests and requires an explicit recall mode', async () => {
        const { base } = await start();
        const missing = await json(base, '/v1/recall', post({ text: 'what do I prefer' }));
        const invalid = await json(base, '/v1/ingest', post({ user_id: 'u1' }));
        expect(missing.response.status).toBe(400);
        expect(missing.body.error.code).toBe('validation_error');
        expect(invalid.response.status).toBe(400);
        expect(invalid.body.error.code).toBe('validation_error');
    });

    it('exposes world, entity, timeline, and stats routes', async () => {
        const { base } = await start();
        const ingested = await json(base, '/v1/ingest', post({
            user_id: 'u1',
            text: 'Alice Chen prefers tea',
            at: jan,
            entity_hints: [{ name: 'Alice Chen', type: 'person' }],
        }));
        const world_id = ingested.body.data.node.world.world_id;
        const entity_id = ingested.body.data.diff.resolved_entities[0].id;
        const world = await json(base, `/v1/worlds/${encodeURIComponent(world_id)}`);
        const entity = await json(base, `/v1/entities/${encodeURIComponent(entity_id)}`);
        const timeline = await json(base, `/v1/timeline?valid_time=${jan + 1}`);
        const stats = await json(base, '/v1/stats');
        expect(world.body.data.id).toBe(world_id);
        expect(entity.body.data.id).toBe(entity_id);
        expect(timeline.body.data.timeline.entries.some((item: { id: string }) => item.id === ingested.body.data.node.id)).toBe(true);
        expect(stats.body.data.nodes).toBe(1);
    });
});