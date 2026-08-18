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
 *  file  : src/index.ts
 *  usage : minimal public package surface
 */

export { create_memory, createMemory } from './core/create_memory.js';
export type {
    embedding_provider,
    ingest_result,
    memory_config,
    memory_event,
    memory_explanation,
    memory_stats,
    memory_store_kind,
    open_memory,
    public_recall_query,
    recall_mode,
    timeline_params,
    world_list_params,
} from './core/create_memory.js';
export * from './core/connectors/index.js';
export * from './core/project/index.js';
export * from './core/i18n/index.js';
export * from './connectors/index.js';
export * from './mcp/index.js';
export * from './core/embeddings/index.js';
