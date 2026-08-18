import { api_error } from './errors.js';

export class concurrency_limiter {
    private active = 0;
    constructor(readonly max_active: number) {}

    enter(): () => void {
        if (this.active >= this.max_active) throw new api_error(503, 'server_busy', 'OpenMemory has reached its active request limit');
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