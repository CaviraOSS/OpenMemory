import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

export const env = {
    port: Number(process.env.OM_PORT) || 8080,
    db_path: process.env.OM_DB_PATH || './data/openmemory.sqlite',
    api_key: /*process.env.OM_API_KEY ||*/ '',
    emb_kind: process.env.OM_EMBEDDINGS || 'synthetic',
    embed_mode: process.env.OM_EMBED_MODE || 'simple',
    adv_embed_parallel: process.env.OM_ADV_EMBED_PARALLEL === 'true',
    embed_delay_ms: Number(process.env.OM_EMBED_DELAY_MS) || 200,
    openai_key: process.env.OPENAI_API_KEY || process.env.OM_OPENAI_API_KEY || '',
    openai_base_url: process.env.OM_OPENAI_BASE_URL || 'https://api.openai.com/v1',
    openai_model: process.env.OM_OPENAI_MODEL || undefined,
    gemini_key: process.env.GEMINI_API_KEY || process.env.OM_GEMINI_API_KEY || '',
    ollama_url: process.env.OLLAMA_URL || process.env.OM_OLLAMA_URL || 'http://localhost:11434',
    local_model_path: process.env.LOCAL_MODEL_PATH || process.env.OM_LOCAL_MODEL_PATH || '',
    vec_dim: Number(process.env.OM_VEC_DIM) || 768,
    min_score: Number(process.env.OM_MIN_SCORE) || 0.3,
    decay_lambda: Number(process.env.OM_DECAY_LAMBDA) || 0.02,
    max_payload_size: Number(process.env.OM_MAX_PAYLOAD_SIZE) || 1_000_000,
    mode: (process.env.OM_MODE || 'standard').toLowerCase(),
    lg_namespace: process.env.OM_LG_NAMESPACE || 'default',
    lg_max_context: Number(process.env.OM_LG_MAX_CONTEXT) || 50,
    lg_reflective: (process.env.OM_LG_REFLECTIVE ?? 'true').toLowerCase() !== 'false',
    metadata_backend: (process.env.OM_METADATA_BACKEND || 'sqlite').toLowerCase(),
    vector_backend: (process.env.OM_VECTOR_BACKEND || 'sqlite').toLowerCase()
}
