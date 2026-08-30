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
 *  file  : src/core/embeddings/providers.ts
 *  usage : implements the LongMemory providers component
 */

import { deterministic_multilingual_embeddings } from '../i18n/multilingual_embeddings.js';
import type { configured_embedding_provider, embedding_context, embedding_provider_config, embedding_provider_dependencies, embedding_provider_name } from './types.js';
import { normalize_embedding_vector, request_json } from './utility.js';

abstract class remote_provider implements configured_embedding_provider {
    abstract readonly name: string;
    readonly dimension: number;
    protected readonly fetcher: typeof fetch;
    protected readonly now: () => number;
    protected readonly sleep: (ms: number) => Promise<void>;
    constructor(protected readonly config: embedding_provider_config, dependencies: embedding_provider_dependencies) {
        this.dimension = config.dimension;
        this.fetcher = dependencies.fetch ?? fetch;
        this.now = dependencies.now ?? Date.now;
        this.sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    }
    abstract embed(text: string, context?: embedding_context): Promise<number[]>;
    protected request(url: string, init: RequestInit): Promise<any> {
        return request_json(this.fetcher, url, init, this.config);
    }
}

export class openai_embedding_provider extends remote_provider {
    readonly name = 'openai';
    private use_dimensions = true;

    private async embedding_payload(input: string | string[]): Promise<any> {
        if (!this.config.openai_api_key) throw new Error('OpenAI embeddings require OPENAI_API_KEY');
        const url = `${this.config.openai_base_url.replace(/\/$/, '')}/embeddings`;
        const init = (dimensions: boolean): RequestInit => ({
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.openai_api_key}` },
            body: JSON.stringify({ input, model: this.config.openai_model, ...(dimensions ? { dimensions: this.dimension } : {}) }),
        });
        try { return await this.request(url, init(this.use_dimensions)); }
        catch (error) {
            if (!this.use_dimensions || !/400|dimension|unsupported|unknown/i.test(error instanceof Error ? error.message : String(error))) throw error;
            this.use_dimensions = false;
            return this.request(url, init(false));
        }
    }

    async embed(text: string): Promise<number[]> {
        const payload = await this.embedding_payload(text);
        return normalize_embedding_vector(payload.data?.[0]?.embedding, this.dimension);
    }

    async embed_many(texts: string[]): Promise<number[][]> {
        if (!texts.length) return [];
        const payload = await this.embedding_payload(texts);
        const rows = Array.isArray(payload.data) ? [...payload.data] : [];
        if (rows.length !== texts.length) throw new Error(`OpenAI returned ${rows.length} embeddings for ${texts.length} inputs`);
        rows.sort((left, right) => Number(left?.index ?? 0) - Number(right?.index ?? 0));
        return rows.map((row) => normalize_embedding_vector(row?.embedding, this.dimension));
    }
}

export class siray_embedding_provider extends remote_provider {
    readonly name = 'siray';
    async embed(text: string): Promise<number[]> {
        if (!this.config.siray_api_key) throw new Error('Siray embeddings require SIRAY_API_TOKEN');
        const payload = await this.request(`${this.config.siray_base_url.replace(/\/$/, '')}/embeddings`, {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.siray_api_key}` },
            body: JSON.stringify({ input: text, model: this.config.siray_model }),
        });
        return normalize_embedding_vector(payload.data?.[0]?.embedding, this.dimension);
    }
}

export class gemini_embedding_provider extends remote_provider {
    readonly name = 'gemini';
    private static readonly batch_limit = 100;
    private quota_tail: Promise<void> = Promise.resolve();
    private input_times: number[] = [];

    private async reserve_inputs(count: number): Promise<void> {
        const limit = this.config.gemini_inputs_per_minute;
        if (limit <= 0) return;
        if (count > limit) throw new Error(`Gemini embedding batch of ${count} exceeds configured input limit ${limit}`);
        let release = () => { };
        const prior = this.quota_tail;
        this.quota_tail = new Promise<void>((resolve) => { release = resolve; });
        await prior;
        try {
            while (true) {
                const now = this.now();
                this.input_times = this.input_times.filter((at) => now - at < 60_000);
                if (this.input_times.length + count <= limit) {
                    for (let index = 0; index < count; index++) this.input_times.push(now);
                    return;
                }
                await this.sleep(Math.max(1, 60_001 - (now - this.input_times[0])));
            }
        } finally {
            release();
        }
    }

    private request_body(text: string, model: string, context: embedding_context): Record<string, unknown> {
        return {
            model: `models/${model}`,
            content: { parts: [{ text }] },
            taskType: context.purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
            outputDimensionality: this.dimension,
        };
    }

    private endpoint(model: string, method: string): string {
        if (!this.config.gemini_api_key) throw new Error('Gemini embeddings require GEMINI_API_KEY');
        return `${this.config.gemini_base_url.replace(/\/$/, '')}/models/${model}:${method}?key=${encodeURIComponent(this.config.gemini_api_key)}`;
    }

