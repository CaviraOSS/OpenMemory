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
 *  file  : src/server/config.ts
 *  usage : implements the LongMemory config component
 */


import type { memory_config } from '../core/create_memory.js';
import { create_embedding_environment } from '../core/embeddings/environment.js';
import type { embedding_provider_config } from '../core/embeddings/types.js';
import type { rate_limit_config } from './middleware/rate_limit.js';

export type server_config = {
    host: string;
    port: number;
    api_key: string | null;
    mcp_http: boolean;
    max_payload_size: number;
    rate_limit: rate_limit_config;
    log_auth: boolean;
    telemetry: boolean;
    allowed_origins: string[];
    max_active_requests: number;
    embedding: embedding_provider_config | null;
    memory: memory_config & { store: 'sqlite'; db_path: string };
};

const first = (env: NodeJS.ProcessEnv, ...keys: string[]) => keys.map((key) => env[key]?.trim()).find((value) => value !== undefined && value !== '');

const bool = (env: NodeJS.ProcessEnv, key: string, fallback: boolean) => {
    const raw = env[key]?.trim().toLowerCase();
    if (!raw) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;
    throw new Error(`${key} must be true or false`);
};

const num_alias = (env: NodeJS.ProcessEnv, keys: string[], fallback: number, min: number, max: number) => {
    const raw = first(env, ...keys);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${keys[0]} must be between ${min} and ${max}`);
    return value;
};

const bool_alias = (env: NodeJS.ProcessEnv, keys: string[], fallback: boolean) => {
    const raw = first(env, ...keys)?.toLowerCase();
    if (!raw) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;
    throw new Error(`${keys[0]} must be true or false`);
};

export function load_server_config(env: NodeJS.ProcessEnv = process.env): server_config {
    const embeddings = create_embedding_environment(env, { logger: (message) => console.warn(`[longmemory] ${message}`) });
    return {
        host: first(env, 'LONGMEMORY_HOST', 'OM_HOST') || '127.0.0.1',
        port: num_alias(env, ['LONGMEMORY_PORT', 'PORT', 'OM_PORT'], 7331, 0, 65_535),
        api_key: first(env, 'LONGMEMORY_API_KEY', 'OM_API_KEY') || null,
        mcp_http: bool(env, 'LONGMEMORY_MCP_HTTP', false),
        max_payload_size: num_alias(env, ['LONGMEMORY_MAX_PAYLOAD_SIZE', 'OM_MAX_PAYLOAD_SIZE'], 1_048_576, 1_024, 1_073_741_824),
        rate_limit: {
            enabled: bool_alias(env, ['LONGMEMORY_RATE_LIMIT_ENABLED', 'OM_RATE_LIMIT_ENABLED'], false),
            window_ms: num_alias(env, ['LONGMEMORY_RATE_LIMIT_WINDOW_MS', 'OM_RATE_LIMIT_WINDOW_MS'], 60_000, 1_000, 86_400_000),
            max_requests: num_alias(env, ['LONGMEMORY_RATE_LIMIT_MAX_REQUESTS', 'OM_RATE_LIMIT_MAX_REQUESTS'], 100, 1, 1_000_000),
        },
        log_auth: bool_alias(env, ['LONGMEMORY_LOG_AUTH', 'OM_LOG_AUTH'], false),
        telemetry: bool_alias(env, ['LONGMEMORY_TELEMETRY', 'OM_TELEMETRY'], true),
        allowed_origins: (first(env, 'LONGMEMORY_ALLOWED_ORIGINS', 'OM_IDE_ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
        max_active_requests: num_alias(env, ['LONGMEMORY_MAX_ACTIVE_REQUESTS', 'OM_MAX_ACTIVE'], 64, 1, 100_000),
        embedding: embeddings?.config ?? null,
        memory: {
            store: 'sqlite',
            db_path: first(env, 'LONGMEMORY_DB_PATH', 'OM_DB_PATH') || './longmemory.db',
            enable_cold_log: bool(env, 'LONGMEMORY_ENABLE_COLD_LOG', false),
            enable_consolidation: bool_alias(env, ['LONGMEMORY_ENABLE_CONSOLIDATION', 'OM_AUTO_REFLECT'], false),
            max_context_tokens: num_alias(env, ['LONGMEMORY_MAX_CONTEXT_TOKENS'], 2_048, 64, 1_000_000),
            strict_confidence_threshold: num_alias(env, ['LONGMEMORY_STRICT_CONFIDENCE_THRESHOLD'], 0.5, 0, 1),
            grounding_threshold: num_alias(env, ['LONGMEMORY_GROUNDING_THRESHOLD'], 0.6, 0, 1),
            ...(first(env, 'LONGMEMORY_DEFAULT_LANGUAGE') ? { default_language: first(env, 'LONGMEMORY_DEFAULT_LANGUAGE') as memory_config['default_language'] } : {}),
            ...(first(env, 'LONGMEMORY_OUTPUT_LANGUAGE') ? { output_language: first(env, 'LONGMEMORY_OUTPUT_LANGUAGE') as memory_config['output_language'] } : {}),
            preserve_original_text: bool_alias(env, ['LONGMEMORY_PRESERVE_ORIGINAL_TEXT'], true),
            enable_translation: bool_alias(env, ['LONGMEMORY_ENABLE_TRANSLATION'], false),
            enable_transliteration: bool_alias(env, ['LONGMEMORY_ENABLE_TRANSLITERATION'], true),
            ...(embeddings ? {
                embedding_provider: embeddings.embedding_provider,
                multilingual_embedding_provider: embeddings.multilingual_embedding_provider,
                embedding_dimension: embeddings.embedding_dimension,
            } : {}),
        },
    };
}