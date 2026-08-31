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
 *  file  : src/core/embeddings/types.ts
 *  usage : implements the LongMemory types component
 */


import type { language_code } from '../i18n/language_detection.js';

export type embedding_provider_name = 'openai' | 'gemini' | 'aws' | 'ollama' | 'local' | 'siray' | 'synthetic';
export type embedding_tier = 'fast' | 'smart' | 'deep' | 'hybrid';
export type embedding_context = { language?: language_code | string; purpose?: 'document' | 'query' };

export interface configured_embedding_provider {
    readonly name: string;
    readonly dimension: number;
    embed(text: string, context?: embedding_context): Promise<number[]>;
    embed_many?(texts: string[], context?: embedding_context): Promise<number[][]>;
}

export type embedding_provider_config = {
    provider: embedding_provider_name;
    fallback: embedding_provider_name[];
    tier: embedding_tier;
    dimension: number;
    timeout_ms: number;
    max_retries: number;
    retry_base_ms: number;
    openai_api_key?: string;
    openai_base_url: string;
    openai_model: string;
    gemini_api_key?: string;
    gemini_base_url: string;
    gemini_model: string;
    gemini_inputs_per_minute: number;
    ollama_url: string;
    ollama_model: string;
    aws_region?: string;
    aws_model: string;
    siray_api_key?: string;
    siray_base_url: string;
    siray_model: string;
    local_url?: string;
    local_model: string;
};

export type embedding_provider_dependencies = {
    fetch?: typeof fetch;
    logger?: (message: string) => void;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    bedrock_client?: { send(command: unknown): Promise<{ body: Uint8Array }> };
};