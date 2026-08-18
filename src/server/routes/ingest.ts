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
 *  file  : src/server/routes/ingest.ts
 *  usage : memory ingest transport route
 */

import type { memory_event } from '../../core/create_memory.js';
import type { route_handler } from '../app.js';
import { api_error, expect_record, optional_array, optional_boolean, optional_number, optional_record, optional_string, required_string } from '../middleware/errors.js';

const facets = new Set(['episodic', 'semantic', 'procedural', 'emotional', 'reflective']);

export const ingest_route: route_handler = async ({ body, memory }) => {
    const input = expect_record(body);
    required_string(input, 'user_id');
    required_string(input, 'text');
    for (const key of ['id', 'world', 'zone', 'grounding_ref', 'facet_hint']) optional_string(input, key);
    if (input.facet_hint !== undefined && !facets.has(input.facet_hint as string)) throw new api_error(400, 'validation_error', 'facet_hint must be episodic, semantic, procedural, emotional, or reflective');
    for (const key of ['at', 'observed_at', 'valid_from']) optional_number(input, key);
    optional_number(input, 'valid_to', true);
    optional_boolean(input, 'external');
    optional_array(input, 'tags', 'string');
    optional_array(input, 'vector', 'number');
    optional_array(input, 'entity_hints');
    for (const key of ['source', 'contract', 'metadata']) optional_record(input, key);
    return { status: 201, data: await memory.ingest(input as unknown as memory_event) };
};