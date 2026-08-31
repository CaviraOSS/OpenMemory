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
 *  file  : src/cli/output/spinner.ts
 *  usage : implements the LongMemory spinner component
 */


import type { cli_context } from '../context/cli_context.js';

export class spinner {
    private timer: NodeJS.Timeout | null = null;
    private frame = 0;
    private readonly frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    constructor(private readonly context: cli_context, private readonly label: string) {}
    start(): this {
        if (!this.context.human || !this.context.is_tty || this.context.silent) return this;
        this.timer = setInterval(() => this.context.io.stderr(`\r${this.context.colors.info(this.frames[this.frame++ % this.frames.length])} ${this.label}`), 80);
        this.timer.unref();
        return this;
    }
    stop(message = ''): void {
        if (!this.timer) return;
        clearInterval(this.timer); this.timer = null;
        this.context.io.stderr(`\r${' '.repeat(this.label.length + 4)}\r${message}${message ? '\n' : ''}`);
    }
}

export async function with_spinner<T>(context: cli_context, label: string, operation: () => Promise<T>): Promise<T> {
    const value = new spinner(context, label).start();
    try { return await operation(); } finally { value.stop(); }
}