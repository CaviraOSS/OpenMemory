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
 *  file  : benchmarks/src/config.ts
 *  usage : supports LongMemory benchmark config
 */


import type { model_config, model_provider, provider_config, provider_name } from "./types";

export const provider_names: provider_name[] = ["longmemory"];
export const model_provider_names: model_provider[] = ["openai", "anthropic", "google", "openai-compatible", "ollama", "codex", "claude-code", "copilot", "copilot-answerer", "copilot-judge"];

const base_urls: Record<provider_name, string> = {
    longmemory: "embedded://longmemory",
    supermemory: "https://api.supermemory.ai",
    mem0: "https://api.mem0.ai",
    graphiti: "https://api.getzep.com/api/v2",
    cognee: "http://127.0.0.1:8002",
};

export const benchmark_defaults = {
    cutoffs: [1, 5, 10, 20],
    per_category: 2,
    timeout_ms: 120_000,
    lexical_threshold: 0.45,
    context_token_budget: 2_048,
    gates: {
        hit_at_5_min: 0.8,
        answer_accuracy_min: 0.8,
        stale_leakage_max: 0.15,
        failed_questions_max: 0,
    },
};

const first_nonempty = (...values: Array<string | undefined>): string | undefined => values.find((value) => value?.trim());

export function provider_config_from_env(name: provider_name, env: NodeJS.ProcessEnv = process.env): provider_config {
    const prefix = `BENCH_${name.toUpperCase()}`;
    const routes = env[`${prefix}_ROUTES`];
    const api_key = first_nonempty(
        env[`${prefix}_API_KEY`],
        name === "supermemory" ? env.SUPERMEMORY_API_KEY : undefined,
        name === "mem0" ? env.MEM0_API_KEY : undefined,
        name === "graphiti" ? env.ZEP_API_KEY : undefined,
    );
    const default_profile = name === "mem0" || name === "graphiti" ? "cloud" : undefined;
    return {
        base_url: env[`${prefix}_URL`] ?? base_urls[name],
        timeout_ms: Number(env[`${prefix}_TIMEOUT_MS`] ?? benchmark_defaults.timeout_ms),
        ...(api_key ? { api_key } : {}),
        ...((env[`${prefix}_PROFILE`] ?? default_profile) ? { profile: env[`${prefix}_PROFILE`] ?? default_profile } : {}),
        ...(name === "longmemory" && env.BENCH_LONGMEMORY_EMBEDDING_BATCH_SIZE
            ? { embedding_batch_size: Number(env.BENCH_LONGMEMORY_EMBEDDING_BATCH_SIZE) }
            : {}),
        ...(routes ? { routes: JSON.parse(routes) as provider_config["routes"] } : {}),
    };
}

export function model_config_from_spec(spec: string, env: NodeJS.ProcessEnv = process.env): model_config {
    const separator = spec.indexOf(":");
    if (separator < 1 || separator === spec.length - 1) throw new Error(`model must use provider:model format: ${spec}`);
    const provider = spec.slice(0, separator) as model_provider;
    const model = spec.slice(separator + 1);
    if (!model_provider_names.includes(provider)) throw new Error(`unsupported model provider: ${provider}`);
    const local = provider === "ollama" || provider === "codex" || provider === "claude-code" || provider === "copilot" || provider === "copilot-answerer" || provider === "copilot-judge";
    if (provider === "codex" && model === "default") throw new Error("codex requires an explicit model because benchmark safe mode ignores user configuration");
    const env_prefix = provider === "openai-compatible" ? "OPENAI" : provider.toUpperCase().replaceAll("-", "_");
    const api_key = local ? "" : env[`BENCH_${env_prefix}_API_KEY`] ?? env[`${env_prefix}_API_KEY`] ?? "";
    if (!local && !api_key) throw new Error(`missing API key for ${provider}; set BENCH_${env_prefix}_API_KEY or ${env_prefix}_API_KEY`);
    const configured_base_url = env[`BENCH_${env_prefix}_BASE_URL`] ?? (provider === "ollama" ? env.OLLAMA_HOST ?? "http://127.0.0.1:11434" : undefined);
    const base_url = provider === "ollama" && configured_base_url && !configured_base_url.includes("://") ? `http://${configured_base_url}` : configured_base_url;
    return {
        provider,
        model,
        api_key,
        base_url,
        timeout_ms: Number(env.BENCH_LLM_TIMEOUT_MS ?? 120_000),
        max_retries: Number(env.BENCH_LLM_MAX_RETRIES ?? 3),
        max_tokens: Number(env.BENCH_LLM_MAX_TOKENS ?? 1_000),
        temperature: Number(env.BENCH_LLM_TEMPERATURE ?? 0),
        command: env[`BENCH_${env_prefix}_COMMAND`],
    };
}
