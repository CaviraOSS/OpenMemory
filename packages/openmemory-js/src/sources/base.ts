/**
 * base source class for openmemory data sources - production grade
 *
 * features:
 * - custom exception hierarchy
 * - logging
 * - retry logic with exponential backoff
 * - rate limiting
 */



export class source_error extends Error {
    source?: string;
    cause?: Error;

    constructor(msg: string, source?: string, cause?: Error) {
        super(source ? `[${source}] ${msg}` : msg);
        this.name = 'source_error';
        this.source = source;
        this.cause = cause;
    }
}

export class source_auth_error extends source_error {
    constructor(msg: string, source?: string, cause?: Error) {
        super(msg, source, cause);
        this.name = 'source_auth_error';
    }
}

export class source_config_error extends source_error {
    constructor(msg: string, source?: string, cause?: Error) {
        super(msg, source, cause);
        this.name = 'source_config_error';
    }
}

export class source_rate_limit_error extends source_error {
    retry_after?: number;

    constructor(msg: string, retry_after?: number, source?: string) {
        super(msg, source);
        this.name = 'source_rate_limit_error';
        this.retry_after = retry_after;
    }
}

export class source_fetch_error extends source_error {
    constructor(msg: string, source?: string, cause?: Error) {
        super(msg, source, cause);
        this.name = 'source_fetch_error';
    }
}



export interface source_item {
    id: string;
    name: string;
    type: string;
    [key: string]: any;
}

export interface source_content {
    id: string;
    name: string;
    type: string;
    text: string;
    data: string | Buffer;
    meta: Record<string, any>;
}

export interface source_config {
    max_retries?: number;
    requests_per_second?: number;
    log_level?: 'debug' | 'info' | 'warn' | 'error';
}



export class rate_limiter {
    private rps: number;
    private tokens: number;
    private last_update: number;

    constructor(requests_per_second: number = 10) {
        this.rps = requests_per_second;
        this.tokens = requests_per_second;
        this.last_update = Date.now();
    }

    async acquire(): Promise<void> {
        const now = Date.now();
        const elapsed = (now - this.last_update) / 1000;
        this.tokens = Math.min(this.rps, this.tokens + elapsed * this.rps);
        this.last_update = now;

        if (this.tokens < 1) {
            const wait_time = ((1 - this.tokens) / this.rps) * 1000;
            await new Promise(r => setTimeout(r, wait_time));
            this.tokens = 0;
        } else {
            this.tokens -= 1;
        }
    }
}



export async function with_retry<T>(
    fn: () => Promise<T>,
    max_attempts: number = 3,
    base_delay: number = 1000,
    max_delay: number = 60000
): Promise<T> {
    let last_err: Error | null = null;

    for (let attempt = 0; attempt < max_attempts; attempt++) {
        try {
            return await fn();
        } catch (e: any) {
            last_err = e;

            if (e instanceof source_auth_error) {
                throw e;
            }

            if (attempt < max_attempts - 1) {
                const delay = e instanceof source_rate_limit_error && e.retry_after
                    ? e.retry_after * 1000
                    : Math.min(base_delay * Math.pow(2, attempt), max_delay);

                console.warn(`[retry] attempt ${attempt + 1}/${max_attempts} failed: ${e.message}, retrying in ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    throw last_err;
}



export abstract class base_source {
    name: string = 'base';
    user_id: string;
    protected _connected: boolean = false;
    protected _max_retries: number;
    protected _rate_limiter: rate_limiter;

    constructor(user_id?: string, config?: source_config) {
        this.user_id = user_id || 'anonymous';
        this._max_retries = config?.max_retries || 3;
        this._rate_limiter = new rate_limiter(config?.requests_per_second || 10);
    }

    get connected(): boolean {
        return this._connected;
    }

    async connect(creds?: Record<string, any>): Promise<boolean> {
        console.log(`[${this.name}] connecting...`);
        try {
            const result = await this._connect(creds || {});
            this._connected = result;
            if (result) {
                console.log(`[${this.name}] connected`);
            }
            return result;
        } catch (e: any) {
            console.error(`[${this.name}] connection failed: ${e.message}`);
            throw new source_auth_error(e.message, this.name, e);
        }
    }

    async disconnect(): Promise<void> {
        this._connected = false;
        console.log(`[${this.name}] disconnected`);
    }

    async list_items(filters?: Record<string, any>): Promise<source_item[]> {
        if (!this._connected) {
            await this.connect();
        }

        await this._rate_limiter.acquire();

        try {
            const items = await with_retry(
                () => this._list_items(filters || {}),
                this._max_retries
            );
            console.log(`[${this.name}] found ${items.length} items`);
            return items;
        } catch (e: any) {
            throw new source_fetch_error(e.message, this.name, e);
        }
    }

    async fetch_item(item_id: string): Promise<source_content> {
        if (!this._connected) {
            await this.connect();
        }

        await this._rate_limiter.acquire();

        try {
            return await with_retry(
                () => this._fetch_item(item_id),
                this._max_retries
            );
        } catch (e: any) {
            throw new source_fetch_error(e.message, this.name, e);
        }
    }

    async ingest_all(filters?: Record<string, any>): Promise<string[]> {
        const { ingestDocument } = await import('../ops/ingest');

        const items = await this.list_items(filters);
        const ids: string[] = [];
        const errors: { id: string; error: string }[] = [];

        console.log(`[${this.name}] ingesting ${items.length} items...`);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                const content = await this.fetch_item(item.id);
                const result = await ingestDocument(
                    content.type || 'text',
                    content.data || content.text || '',
                    { source: this.name, ...content.meta },
                    undefined,
                    this.user_id
                );
                ids.push(result.root_memory_id);
            } catch (e: any) {
                console.warn(`[${this.name}] failed to ingest ${item.id}: ${e.message}`);
                errors.push({ id: item.id, error: e.message });
            }
        }

        console.log(`[${this.name}] ingested ${ids.length} items, ${errors.length} errors`);
        return ids;
    }

    protected _get_env(key: string, default_val?: string): string | undefined {
        return process.env[key] || default_val;
    }


    protected abstract _connect(creds: Record<string, any>): Promise<boolean>;
    protected abstract _list_items(filters: Record<string, any>): Promise<source_item[]>;
    protected abstract _fetch_item(item_id: string): Promise<source_content>;
}