    async embed(text: string, context: embedding_context = {}): Promise<number[]> {
        const model = this.config.gemini_model.replace(/^models\//, '');
        await this.reserve_inputs(1);
        const payload = await this.request(this.endpoint(model, 'embedContent'), {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify(this.request_body(text, model, context)),
        });
        return normalize_embedding_vector(payload.embedding?.values, this.dimension);
    }

    async embed_many(texts: string[], context: embedding_context = {}): Promise<number[][]> {
        if (!texts.length) return [];
        const model = this.config.gemini_model.replace(/^models\//, '');
        const vectors: number[][] = [];
        const batch_limit = Math.min(gemini_embedding_provider.batch_limit, this.config.gemini_inputs_per_minute || gemini_embedding_provider.batch_limit);
        for (let start = 0; start < texts.length; start += batch_limit) {
            const chunk = texts.slice(start, start + batch_limit);
            await this.reserve_inputs(chunk.length);
            const payload = await this.request(this.endpoint(model, 'batchEmbedContents'), {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ requests: chunk.map((text) => this.request_body(text, model, context)) }),
            });
            const embeddings = Array.isArray(payload.embeddings) ? payload.embeddings : [];
            if (embeddings.length !== chunk.length) throw new Error(`Gemini returned ${embeddings.length} embeddings for ${chunk.length} inputs`);
            for (const embedding of embeddings) vectors.push(normalize_embedding_vector(embedding?.values, this.dimension));
        }
        return vectors;
    }
}

export class ollama_embedding_provider extends remote_provider {
    readonly name = 'ollama';
    async embed(text: string): Promise<number[]> {
        const base = this.config.ollama_url.replace(/\/$/, '');
        try {
            const payload = await this.request(`${base}/api/embed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: this.config.ollama_model, input: text, truncate: true }) });
            return normalize_embedding_vector(payload.embeddings?.[0], this.dimension);
        } catch (error) {
            const payload = await this.request(`${base}/api/embeddings`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: this.config.ollama_model, prompt: text }) });
            if (!payload.embedding) throw error;
            return normalize_embedding_vector(payload.embedding, this.dimension);
        }
    }
    async embed_many(texts: string[]): Promise<number[][]> {
        if (!texts.length) return [];
        const payload = await this.request(`${this.config.ollama_url.replace(/\/$/, '')}/api/embed`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: this.config.ollama_model, input: texts, truncate: true }),
        });
        const embeddings = Array.isArray(payload.embeddings) ? payload.embeddings : [];
        if (embeddings.length !== texts.length) throw new Error(`Ollama returned ${embeddings.length} embeddings for ${texts.length} inputs`);
        return embeddings.map((vector: unknown) => normalize_embedding_vector(vector, this.dimension));
    }
}

export class local_http_embedding_provider extends remote_provider {
    readonly name = 'local';
    async embed(text: string): Promise<number[]> {
        if (!this.config.local_url) throw new Error('local embeddings require LONGMEMORY_LOCAL_EMBEDDING_URL or OM_LOCAL_MODEL_URL');
        const payload = await this.request(this.config.local_url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: text, model: this.config.local_model, dimensions: this.dimension }) });
        return normalize_embedding_vector(payload.data?.[0]?.embedding ?? payload.embedding ?? payload.vector, this.dimension);
    }
}

export class aws_bedrock_embedding_provider implements configured_embedding_provider {
    readonly name = 'aws';
    readonly dimension: number;
    private readonly client?: embedding_provider_dependencies['bedrock_client'];
    constructor(private readonly config: embedding_provider_config, dependencies: embedding_provider_dependencies) {
        this.dimension = config.dimension;
        this.client = dependencies.bedrock_client;
    }
    async embed(text: string): Promise<number[]> {
        if (!this.config.aws_region) throw new Error('AWS Bedrock embeddings require AWS_REGION');
        const supported_dimension = [256, 512, 1024].find((value) => value >= this.dimension) ?? 1024;
        const input = { modelId: this.config.aws_model, contentType: 'application/json', accept: 'application/json', body: JSON.stringify({ inputText: text, dimensions: supported_dimension, normalize: true }) };
        let response: { body: Uint8Array };
        if (this.client) response = await this.client.send({ input });
        else {
            const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
            response = await new BedrockRuntimeClient({ region: this.config.aws_region }).send(new InvokeModelCommand(input));
        }
        const payload = JSON.parse(new TextDecoder().decode(response.body));
        return normalize_embedding_vector(payload.embedding, this.dimension);
    }
}

export class synthetic_embedding_provider implements configured_embedding_provider {
    readonly name = 'synthetic';
    private readonly deterministic: deterministic_multilingual_embeddings;
    constructor(readonly dimension: number) { this.deterministic = new deterministic_multilingual_embeddings(dimension); }
    async embed(text: string, _context?: embedding_context): Promise<number[]> { return this.deterministic.embed(text); }
    async embed_many(texts: string[], context?: embedding_context): Promise<number[][]> { return Promise.all(texts.map((text) => this.embed(text, context))); }
}

export function create_named_embedding_provider(name: embedding_provider_name, config: embedding_provider_config, dependencies: embedding_provider_dependencies = {}): configured_embedding_provider {
    if (name === 'openai') return new openai_embedding_provider(config, dependencies);
    if (name === 'gemini') return new gemini_embedding_provider(config, dependencies);
    if (name === 'ollama') return new ollama_embedding_provider(config, dependencies);
    if (name === 'aws') return new aws_bedrock_embedding_provider(config, dependencies);
    if (name === 'local') return new local_http_embedding_provider(config, dependencies);
    if (name === 'siray') return new siray_embedding_provider(config, dependencies);
    return new synthetic_embedding_provider(config.dimension);
}