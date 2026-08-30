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
 *  file  : src/server/middleware/timing.ts
 *  usage : implements the LongMemory timing component
 */

import type { ServerResponse } from 'node:http';

export const elapsed_ms = (started_at: number) => Math.round((performance.now() - started_at) * 1_000) / 1_000;

export function attach_timing(response: ServerResponse, duration_ms: number): void {
    response.setHeader('server-timing', `app;dur=${duration_ms}`);
}