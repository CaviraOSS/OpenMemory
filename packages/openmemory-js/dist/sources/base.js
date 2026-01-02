"use strict";
/**
 * base source class for openmemory data sources - production grade
 *
 * features:
 * - custom exception hierarchy
 * - logging
 * - retry logic with exponential backoff
 * - rate limiting
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.base_source = exports.rate_limiter = exports.source_fetch_error = exports.source_rate_limit_error = exports.source_config_error = exports.source_auth_error = exports.source_error = void 0;
exports.with_retry = with_retry;
// -- exceptions --
class source_error extends Error {
    source;
    cause;
    constructor(msg, source, cause) {
        super(source ? `[${source}] ${msg}` : msg);
        this.name = 'source_error';
        this.source = source;
        this.cause = cause;
    }
}
exports.source_error = source_error;
class source_auth_error extends source_error {
    constructor(msg, source, cause) {
        super(msg, source, cause);
        this.name = 'source_auth_error';
    }
}
exports.source_auth_error = source_auth_error;
class source_config_error extends source_error {
    constructor(msg, source, cause) {
        super(msg, source, cause);
        this.name = 'source_config_error';
    }
}
exports.source_config_error = source_config_error;
class source_rate_limit_error extends source_error {
    retry_after;
    constructor(msg, retry_after, source) {
        super(msg, source);
        this.name = 'source_rate_limit_error';
        this.retry_after = retry_after;
    }
}
exports.source_rate_limit_error = source_rate_limit_error;
class source_fetch_error extends source_error {
    constructor(msg, source, cause) {
        super(msg, source, cause);
        this.name = 'source_fetch_error';
    }
}
exports.source_fetch_error = source_fetch_error;
// -- rate limiter --
class rate_limiter {
    rps;
    tokens;
    last_update;
    constructor(requests_per_second = 10) {
        this.rps = requests_per_second;
        this.tokens = requests_per_second;
        this.last_update = Date.now();
    }
    async acquire() {
        const now = Date.now();
        const elapsed = (now - this.last_update) / 1000;
        this.tokens = Math.min(this.rps, this.tokens + elapsed * this.rps);
        this.last_update = now;
        if (this.tokens < 1) {
            const wait_time = ((1 - this.tokens) / this.rps) * 1000;
            await new Promise(r => setTimeout(r, wait_time));
            this.tokens = 0;
        }
        else {
            this.tokens -= 1;
        }
    }
}
exports.rate_limiter = rate_limiter;
// -- retry helper --
async function with_retry(fn, max_attempts = 3, base_delay = 1000, max_delay = 60000) {
    let last_err = null;
    for (let attempt = 0; attempt < max_attempts; attempt++) {
        try {
            return await fn();
        }
        catch (e) {
            last_err = e;
            if (e instanceof source_auth_error) {
                throw e; // don't retry auth errors
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
// -- base source --
class base_source {
    name = 'base';
    user_id;
    _connected = false;
    _max_retries;
    _rate_limiter;
    constructor(user_id, config) {
        this.user_id = user_id || 'anonymous';
        this._max_retries = config?.max_retries || 3;
        this._rate_limiter = new rate_limiter(config?.requests_per_second || 10);
    }
    get connected() {
        return this._connected;
    }
    async connect(creds) {
        console.log(`[${this.name}] connecting...`);
        try {
            const result = await this._connect(creds || {});
            this._connected = result;
            if (result) {
                console.log(`[${this.name}] connected`);
            }
            return result;
        }
        catch (e) {
            console.error(`[${this.name}] connection failed: ${e.message}`);
            throw new source_auth_error(e.message, this.name, e);
        }
    }
    async disconnect() {
        this._connected = false;
        console.log(`[${this.name}] disconnected`);
    }
    async list_items(filters) {
        if (!this._connected) {
            await this.connect();
        }
        await this._rate_limiter.acquire();
        try {
            const items = await with_retry(() => this._list_items(filters || {}), this._max_retries);
            console.log(`[${this.name}] found ${items.length} items`);
            return items;
        }
        catch (e) {
            throw new source_fetch_error(e.message, this.name, e);
        }
    }
    async fetch_item(item_id) {
        if (!this._connected) {
            await this.connect();
        }
        await this._rate_limiter.acquire();
        try {
            return await with_retry(() => this._fetch_item(item_id), this._max_retries);
        }
        catch (e) {
            throw new source_fetch_error(e.message, this.name, e);
        }
    }
    async ingest_all(filters) {
        const { ingestDocument } = await Promise.resolve().then(() => __importStar(require('../ops/ingest')));
        const items = await this.list_items(filters);
        const ids = [];
        const errors = [];
        console.log(`[${this.name}] ingesting ${items.length} items...`);
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                const content = await this.fetch_item(item.id);
                const result = await ingestDocument(content.type || 'text', content.data || content.text || '', { source: this.name, ...content.meta }, undefined, this.user_id);
                ids.push(result.root_memory_id);
            }
            catch (e) {
                console.warn(`[${this.name}] failed to ingest ${item.id}: ${e.message}`);
                errors.push({ id: item.id, error: e.message });
            }
        }
        console.log(`[${this.name}] ingested ${ids.length} items, ${errors.length} errors`);
        return ids;
    }
    _get_env(key, default_val) {
        return process.env[key] || default_val;
    }
}
exports.base_source = base_source;
