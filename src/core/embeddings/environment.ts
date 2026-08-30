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
 *  file  : src/core/embeddings/environment.ts
 *  usage : implements the LongMemory environment component
 */

import type { embedding_provider_config, embedding_provider_dependencies, embedding_provider_name, embedding_tier } from './types.js';
import { create_embedding_stack } from './stack.js';

const providers = new Set<embedding_provider_name>(['openai', 'gemini', 'aws', 'ollama', 'local', 'siray', 'synthetic']);
const tiers = new Set<embedding_tier>(['fast', 'smart', 'deep', 'hybrid']);
const value = (env: NodeJS.ProcessEnv, ...keys: string[]) => keys.map((key) => env[key]?.trim()).find(Boolean);
const number_value = (env: NodeJS.ProcessEnv, keys: string[], fallback: number, min = 0) => {
    const raw = value(env, ...keys);
    if (!raw) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < min) throw new Error(`${keys[0]} must be a number >= ${min}`);
    return parsed;
};
const provider = (name: string | undefined, fallback: embedding_provider_name): embedding_provider_name => {
    const normalized = name === 'bedrock' ? 'aws' : name;
    if (!normalized) return fallback;
    if (!providers.has(normalized as embedding_provider_name)) throw new Error(`unknown embedding provider: ${name}`);
    return normalized as embedding_provider_name;
};

export function load_embedding_environment(env: NodeJS.ProcessEnv = process.env): embedding_provider_config | null {
    const selected = value(env, 'LONGMEMORY_EMBEDDING_PROVIDER', 'OM_EMBEDDINGS');
    if (!selected) return null;
    const tier_raw = value(env, 'LONGMEMORY_EMBEDDING_TIER', 'OM_TIER') ?? 'deep';
    if (!tiers.has(tier_raw as embedding_tier)) throw new Error(`unknown embedding tier: ${tier_raw}`);
    const tier = tier_raw as embedding_tier;
    const default_dimension = tier === 'smart' ? 384 : tier === 'deep' ? 1536 : 256;
    return {
        provider: provider(selected, 'synthetic'),
        fallback: (value(env, 'LONGMEMORY_EMBEDDING_FALLBACK', 'OM_EMBEDDING_FALLBACK') ?? 'synthetic').split(',').map((name) => provider(name.trim(), 'synthetic')),
        tier,
        dimension: number_value(env, ['LONGMEMORY_EMBEDDING_DIMENSION', 'OM_VEC_DIM', 'OM_MAX_VECTOR_DIM'], default_dimension, 1),
        timeout_ms: number_value(env, ['LONGMEMORY_EMBEDDING_TIMEOUT_MS', 'OM_EMBED_TIMEOUT_MS'], 30_000, 1),
        max_retries: number_value(env, ['LONGMEMORY_EMBEDDING_MAX_RETRIES', 'OM_EMBED_MAX_RETRIES'], 2, 0),
        retry_base_ms: number_value(env, ['LONGMEMORY_EMBEDDING_RETRY_BASE_MS'], 250, 0),
        openai_api_key: value(env, 'OPENAI_API_KEY', 'OM_OPENAI_API_KEY'),
        openai_base_url: value(env, 'LONGMEMORY_OPENAI_BASE_URL', 'OM_OPENAI_BASE_URL') ?? 'https://api.openai.com/v1',
        openai_model: value(env, 'LONGMEMORY_OPENAI_EMBEDDING_MODEL', 'OM_OPENAI_MODEL') ?? 'text-embedding-3-small',
        gemini_api_key: value(env, 'GEMINI_API_KEY', 'OM_GEMINI_API_KEY'),
        gemini_base_url: value(env, 'LONGMEMORY_GEMINI_BASE_URL', 'OM_GEMINI_BASE_URL') ?? 'https://generativelanguage.googleapis.com/v1beta',
        gemini_model: value(env, 'LONGMEMORY_GEMINI_EMBEDDING_MODEL', 'OM_GEMINI_MODEL') ?? 'gemini-embedding-001',
        gemini_inputs_per_minute: number_value(env, ['LONGMEMORY_GEMINI_INPUTS_PER_MINUTE'], 0, 0),
        ollama_url: value(env, 'LONGMEMORY_OLLAMA_URL', 'OLLAMA_URL', 'OM_OLLAMA_URL') ?? 'http://127.0.0.1:11434',
        ollama_model: value(env, 'LONGMEMORY_OLLAMA_EMBEDDING_MODEL', 'OM_OLLAMA_MODEL') ?? 'nomic-embed-text',
        aws_region: value(env, 'AWS_REGION', 'AWS_DEFAULT_REGION'),
        aws_model: value(env, 'LONGMEMORY_AWS_EMBEDDING_MODEL', 'OM_AWS_MODEL') ?? 'amazon.titan-embed-text-v2:0',
        siray_api_key: value(env, 'SIRAY_API_TOKEN', 'OM_SIRAY_API_TOKEN'),
        siray_base_url: value(env, 'LONGMEMORY_SIRAY_BASE_URL', 'OM_SIRAY_BASE_URL') ?? 'https://api.siray.ai/v1',
        siray_model: value(env, 'LONGMEMORY_SIRAY_EMBEDDING_MODEL', 'OM_SIRAY_MODEL') ?? 'text-embedding-3-small',
        local_url: value(env, 'LONGMEMORY_LOCAL_EMBEDDING_URL', 'OM_LOCAL_MODEL_URL'),
        local_model: value(env, 'LONGMEMORY_LOCAL_EMBEDDING_MODEL', 'LOCAL_MODEL_PATH', 'OM_LOCAL_MODEL_PATH') ?? 'local-model',
    };
}

export function create_embedding_environment(env: NodeJS.ProcessEnv = process.env, dependencies: embedding_provider_dependencies = {}) {
    const config = load_embedding_environment(env);
    if (!config) return null;
    const embedding_provider = create_embedding_stack(config, dependencies);
    const multilingual_embedding_provider = {
        embed: (text: string, language?: string) => embedding_provider.embed(text, { language, purpose: 'document' }),
    };
    return { config, embedding_provider, multilingual_embedding_provider, embedding_dimension: config.dimension };
}