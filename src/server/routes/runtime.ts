import type { route_handler } from '../app.js';

export const runtime_route: route_handler = async ({ metrics, config }) => ({
    data: {
        metrics: metrics.snapshot(),
        limits: { max_payload_size: config.max_payload_size, max_active_requests: config.max_active_requests, rate_limit: config.rate_limit },
        features: { mcp_http: config.mcp_http, telemetry: config.telemetry, cors: config.allowed_origins.length > 0, embedding_provider: config.embedding?.provider ?? 'deterministic' },
    },
});