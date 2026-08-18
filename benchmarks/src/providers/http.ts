export class http_error extends Error {
    constructor(message: string, readonly status: number, readonly payload: unknown) {
        super(message);
    }
}

export type http_options = {
    base_url: string;
    api_key?: string;
    timeout_ms?: number;
    headers?: Record<string, string>;
    auth_header?: string;
    auth_prefix?: string;
};

export class http_client {
    private readonly base_url: string;
    private readonly headers: Record<string, string>;
    private readonly timeout_ms: number;

    constructor(options: http_options) {
        this.base_url = options.base_url.replace(/\/+$/, "");
        this.timeout_ms = options.timeout_ms ?? 120_000;
        this.headers = { ...options.headers };
        if (options.api_key) this.headers[options.auth_header ?? "authorization"] = `${options.auth_prefix ?? "Bearer "}${options.api_key}`;
    }

    async request(path: string, init: RequestInit = {}): Promise<unknown> {
        const headers: Record<string, string> = { ...this.headers };
        new Headers(init.headers).forEach((value, key) => { headers[key] = value; });
        if (init.body !== undefined && !(init.body instanceof FormData) && headers["content-type"] === undefined) headers["content-type"] = "application/json";
        const response = await fetch(`${this.base_url}${path.startsWith("/") ? path : `/${path}`}`, {
            ...init,
            headers,
            signal: init.signal ?? AbortSignal.timeout(this.timeout_ms),
        });
        const body = await response.text();
        let payload: unknown = null;
        if (body) {
            try { payload = JSON.parse(body); }
            catch { payload = body; }
        }
        if (!response.ok) {
            const detail = typeof payload === "string" ? payload : payload ? JSON.stringify(payload) : "";
            throw new http_error(`http ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 1_000)}` : ""}`, response.status, payload);
        }
        return payload;
    }

    get(path: string): Promise<unknown> {
        return this.request(path);
    }

    post(path: string, body?: unknown): Promise<unknown> {
        return this.request(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
    }

    delete(path: string, body?: unknown): Promise<unknown> {
        return this.request(path, { method: "DELETE", body: body === undefined ? undefined : JSON.stringify(body) });
    }
}
