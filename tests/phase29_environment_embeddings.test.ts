import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import {
    aws_bedrock_embedding_provider,
    create_embedding_environment,
    create_embedding_stack,
    createMemory as create_memory,
    fallback_embedding_provider,
    gemini_embedding_provider,
    load_embedding_environment,
    ollama_embedding_provider,
    openai_embedding_provider,
    synthetic_embedding_provider,
    type embedding_provider_config,
} from '../src/index.js';
import { create_open_memory_server } from '../src/server/app.js';
import { load_server_config } from '../src/server/config.js';
import { concurrency_limiter } from '../src/server/middleware/concurrency.js';

const servers: Server[] = [];
afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve())))));

const config = (over: Partial<embedding_provider_config> = {}): embedding_provider_config => ({
    provider: 'openai', fallback: ['synthetic'], tier: 'deep', dimension: 4,
    timeout_ms: 1_000, max_retries: 0, retry_base_ms: 1,
    openai_api_key: 'openai-key', openai_base_url: 'https://openai.test/v1', openai_model: 'text-embedding-3-small',
    gemini_api_key: 'gemini-key', gemini_base_url: 'https://gemini.test/v1beta', gemini_model: 'gemini-embedding-001',
    gemini_inputs_per_minute: 0,
    ollama_url: 'http://ollama.test', ollama_model: 'nomic-embed-text',
    aws_region: 'us-east-1', aws_model: 'amazon.titan-embed-text-v2:0',
    siray_api_key: 'siray-key', siray_base_url: 'https://siray.test/v1', siray_model: 'text-embedding-3-small',
    local_url: 'http://local.test/embed', local_model: 'local-model', ...over,
});

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('real embedding providers', () => {
    it('calls OpenAI-compatible embeddings with model, dimensions, and bearer auth', async () => {
        let request: { url: string; body: any; authorization: string | null } | null = null;
        const provider = new openai_embedding_provider(config(), {
            fetch: async (input, init) => {
                request = { url: String(input), body: JSON.parse(String(init?.body)), authorization: new Headers(init?.headers).get('authorization') };
                return json({ data: [{ embedding: [3, 4, 0, 0] }] });
            }
        });
        const vector = await provider.embed('Hydrograph memory');
        expect(request).toEqual({ url: 'https://openai.test/v1/embeddings', body: { input: 'Hydrograph memory', model: 'text-embedding-3-small', dimensions: 4 }, authorization: 'Bearer openai-key' });
        expect(vector).toEqual([0.6, 0.8, 0, 0]);
    });

    it('retries OpenAI-compatible servers without dimensions when unsupported', async () => {
        const bodies: any[] = [];
        const provider = new openai_embedding_provider(config(), {
            fetch: async (_input, init) => {
                const body = JSON.parse(String(init?.body)); bodies.push(body);
                return bodies.length === 1 ? json({ error: 'unknown field dimensions' }, 400) : json({ data: [{ embedding: [1, 0, 0, 0, 9] }] });
            }
        });
        expect(await provider.embed('compatible')).toEqual([1, 0, 0, 0]);
        expect(bodies).toEqual([
            { input: 'compatible', model: 'text-embedding-3-small', dimensions: 4 },
            { input: 'compatible', model: 'text-embedding-3-small' },
        ]);
    });

    it('batches OpenAI-compatible embeddings and restores response order', async () => {
        let body: any;
        const provider = new openai_embedding_provider(config(), {
            fetch: async (_input, init) => {
                body = JSON.parse(String(init?.body));
                return json({ data: [{ index: 1, embedding: [0, 3, 0, 0] }, { index: 0, embedding: [2, 0, 0, 0] }] });
            }
        });
        expect(await provider.embed_many(['first', 'second'])).toEqual([[1, 0, 0, 0], [0, 1, 0, 0]]);
        expect(body.input).toEqual(['first', 'second']);
    });

    it('uses Gemini document/query task types and output dimensionality', async () => {
        const tasks: string[] = [];
        const provider = new gemini_embedding_provider(config(), {
            fetch: async (_input, init) => {
                const body = JSON.parse(String(init?.body)); tasks.push(body.taskType);
                return json({ embedding: { values: [1, 0, 0, 0] } });
            }
        });
        await provider.embed('document', { purpose: 'document' });
        await provider.embed('query', { purpose: 'query' });
        expect(tasks).toEqual(['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY']);
    });

    it('throttles Gemini batch inputs without changing order', async () => {
        let now = 0;
        const sleeps: number[] = [];
        const sizes: number[] = [];
        const provider = new gemini_embedding_provider(config({ gemini_inputs_per_minute: 2 }), {
            now: () => now,
            sleep: async (ms) => { sleeps.push(ms); now += ms; },
            fetch: async (_input, init) => {
                const requests = JSON.parse(String(init?.body)).requests;
                sizes.push(requests.length);
                return json({ embeddings: requests.map((_request: unknown, index: number) => ({ values: index ? [0, 1, 0, 0] : [1, 0, 0, 0] })) });
            },
        });
        expect(await provider.embed_many(['first', 'second', 'third'])).toEqual([[1, 0, 0, 0], [0, 1, 0, 0], [1, 0, 0, 0]]);
        expect(sizes).toEqual([2, 1]);
        expect(sleeps).toEqual([60_001]);
    });

    it('supports modern Ollama embeddings', async () => {
        const provider = new ollama_embedding_provider(config(), {
            fetch: async (input, init) => {
                expect(String(input)).toBe('http://ollama.test/api/embed');
                expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'nomic-embed-text', input: 'local memory' });
                return json({ embeddings: [[0, 2, 0, 0]] });
            }
        });
        expect(await provider.embed('local memory')).toEqual([0, 1, 0, 0]);
    });

    it('batches modern Ollama embeddings', async () => {
        const provider = new ollama_embedding_provider(config(), {
            fetch: async (input, init) => {
                expect(String(input)).toBe('http://ollama.test/api/embed');
                expect(JSON.parse(String(init?.body))).toMatchObject({ input: ['first', 'second'] });
                return json({ embeddings: [[2, 0, 0, 0], [0, 3, 0, 0]] });
            }
        });
        expect(await provider.embed_many(['first', 'second'])).toEqual([[1, 0, 0, 0], [0, 1, 0, 0]]);
    });

    it('uses the official Bedrock runtime contract for Titan', async () => {
        let command: any;
        const provider = new aws_bedrock_embedding_provider(config(), {
            bedrock_client: {
                send: async (value) => {
                    command = value;
                    return { body: new TextEncoder().encode(JSON.stringify({ embedding: [0, 0, 5, 0] })) };
                }
            }
        });
        expect(await provider.embed('aws memory')).toEqual([0, 0, 1, 0]);
        expect(command.input.modelId).toBe('amazon.titan-embed-text-v2:0');
    });

    it('falls back deterministically and supports smart hybrid vectors', async () => {
        const failed = { name: 'failed', dimension: 4, embed: async () => { throw new Error('offline'); } };
        const fallback = new fallback_embedding_provider([failed, new synthetic_embedding_provider(4)]);
        expect(await fallback.embed('same text')).toEqual(await fallback.embed('same text'));
        const smart = create_embedding_stack(config({ tier: 'smart' }), { fetch: async () => json({ data: [{ embedding: [1, 0, 0, 0] }] }) });
        const vector = await smart.embed('smart memory');
        expect(vector).toHaveLength(4);
        expect(Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1);
    });

    it('keeps high-dimensional synthetic fallback finite', async () => {
        const provider = new synthetic_embedding_provider(768);
        const vector = await provider.embed('high dimensional fallback');
        expect(vector).toHaveLength(768);
        expect(vector.every(Number.isFinite)).toBe(true);
        expect(Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1);
    });
});

