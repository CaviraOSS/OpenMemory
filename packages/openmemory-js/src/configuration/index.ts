import { loadEnvFiles } from "./envFile";

loadEnvFiles(__dirname);
const num = (v: string | undefined, d: number) => Number(v) || d;
const str = (v: string | undefined, d: string) => v || d;
const bool = (v: string | undefined) => v === "true";

export const env = {
  port: num(process.env.OM_PORT, 8080),
  api_key: process.env.OM_API_KEY,
  require_api_key:
    bool(process.env.OM_REQUIRE_API_KEY) ||
    process.env.NODE_ENV === "production" ||
    str(process.env.OM_MODE, "standard").toLowerCase() === "production",
  rate_limit_enabled: bool(process.env.OM_RATE_LIMIT_ENABLED),
  rate_limit_window_ms: num(process.env.OM_RATE_LIMIT_WINDOW_MS, 60000),
  rate_limit_max_requests: num(process.env.OM_RATE_LIMIT_MAX_REQUESTS, 100),
  emb_kind: str(process.env.OM_EMBEDDINGS, "synthetic"),
  embedding_fallback: str(process.env.OM_EMBEDDING_FALLBACK, "synthetic")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  openai_key: process.env.OPENAI_API_KEY || process.env.OM_OPENAI_API_KEY || "",
  openai_base_url: str(
    process.env.OM_OPENAI_BASE_URL,
    "https://api.openai.com/v1",
  ),
  openai_model: process.env.OM_OPENAI_MODEL,
  gemini_key: process.env.GEMINI_API_KEY || process.env.OM_GEMINI_API_KEY || "",
  AWS_REGION: process.env.AWS_REGION || "",
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  siray_key:
    process.env.SIRAY_API_TOKEN || process.env.OM_SIRAY_API_TOKEN || "",
  siray_base_url: str(process.env.OM_SIRAY_BASE_URL, "https://api.siray.ai/v1"),
  ollama_url: str(
    process.env.OLLAMA_URL || process.env.OM_OLLAMA_URL,
    "http://localhost:11434",
  ),
  local_model_path:
    process.env.LOCAL_MODEL_PATH || process.env.OM_LOCAL_MODEL_PATH || "",
  vec_dim: num(process.env.OM_VEC_DIM, 1536),
  max_payload_size: num(process.env.OM_MAX_PAYLOAD_SIZE, 1_000_000),
};
