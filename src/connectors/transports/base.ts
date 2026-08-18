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
 *  file  : src/connectors/transports/base.ts
 *  usage : resilient connector transport runtime
 */

import type { source_adapter, source_capability, source_context, source_credentials, source_document, source_page, source_query } from './types.js';

export class connector_transport_error extends Error {
    constructor(readonly code: string, message: string, readonly source_id: string, readonly status: number | null = null, readonly retryable = false) {
        super(message);
    }
}

export type connector_transport_options = {
    max_retries?: number;
    requests_per_second?: number;
    retry_base_ms?: number;
    timeout_ms?: number;
    fetch?: typeof fetch;
};

export abstract class connector_transport implements source_adapter {
    abstract readonly id: string;
    abstract readonly display_name: string;
    abstract readonly capabilities: readonly source_capability[];
    protected credentials: source_credentials = {};
    protected connected = false;
    protected readonly fetcher: typeof fetch;
    protected readonly max_retries: number;
    protected readonly retry_base_ms: number;
    protected readonly timeout_ms: number;
    private readonly interval_ms: number;
    private next_request_at = 0;

    constructor(options: connector_transport_options = {}) {
        this.fetcher = options.fetch ?? fetch;
        this.max_retries = options.max_retries ?? 3;
        this.retry_base_ms = options.retry_base_ms ?? 250;
        this.timeout_ms = options.timeout_ms ?? 30_000;
        this.interval_ms = 1_000 / Math.max(0.1, options.requests_per_second ?? 10);
    }

    async connect(credentials: source_credentials = {}, context: source_context = {}): Promise<void> {
        context.signal?.throwIfAborted();
        this.credentials = { ...credentials };
        await this.on_connect(context);
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        await this.on_disconnect();
        this.connected = false;
        this.credentials = {};
    }

    async list(query: source_query = {}, context: source_context = {}): Promise<source_page> {
        await this.ensure_connected(context);
        return this.with_retry(() => this.list_items(query, context), context);
    }

    async fetch(item_id: string, context: source_context = {}): Promise<source_document> {
        await this.ensure_connected(context);
        return this.with_retry(() => this.fetch_item(item_id, context), context);
    }

    protected async on_connect(_context: source_context): Promise<void> {}
    protected async on_disconnect(): Promise<void> {}
    protected abstract list_items(query: source_query, context: source_context): Promise<source_page>;
    protected abstract fetch_item(item_id: string, context: source_context): Promise<source_document>;

    protected async request(url: string | URL, init: RequestInit = {}, context: source_context = {}): Promise<Response> {
        await this.throttle(context.signal);
        const timeout = AbortSignal.timeout(this.timeout_ms);
        const signal = context.signal ? AbortSignal.any([context.signal, timeout]) : timeout;
        const response = await this.fetcher(url, { ...init, signal });
        if (response.ok || response.status === 304) return response;
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        const detail = (await response.text()).slice(0, 1_000);
        throw new connector_transport_error('http_error', `${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`, this.id, response.status, retryable);
    }

    protected credential(name: string, env_names: readonly string[] = []): string | undefined {
        return this.credentials[name] ?? env_names.map((key) => process.env[key]).find((value) => value !== undefined);
    }

    private async ensure_connected(context: source_context): Promise<void> {
        if (!this.connected) await this.connect({}, context);
    }

    private async throttle(signal?: AbortSignal): Promise<void> {
        signal?.throwIfAborted();
        const now = Date.now();
        const delay = Math.max(0, this.next_request_at - now);
        this.next_request_at = Math.max(now, this.next_request_at) + this.interval_ms;
        if (!delay) return;
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(signal.reason);
            }, { once: true });
        });
    }

    private async with_retry<T>(operation: () => Promise<T>, context: source_context): Promise<T> {
        let last: unknown;
        for (let attempt = 0; attempt <= this.max_retries; attempt++) {
            context.signal?.throwIfAborted();
            try {
                return await operation();
            } catch (error) {
                last = error;
                const retryable = error instanceof connector_transport_error && error.retryable;
                if (!retryable || attempt === this.max_retries) throw error;
                const delay = this.retry_base_ms * 2 ** attempt + Math.floor(Math.random() * 50);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        throw last;
    }
}