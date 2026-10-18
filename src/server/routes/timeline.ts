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
    const permission_user_id = query.get('permission_user_id') ?? undefined;
    const team_ids = query.getAll('permission_team_ids').flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean);
    const project_ids = query.getAll('permission_project_ids').flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean);
    const source_ids = query.getAll('permission_source_ids').flatMap((item) => item.split(',')).map((item) => item.trim()).filter(Boolean);
    const allow_private = query.get('permission_allow_private') === 'true';
    const has_permission_context = Boolean(permission_user_id || team_ids.length || project_ids.length || source_ids.length || allow_private);
    const input: timeline_params = {
        text: query.get('text') ?? undefined,
        now: time(query, 'now'),
        valid_time: time(query, 'valid_time'),
        recorded_time: time(query, 'recorded_time'),
        world_id: query.get('world_id') ?? undefined,
        entity_names: names.length ? names : undefined,
        permission_context: has_permission_context ? {
            user_id: permission_user_id,
            team_ids: team_ids.length ? team_ids : undefined,
            project_ids: project_ids.length ? project_ids : undefined,
            source_ids: source_ids.length ? source_ids : undefined,
            allow_private: allow_private || undefined,
        } : undefined,
    };
    return { data: await memory.getTimeline(input) };
};