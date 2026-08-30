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
 *  file  : src/server/routes/timeline.ts
 *  usage : implements the LongMemory timeline component
 */

import type { timeline_params } from '../../core/create_memory.js';
import type { route_handler } from '../app.js';
import { api_error } from '../middleware/errors.js';

const time = (query: URLSearchParams, key: string) => {
    const raw = query.get(key);
    if (raw === null) return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new api_error(400, 'validation_error', `${key} must be a finite number`);
    return value;
};

export const timeline_route: route_handler = async ({ memory, query }) => {
    const names = query.getAll('entity_names').flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean);
    const input: timeline_params = {
        text: query.get('text') ?? undefined,
        now: time(query, 'now'),
        valid_time: time(query, 'valid_time'),
        recorded_time: time(query, 'recorded_time'),
        world_id: query.get('world_id') ?? undefined,
        entity_names: names.length ? names : undefined,
    };
    return { data: await memory.getTimeline(input) };
};