describe('embedding environment and Hydrograph integration', () => {
    it('loads archived aliases and new environment names', () => {
        const loaded = load_embedding_environment({ OM_EMBEDDINGS: 'gemini', OM_EMBEDDING_FALLBACK: 'ollama,synthetic', OM_TIER: 'smart', OM_VEC_DIM: '384', GEMINI_API_KEY: 'key', OPENMEMORY_GEMINI_INPUTS_PER_MINUTE: '90' });
        expect(loaded).toMatchObject({ provider: 'gemini', fallback: ['ollama', 'synthetic'], tier: 'smart', dimension: 384, gemini_api_key: 'key', gemini_inputs_per_minute: 90 });
        expect(create_embedding_environment({ OPENMEMORY_EMBEDDING_PROVIDER: 'synthetic', OPENMEMORY_EMBEDDING_DIMENSION: '32' })?.embedding_provider.dimension).toBe(32);
    });

    it('uses configured vector dimensions for ingest, recall, worlds, and sketches', async () => {
        const provider = new synthetic_embedding_provider(16);
        const memory = create_memory({ embedding_provider: provider, embedding_dimension: 16 });
        const ingested = await memory.ingest({ user_id: 'u1', text: 'Hydrograph uses real embedding providers.' });
        const recalled = await memory.recall({ text: 'embedding providers', mode: 'strict' });
        expect(ingested.node.vectors.semantic).toHaveLength(16);
        expect('items' in recalled && recalled.items.some((item) => item.node.id === ingested.node.id)).toBe(true);
        await memory.close();
    });

    it('caches repeated query embeddings while keeping document purpose distinct', async () => {
        const calls: Array<{ text: string; purpose: string | undefined }> = [];
        const provider = {
            async embed(text: string, context?: { purpose?: 'document' | 'query' }) {
                calls.push({ text, purpose: context?.purpose });
                return [1, 0, 0, 0];
            },
        };
        const memory = create_memory({ embedding_provider: provider, embedding_dimension: 4 });
        await memory.ingest({ user_id: 'u1', text: 'The build uses pnpm' });
        await memory.recall({ text: 'build pnpm', mode: 'historical' });
        await memory.recall({ text: 'build pnpm', mode: 'world_grounded' });
        await memory.recall({ text: 'build pnpm', mode: 'strict' });
        await memory.recall({ text: 'build pnpm', mode: 'associative' });

        expect(calls.map((call) => call.purpose)).toEqual(['document', 'query']);
        await memory.close();
    });
});

