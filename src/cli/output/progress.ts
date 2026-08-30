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
 *  file  : src/cli/output/progress.ts
 *  usage : implements the LongMemory progress component
 */

import type { cli_context } from '../context/cli_context.js';

export class progress_bar {
    private current = 0;
    constructor(private readonly context: cli_context, private readonly label: string, private readonly total: number) {}
    update(value: number, detail = ''): void {
        this.current = Math.min(this.total, Math.max(0, value));
        if (!this.context.human || !this.context.is_tty || this.context.silent) return;
        const size = Math.max(10, Math.min(30, this.context.terminal_width - this.label.length - 20));
        const ratio = this.total ? this.current / this.total : 1;
        const filled = Math.round(size * ratio);
        this.context.io.stderr(`\r${this.label} ${this.context.colors.success('█'.repeat(filled))}${this.context.colors.dim('░'.repeat(size - filled))} ${Math.round(ratio * 100)}% ${detail}`);
    }
    finish(detail = ''): void {
        this.update(this.total, detail);
        if (this.context.human && this.context.is_tty && !this.context.silent) this.context.io.stderr('\n');
    }
}