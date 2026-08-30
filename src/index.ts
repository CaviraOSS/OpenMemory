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
 *  file  : src/index.ts
 *  usage : implements the LongMemory index component
 */

export { create_memory, createMemory } from './core/create_memory.js';
export type {
    decay_cycle_params,
    decay_cycle_result,
    embedding_provider,
    ingest_result,
    memory_config,
    memory_event,
    memory_explanation,
    memory_stats,
    memory_store_kind,
    long_memory,
    public_recall_query,
    recall_mode,
    reinforcement_params,
    timeline_params,
    world_list_params,
} from './core/create_memory.js';
export type { decay_policy, decay_projection, decay_tier } from './core/memory/decay_engine.js';
export * from './core/connectors/index.js';
export * from './core/project/index.js';
export * from './core/i18n/index.js';
export * from './connectors/index.js';
export * from './mcp/index.js';
export * from './core/embeddings/index.js';
