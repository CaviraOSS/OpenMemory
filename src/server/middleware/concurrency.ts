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
 *  file  : src/server/middleware/concurrency.ts
 *  usage : implements the LongMemory concurrency component
 */


import { api_error } from './errors.js';

export class concurrency_limiter {
    private active = 0;
    constructor(readonly max_active: number) {}

    enter(): () => void {
        if (this.active >= this.max_active) throw new api_error(503, 'server_busy', 'LongMemory has reached its active request limit');
        this.active++;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.active--;
        };
    }

    current(): number { return this.active; }
}