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
 *  file  : src/server/routes/runtime.ts
 *  usage : implements the LongMemory runtime component
 */


import type { route_handler } from '../app.js';

export const runtime_route: route_handler = async ({ metrics, config }) => ({
    data: {
        metrics: metrics.snapshot(),
        limits: { max_payload_size: config.max_payload_size, max_active_requests: config.max_active_requests, rate_limit: config.rate_limit },
        features: { mcp_http: config.mcp_http, telemetry: config.telemetry, cors: config.allowed_origins.length > 0, embedding_provider: config.embedding?.provider ?? 'deterministic' },
    },
});