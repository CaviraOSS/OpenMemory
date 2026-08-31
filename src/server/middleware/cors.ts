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
 *  file  : src/server/middleware/cors.ts
 *  usage : implements the LongMemory cors component
 */


import type { IncomingMessage, ServerResponse } from 'node:http';

export function apply_cors(request: IncomingMessage, response: ServerResponse, allowed_origins: readonly string[]): boolean {
    const origin = request.headers.origin;
    if (!origin) return false;
    const allowed = allowed_origins.includes('*') || allowed_origins.includes(origin);
    if (!allowed) return false;
    response.setHeader('access-control-allow-origin', allowed_origins.includes('*') ? '*' : origin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    response.setHeader('access-control-allow-headers', 'Authorization, Content-Type, X-API-Key, Mcp-Session-Id, Mcp-Protocol-Version');
    response.setHeader('access-control-expose-headers', 'Server-Timing, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Mcp-Session-Id');
    if (request.method === 'OPTIONS') {
        response.statusCode = 204;
        response.end();
        return true;
    }
    return false;
}