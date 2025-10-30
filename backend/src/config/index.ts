import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

const num = (v: string | undefined, d: number) => Number(v) || d
const str = (v: string | undefined, d: string) => v || d
const bool = (v: string | undefined) => v === 'true'

export const env = {
    port: num(process.env.OM_PORT, 8080),
    db_path: str(process.env.OM_DB_PATH, './data/openmemory.sqlite'),
    api_key: process.env.OM_API_KEY,
    rate_limit_enabled: bool(process.env.OM_RATE_LIMIT_ENABLED),
    rate_limit_window_ms: num(process.env.OM_RATE_LIMIT_WINDOW_MS, 60000),
    rate_limit_max_requests: num(process.env.OM_RATE_LIMIT_MAX_REQUESTS, 100),
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
    vec_dim: num(process.env.OM_VEC_DIM, 768),
    min_score: num(process.env.OM_MIN_SCORE, 0.3),
    decay_lambda: num(process.env.OM_DECAY_LAMBDA, 0.02),
    max_payload_size: num(process.env.OM_MAX_PAYLOAD_SIZE, 1_000_000),
    mode: str(process.env.OM_MODE, 'standard').toLowerCase(),
    lg_namespace: str(process.env.OM_LG_NAMESPACE, 'default'),
    lg_max_context: num(process.env.OM_LG_MAX_CONTEXT, 50),
    lg_reflective: (process.env.OM_LG_REFLECTIVE ?? 'true') !== 'false',
    metadata_backend: str(process.env.OM_METADATA_BACKEND, 'sqlite').toLowerCase(),
    vector_backend: str(process.env.OM_VECTOR_BACKEND, 'sqlite').toLowerCase(),
    ide_mode: bool(process.env.OM_IDE_MODE),
    ide_allowed_origins: str(process.env.OM_IDE_ALLOWED_ORIGINS, 'http://localhost:5173,http://localhost:3000').split(',')
}

