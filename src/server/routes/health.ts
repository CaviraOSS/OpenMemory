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
 *  file  : src/server/routes/health.ts
 *  usage : implements the LongMemory health component
 */


import type { route_handler } from '../app.js';

export const health_route: route_handler = async ({ memory }) => {
    const status = memory.status();
    const stats = await memory.getStats();
    return { data: { ok: status.ready && !stats.closed, status, store: stats } };
};