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
 *  file  : src/core/connectors/rate_limit.ts
 *  usage : connector token-bucket rate limiting
 */

export class connector_rate_limiter {
    private tokens: number;
    private updated_at = Date.now();

    constructor(readonly requests_per_second = 5, readonly burst = requests_per_second) {
        this.tokens = burst;
    }

    async acquire(signal?: AbortSignal): Promise<void> {
        signal?.throwIfAborted();
        const now = Date.now();
        this.tokens = Math.min(this.burst, this.tokens + (now - this.updated_at) / 1_000 * this.requests_per_second);
        this.updated_at = now;
        if (this.tokens >= 1) {
            this.tokens--;
            return;
        }
        const delay = Math.ceil((1 - this.tokens) / this.requests_per_second * 1_000);
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, delay);
            signal?.addEventListener('abort', () => {
                clearTimeout(timer);
                reject(signal.reason);
            }, { once: true });
        });
        this.tokens = 0;
        this.updated_at = Date.now();
    }
}