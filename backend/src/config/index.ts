import path from 'path'
import dotenv from 'dotenv'
import os from 'node:os'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const num = (v: string | undefined, d: number) => Number(v) || d
const str = (v: string | undefined, d: string) => v || d
const bool = (v: string | undefined) => v === 'true'

type Tier = 'fast' | 'smart' | 'deep'
function detectTier(): Tier {
    const manual = process.env.OM_TIER as Tier
    if (manual && ['fast', 'smart', 'deep'].includes(manual)) return manual
    const cores = os.cpus().length
    const ramGB = os.totalmem() / (1024 ** 3)
    if (cores >= 8 && ramGB >= 16) return 'deep'
    if (cores >= 4 && ramGB >= 8) return 'smart'
    return 'fast'
}

export const tier = detectTier()
const tierDims = { fast: 256, smart: 384, deep: 1536 }
const tierCache = { fast: 2, smart: 3, deep: 5 }
const tierMaxActive = { fast: 32, smart: 64, deep: 128 }

export const env = {
    port: num(process.env.OM_PORT, 8080),
    db_path: str(process.env.OM_DB_PATH, './data/openmemory.sqlite'),
    api_key: process.env.OM_API_KEY,
    rate_limit_enabled: bool(process.env.OM_RATE_LIMIT_ENABLED),
    rate_limit_window_ms: num(process.env.OM_RATE_LIMIT_WINDOW_MS, 60000),
    rate_limit_max_requests: num(process.env.OM_RATE_LIMIT_MAX_REQUESTS, 100),
    compression_enabled: bool(process.env.OM_COMPRESSION_ENABLED),
    compression_algorithm: str(process.env.OM_COMPRESSION_ALGORITHM, 'auto') as 'semantic' | 'syntactic' | 'aggressive' | 'auto',
    compression_min_length: num(process.env.OM_COMPRESSION_MIN_LENGTH, 100),
    emb_kind: str(process.env.OM_EMBEDDINGS, 'synthetic'),
    embed_mode: str(process.env.OM_EMBED_MODE, 'simple'),
    adv_embed_parallel: bool(process.env.OM_ADV_EMBED_PARALLEL),
    embed_delay_ms: num(process.env.OM_EMBED_DELAY_MS, 200),
    openai_key: process.env.OPENAI_API_KEY || process.env.OM_OPENAI_API_KEY || '',
    openai_base_url: str(process.env.OM_OPENAI_BASE_URL, 'https://api.openai.com/v1'),
    openai_model: process.env.OM_OPENAI_MODEL,
    gemini_key: process.env.GEMINI_API_KEY || process.env.OM_GEMINI_API_KEY || '',
    ollama_url: str(process.env.OLLAMA_URL || process.env.OM_OLLAMA_URL, 'http://localhost:11434'),
    local_model_path: process.env.LOCAL_MODEL_PATH || process.env.OM_LOCAL_MODEL_PATH || '',
    vec_dim: num(process.env.OM_VEC_DIM, tierDims[tier]),
    min_score: num(process.env.OM_MIN_SCORE, 0.3),
    decay_lambda: num(process.env.OM_DECAY_LAMBDA, 0.02),
    decay_interval_minutes: num(process.env.OM_DECAY_INTERVAL_MINUTES, 1440),
    max_payload_size: num(process.env.OM_MAX_PAYLOAD_SIZE, 1_000_000),
    mode: str(process.env.OM_MODE, 'standard').toLowerCase(),
    lg_namespace: str(process.env.OM_LG_NAMESPACE, 'default'),
    lg_max_context: num(process.env.OM_LG_MAX_CONTEXT, 50),
    lg_reflective: (process.env.OM_LG_REFLECTIVE ?? 'true') !== 'false',
    metadata_backend: str(process.env.OM_METADATA_BACKEND, 'sqlite').toLowerCase(),
    vector_backend: str(process.env.OM_VECTOR_BACKEND, 'sqlite').toLowerCase(),
    ide_mode: bool(process.env.OM_IDE_MODE),
    ide_allowed_origins: str(process.env.OM_IDE_ALLOWED_ORIGINS, 'http://localhost:5173,http://localhost:3000').split(','),
    auto_reflect: bool(process.env.OM_AUTO_REFLECT),
    reflect_interval: num(process.env.OM_REFLECT_INTERVAL, 10),
    reflect_min: num(process.env.OM_REFLECT_MIN_MEMORIES, 20),
    use_summary_only: (process.env.OM_USE_SUMMARY_ONLY ?? 'true') !== 'false',
    summary_max_length: num(process.env.OM_SUMMARY_MAX_LENGTH, 200),
    seg_size: num(process.env.OM_SEG_SIZE, 10000),
    cache_segments: num(process.env.OM_CACHE_SEGMENTS, tierCache[tier]),
    max_active: num(process.env.OM_MAX_ACTIVE, tierMaxActive[tier]),
    decay_ratio: num(process.env.OM_DECAY_RATIO, 0.03),
    decay_sleep_ms: num(process.env.OM_DECAY_SLEEP_MS, 200)
}