describe('archived server runtime environment features', () => {
    it('applies and releases active-request backpressure', () => {
        const limiter = new concurrency_limiter(1);
        const release = limiter.enter();
        expect(() => limiter.enter()).toThrow('active request limit');
        release();
        expect(limiter.current()).toBe(0);
        limiter.enter()();
    });

    async function start(env: NodeJS.ProcessEnv) {
        const server = create_open_memory_server({ config: load_server_config({ OPENMEMORY_DB_PATH: ':memory:', ...env }) });
        servers.push(server);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }

    it('supports archived aliases, CORS, telemetry, payload limits, and runtime reporting', async () => {
        const base = await start({ OM_PORT: '0', OM_API_KEY: 'secret', OM_MAX_PAYLOAD_SIZE: '1024', OM_TELEMETRY: 'true', OM_IDE_ALLOWED_ORIGINS: 'https://ide.test', OM_EMBEDDINGS: 'synthetic', OM_VEC_DIM: '12' });
        const preflight = await fetch(`${base}/v1/stats`, { method: 'OPTIONS', headers: { origin: 'https://ide.test' } });
        expect(preflight.status).toBe(204);
        expect(preflight.headers.get('access-control-allow-origin')).toBe('https://ide.test');
        const runtime = await fetch(`${base}/v1/runtime`, { headers: { 'x-api-key': 'secret' } });
        const payload = await runtime.json() as any;
        expect(payload.data).toMatchObject({ limits: { max_payload_size: 1024, max_active_requests: 64 }, features: { telemetry: true, cors: true, embedding_provider: 'synthetic' } });
        const oversized = await fetch(`${base}/v1/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': 'secret' }, body: JSON.stringify({ user_id: 'u', text: 'x'.repeat(2_000) }) });
        expect(oversized.status).toBe(413);
    });

    it('enforces fixed-window rate limits with archived variables', async () => {
        const base = await start({ OM_RATE_LIMIT_ENABLED: 'true', OM_RATE_LIMIT_WINDOW_MS: '60000', OM_RATE_LIMIT_MAX_REQUESTS: '2' });
        expect((await fetch(`${base}/v1/stats`)).status).toBe(200);
        expect((await fetch(`${base}/v1/stats`)).status).toBe(200);
        const blocked = await fetch(`${base}/v1/stats`);
        expect(blocked.status).toBe(429);
        expect(blocked.headers.get('retry-after')).toBeTruthy();
    });
});