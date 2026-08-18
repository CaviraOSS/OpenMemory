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
 *  file  : src/server/routes/worlds.ts
 *  usage : world lookup transport route
 */

import type { route_handler } from '../app.js';
import { api_error } from '../middleware/errors.js';

export const worlds_route: route_handler = async ({ memory, params }) => {
    const data = await memory.getWorld(params.id);
    if (!data) throw new api_error(404, 'world_not_found', 'World not found');
    return { data };
};

    export const worlds_list_route: route_handler = async ({ memory, query }) => {
        const zone = query.get('zone');
        if (zone && !['endocortex', 'exocortex', 'mixed'].includes(zone)) throw new api_error(400, 'validation_error', 'zone must be endocortex, exocortex, or mixed');
        const raw_limit = query.get('limit');
        const limit = raw_limit === null ? undefined : Number(raw_limit);
        if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) throw new api_error(400, 'validation_error', 'limit must be a positive integer');
        return { data: await memory.listWorlds({ zone: zone as 'endocortex' | 'exocortex' | 'mixed' | undefined, limit }) };
    };