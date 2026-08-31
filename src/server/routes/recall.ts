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
 *  file  : src/server/routes/recall.ts
 *  usage : implements the LongMemory recall component
 */


import type { public_recall_query, recall_mode } from '../../core/create_memory.js';
import type { route_handler } from '../app.js';
import { api_error, expect_record, optional_array, optional_number, optional_string, required_string } from '../middleware/errors.js';

const modes: recall_mode[] = ['strict', 'historical', 'associative', 'world_grounded'];

export const recall_route: route_handler = async ({ body, memory }) => {
    const input = expect_record(body);
    required_string(input, 'text');
    const mode = required_string(input, 'mode') as recall_mode;
    if (!modes.includes(mode)) throw new api_error(400, 'validation_error', `mode must be one of: ${modes.join(', ')}`);
    optional_string(input, 'world_id');
    for (const key of ['now', 'at', 'valid_time', 'recorded_time', 'k', 'token_budget', 'min_confidence', 'min_freshness', 'min_source_reliability', 'grounding_threshold']) optional_number(input, key);
    optional_array(input, 'entity_names', 'string');
    optional_array(input, 'vector', 'number');
    return { data: await memory.recall(input as unknown as public_recall_query) };
};