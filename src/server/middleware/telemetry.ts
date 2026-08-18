export type runtime_metrics_snapshot = {
    enabled: boolean;
    started_at: number;
    uptime_ms: number;
    requests: number;
    errors: number;
    average_duration_ms: number;
    routes: Record<string, { requests: number; errors: number; average_duration_ms: number }>;
};

type metric = { requests: number; errors: number; duration_ms: number };

export class local_runtime_metrics {
    readonly started_at = Date.now();
    private total: metric = { requests: 0, errors: 0, duration_ms: 0 };
    private readonly routes = new Map<string, metric>();
    constructor(readonly enabled: boolean) {}

    observe(route: string, status: number, duration_ms: number): void {
        if (!this.enabled) return;
        const error = status >= 400 ? 1 : 0;
        this.total.requests++; this.total.errors += error; this.total.duration_ms += duration_ms;
        const value = this.routes.get(route) ?? { requests: 0, errors: 0, duration_ms: 0 };
        value.requests++; value.errors += error; value.duration_ms += duration_ms;
        this.routes.set(route, value);
    }

    snapshot(now = Date.now()): runtime_metrics_snapshot {
        const view = (value: metric) => ({ requests: value.requests, errors: value.errors, average_duration_ms: value.requests ? value.duration_ms / value.requests : 0 });
        return { enabled: this.enabled, started_at: this.started_at, uptime_ms: now - this.started_at, ...view(this.total), routes: Object.fromEntries([...this.routes].map(([route, value]) => [route, view(value)])) };
    }
}