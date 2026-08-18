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
 *  file  : src/server/routes/entities.ts
 *  usage : entity lookup transport route
 */

import type { route_handler } from '../app.js';
import { api_error } from '../middleware/errors.js';

export const entities_route: route_handler = async ({ memory, params }) => {
    const data = await memory.getEntity(params.id);
    if (!data) throw new api_error(404, 'entity_not_found', 'Entity not found');
    return { data };
};