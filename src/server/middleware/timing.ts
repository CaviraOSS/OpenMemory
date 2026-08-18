/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/server/middleware/timing.ts
 *  usage : response timing metadata
 */

import type { ServerResponse } from 'node:http';

export const elapsed_ms = (started_at: number) => Math.round((performance.now() - started_at) * 1_000) / 1_000;

export function attach_timing(response: ServerResponse, duration_ms: number): void {
    response.setHeader('server-timing', `app;dur=${duration_ms}`);
}