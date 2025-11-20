import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
const num = (v: string | undefined, d: number) => Number(v) || d;
const str = (v: string | undefined, d: string) => v || d;
const bool = (v: string | undefined) => v === "true";
type tier = "fast" | "smart" | "deep" | "hybrid";

const get_tier = (): tier => {
    const man = process.env.OM_TIER as tier;
    if (man && ["fast", "smart", "deep", "hybrid"].includes(man)) return man;
    console.warn(
        "[OpenMemory] OM_TIER not set! Please set OM_TIER=hybrid|fast|smart|deep in .env",
    );
    return "hybrid";
};
export const tier = get_tier();
const tier_dims = { fast: 256, smart: 384, deep: 1536, hybrid: 256 };
const tier_cache = { fast: 2, smart: 3, deep: 5, hybrid: 3 };
const tier_max_active = { fast: 32, smart: 64, deep: 128, hybrid: 64 };

export const env = {
    port: num(process.env.OM_PORT, 8080),
    db_path: str(process.env.OM_DB_PATH, "./data/openmemory.sqlite"),
    api_key: process.env.OM_API_KEY,
    rate_limit_enabled: bool(process.env.OM_RATE_LIMIT_ENABLED),
    rate_limit_window_ms: num(process.env.OM_RATE_LIMIT_WINDOW_MS, 60000),
    rate_limit_max_requests: num(process.env.OM_RATE_LIMIT_MAX_REQUESTS, 100),
    compression_enabled: bool(process.env.OM_COMPRESSION_ENABLED),
    compression_algorithm: str(process.env.OM_COMPRESSION_ALGORITHM, "auto") as
        | "semantic"
        | "syntactic"
        | "aggressive"
        | "auto",
    compression_min_length: num(process.env.OM_COMPRESSION_MIN_LENGTH, 100),
    emb_kind: str(process.env.OM_EMBEDDINGS, "synthetic"),
    embed_mode: str(process.env.OM_EMBED_MODE, "simple"),
    adv_embed_parallel: bool(process.env.OM_ADV_EMBED_PARALLEL),
    embed_delay_ms: num(process.env.OM_EMBED_DELAY_MS, 200),
    openai_key:
        process.env.OPENAI_API_KEY || process.env.OM_OPENAI_API_KEY || "",
    openai_base_url: str(
        process.env.OM_OPENAI_BASE_URL,
        "https://api.openai.com/v1",
    ),
    openai_model: process.env.OM_OPENAI_MODEL,
    gemini_key:
        process.env.GEMINI_API_KEY || process.env.OM_GEMINI_API_KEY || "",
    aws_model: str(
        process.env.AWS_REGION,
        process.env.AWS_ACCESS_KEY_ID,
        process.env.AWS_SECRET_ACCESS_KEY
    ),
          
    ollama_url: str(
        process.env.OLLAMA_URL || process.env.OM_OLLAMA_URL,
        "http://localhost:11434",
    ),
    local_model_path:
        process.env.LOCAL_MODEL_PATH || process.env.OM_LOCAL_MODEL_PATH || "",
    vec_dim: num(process.env.OM_VEC_DIM, tier_dims[tier]),
    min_score: num(process.env.OM_MIN_SCORE, 0.3),
    decay_lambda: num(process.env.OM_DECAY_LAMBDA, 0.02),
    decay_interval_minutes: num(process.env.OM_DECAY_INTERVAL_MINUTES, 1440),
    max_payload_size: num(process.env.OM_MAX_PAYLOAD_SIZE, 1_000_000),
    mode: str(process.env.OM_MODE, "standard").toLowerCase(),
    lg_namespace: str(process.env.OM_LG_NAMESPACE, "default"),
    lg_max_context: num(process.env.OM_LG_MAX_CONTEXT, 50),
    lg_reflective: (process.env.OM_LG_REFLECTIVE ?? "true") !== "false",
    metadata_backend: str(
        process.env.OM_METADATA_BACKEND,
        "sqlite",
    ).toLowerCase(),
    vector_backend: str(process.env.OM_VECTOR_BACKEND, "sqlite").toLowerCase(),
    ide_mode: bool(process.env.OM_IDE_MODE),
    ide_allowed_origins: str(
        process.env.OM_IDE_ALLOWED_ORIGINS,
        "http://localhost:5173,http://localhost:3000",
    ).split(","),
    auto_reflect: bool(process.env.OM_AUTO_REFLECT),
    reflect_interval: num(process.env.OM_REFLECT_INTERVAL, 10),
    reflect_min: num(process.env.OM_REFLECT_MIN_MEMORIES, 20),
    user_summary_interval: num(process.env.OM_USER_SUMMARY_INTERVAL, 30),
    use_summary_only: (process.env.OM_USE_SUMMARY_ONLY ?? "true") !== "false",
    summary_max_length: num(process.env.OM_SUMMARY_MAX_LENGTH, 200),
    seg_size: num(process.env.OM_SEG_SIZE, 10000),
    cache_segments: num(process.env.OM_CACHE_SEGMENTS, tier_cache[tier]),
    max_active: num(process.env.OM_MAX_ACTIVE, tier_max_active[tier]),
    decay_ratio: num(process.env.OM_DECAY_RATIO, 0.03),
    decay_sleep_ms: num(process.env.OM_DECAY_SLEEP_MS, 200),
    decay_threads: num(process.env.OM_DECAY_THREADS, 3),
    decay_cold_threshold: num(process.env.OM_DECAY_COLD_THRESHOLD, 0.25),
    decay_reinforce_on_query:
        (process.env.OM_DECAY_REINFORCE_ON_QUERY ?? "true") !== "false",
    regeneration_enabled:
        (process.env.OM_REGENERATION_ENABLED ?? "true") !== "false",
    max_vector_dim: num(process.env.OM_MAX_VECTOR_DIM, tier_dims[tier]),
    min_vector_dim: num(process.env.OM_MIN_VECTOR_DIM, 64),
    summary_layers: num(process.env.OM_SUMMARY_LAYERS, 3),
    keyword_boost: num(process.env.OM_KEYWORD_BOOST, 2.5),
    keyword_min_length: num(process.env.OM_KEYWORD_MIN_LENGTH, 3),
};
