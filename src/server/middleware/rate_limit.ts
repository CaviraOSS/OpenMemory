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
 *  file  : src/server/middleware/rate_limit.ts
 *  usage : implements the LongMemory rate limit component
 */


import type { IncomingMessage, ServerResponse } from 'node:http';
import { api_error } from './errors.js';

export type rate_limit_config = { enabled: boolean; window_ms: number; max_requests: number };
type bucket = { count: number; reset_at: number };

export class fixed_window_rate_limiter {
    private readonly buckets = new Map<string, bucket>();
    constructor(private readonly config: rate_limit_config, private readonly now = Date.now) {}

    check(request: IncomingMessage, response: ServerResponse): void {
        if (!this.config.enabled) return;
        const at = this.now();
        const key = request.socket.remoteAddress ?? 'unknown';
        let value = this.buckets.get(key);
        if (!value || value.reset_at <= at) value = { count: 0, reset_at: at + this.config.window_ms };
        value.count++;
        this.buckets.set(key, value);
        const remaining = Math.max(0, this.config.max_requests - value.count);
        response.setHeader('x-ratelimit-limit', String(this.config.max_requests));
        response.setHeader('x-ratelimit-remaining', String(remaining));
        response.setHeader('x-ratelimit-reset', String(Math.ceil(value.reset_at / 1_000)));
        if (value.count > this.config.max_requests) {
            response.setHeader('retry-after', String(Math.max(1, Math.ceil((value.reset_at - at) / 1_000))));
            throw new api_error(429, 'rate_limit_exceeded', 'Too many requests');
        }
        if (this.buckets.size > 10_000) for (const [id, current] of this.buckets) if (current.reset_at <= at) this.buckets.delete(id);
    }
}