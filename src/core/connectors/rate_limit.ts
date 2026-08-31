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
 *  file  : src/core/connectors/rate_limit.ts
 *  usage : implements the LongMemory rate limit component
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