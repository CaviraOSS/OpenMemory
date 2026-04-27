import { env } from "../../core/cfg";
import crypto from "crypto";

/**
 * SECURITY: Authentication is fail-closed by default.
 *
 *  - In production (NODE_ENV=production) OR when OM_REQUIRE_AUTH=true,
 *    a missing OM_API_KEY causes every protected request to return 503.
 *    We do not crash the process here (the server may still serve
 *    public health endpoints), but no protected route is reachable.
 *  - In development (NODE_ENV !== "production" AND OM_REQUIRE_AUTH != "true"),
 *    a missing OM_API_KEY produces a loud console.error on every request
 *    and still rejects with 503 unless OM_DEV_ALLOW_NO_AUTH=true is set
 *    explicitly. This avoids the previous fail-open behaviour where any
 *    caller could read every tenant's data.
 *
 * Tenant derivation:
 *  - On a successful auth, we attach `req.tenant` = SHA-256 prefix of the
 *    API key (16 hex chars). This means every API key gets its own
 *    isolated tenant scope, which is the simplest correct multi-tenant
 *    behaviour. The raw API key never leaves this module.
 *  - If a future deployment needs to map one API key to a different
 *    tenant id (e.g., a customer-specified slug), replace `derive_tenant_id`
 *    with a lookup — route handlers don't need to change.
 */

const rate_limit_store = new Map<
    string,
    { count: number; reset_time: number }
>();

const REQUIRE_AUTH =
    process.env.NODE_ENV === "production" ||
    process.env.OM_REQUIRE_AUTH === "true";

const DEV_ALLOW_NO_AUTH =
    process.env.NODE_ENV !== "production" &&
    process.env.OM_REQUIRE_AUTH !== "true" &&
    process.env.OM_DEV_ALLOW_NO_AUTH === "true";

const auth_config = {
    api_key: env.api_key,
    api_key_header: "x-api-key",
    rate_limit_enabled: env.rate_limit_enabled,
    rate_limit_window_ms: env.rate_limit_window_ms,
    rate_limit_max_requests: env.rate_limit_max_requests,
    public_endpoints: [
        "/health",
        "/api/system/health",
        "/api/system/stats",
        "/dashboard/health",
    ],
};

if (!auth_config.api_key) {
    if (REQUIRE_AUTH) {
        console.error(
            "[AUTH] FATAL: OM_API_KEY is not set but OM_REQUIRE_AUTH or NODE_ENV=production is in effect. " +
                "All protected endpoints will return 503 until OM_API_KEY is configured.",
        );
    } else if (DEV_ALLOW_NO_AUTH) {
        console.error(
            "[AUTH] WARNING: OM_API_KEY is not set and OM_DEV_ALLOW_NO_AUTH=true. " +
                "Auth is DISABLED — every request runs as the synthetic 'dev-no-auth' tenant. " +
                "Do NOT use this mode in production.",
        );
    } else {
        console.error(
            "[AUTH] WARNING: OM_API_KEY is not set. Protected endpoints will return 503. " +
                "Set OM_API_KEY=... in .env, or set OM_DEV_ALLOW_NO_AUTH=true to bypass auth in dev.",
        );
    }
}

function is_public_endpoint(path: string): boolean {
    return auth_config.public_endpoints.some(
        (e) => path === e || path.startsWith(e),
    );
}

function extract_api_key(req: any): string | null {
    const x_api_key = req.headers[auth_config.api_key_header];
    if (x_api_key) return x_api_key;
    const auth_header = req.headers["authorization"];
    if (auth_header) {
        if (auth_header.startsWith("Bearer ")) return auth_header.slice(7);
        if (auth_header.startsWith("ApiKey ")) return auth_header.slice(7);
    }
    return null;
}

function validate_api_key(provided: string, expected: string): boolean {
    if (!provided || !expected || provided.length !== expected.length)
        return false;
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

/**
 * Map a raw API key to a stable tenant id. Currently a SHA-256 prefix —
 * one tenant per key. Replace with a config lookup if/when the project
 * needs many keys to share a tenant.
 */
function derive_tenant_id(api_key: string): string {
    return crypto
        .createHash("sha256")
        .update(api_key)
        .digest("hex")
        .slice(0, 16);
}

function check_rate_limit(client_id: string): {
    allowed: boolean;
    remaining: number;
    reset_time: number;
} {
    if (!auth_config.rate_limit_enabled)
        return { allowed: true, remaining: -1, reset_time: -1 };
    const now = Date.now();
    const data = rate_limit_store.get(client_id);
    if (!data || now >= data.reset_time) {
        const new_data = {
            count: 1,
            reset_time: now + auth_config.rate_limit_window_ms,
        };
        rate_limit_store.set(client_id, new_data);
        return {
            allowed: true,
            remaining: auth_config.rate_limit_max_requests - 1,
            reset_time: new_data.reset_time,
        };
    }
    data.count++;
    rate_limit_store.set(client_id, data);
    const remaining = auth_config.rate_limit_max_requests - data.count;
    return {
        allowed: data.count <= auth_config.rate_limit_max_requests,
        remaining: Math.max(0, remaining),
        reset_time: data.reset_time,
    };
}

export function authenticate_api_request(req: any, res: any, next: any) {
    const path = req.path || req.url;
    if (is_public_endpoint(path)) return next();

    if (!auth_config.api_key || auth_config.api_key === "") {
        if (DEV_ALLOW_NO_AUTH) {
            // Synthetic tenant for local dev only — never reachable in prod.
            (req as any).tenant = "dev-no-auth";
            return next();
        }
        return res.status(503).json({
            error: "auth_not_configured",
            message:
                "Server has no OM_API_KEY configured. Protected endpoints are unavailable.",
        });
    }

    const provided = extract_api_key(req);
    if (!provided)
        return res.status(401).json({
            error: "authentication_required",
            message: "API key required",
        });
    if (!validate_api_key(provided, auth_config.api_key))
        return res.status(403).json({ error: "invalid_api_key" });

    const tenant = derive_tenant_id(provided);
    (req as any).tenant = tenant;

    const rl = check_rate_limit(tenant);
    if (auth_config.rate_limit_enabled) {
        res.setHeader("X-RateLimit-Limit", auth_config.rate_limit_max_requests);
        res.setHeader("X-RateLimit-Remaining", rl.remaining);
        res.setHeader("X-RateLimit-Reset", Math.floor(rl.reset_time / 1000));
    }
    if (!rl.allowed)
        return res.status(429).json({
            error: "rate_limit_exceeded",
            retry_after: Math.ceil((rl.reset_time - Date.now()) / 1000),
        });
    next();
}

export function log_authenticated_request(req: any, res: any, next: any) {
    const tenant = (req as any).tenant;
    if (tenant) console.log(`[AUTH] ${req.method} ${req.path} [${tenant}]`);
    next();
}

setInterval(
    () => {
        const now = Date.now();
        for (const [id, data] of rate_limit_store.entries())
            if (now >= data.reset_time) rate_limit_store.delete(id);
    },
    5 * 60 * 1000,
);
