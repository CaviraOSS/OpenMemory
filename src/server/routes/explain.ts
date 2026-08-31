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
 *  file  : src/server/routes/explain.ts
 *  usage : implements the LongMemory explain component
 */


import type { route_handler } from '../app.js';
import { api_error } from '../middleware/errors.js';

export const explain_route: route_handler = async ({ memory, params }) => {
    const data = await memory.explain(params.id);
    if (!data.node) throw new api_error(404, 'memory_not_found', 'Memory not found');
    return { data };
};