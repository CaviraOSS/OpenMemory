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