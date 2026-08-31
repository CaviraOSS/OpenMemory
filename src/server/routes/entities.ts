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
 *  file  : src/server/routes/entities.ts
 *  usage : implements the LongMemory entities component
 */


import type { route_handler } from '../app.js';
import { api_error } from '../middleware/errors.js';

export const entities_route: route_handler = async ({ memory, params }) => {
    const data = await memory.getEntity(params.id);
    if (!data) throw new api_error(404, 'entity_not_found', 'Entity not found');
    return { data };
};