import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class Config:
    def __init__(self):
        self.env = {
            # Server
            "port": int(os.getenv("OM_PORT", "8080")),
            "api_key": os.getenv("OM_API_KEY", ""),
            "rate_limit_enabled": os.getenv("OM_RATE_LIMIT_ENABLED", "true").lower() == "true",
            "rate_limit_window": int(os.getenv("OM_RATE_LIMIT_WINDOW_MS", "60000")),
            "rate_limit_max": int(os.getenv("OM_RATE_LIMIT_MAX_REQUESTS", "100")),
            "log_auth": os.getenv("OM_LOG_AUTH", "false").lower() == "true",
            "telemetry": os.getenv("OM_TELEMETRY", "true").lower() == "true",
            "mode": os.getenv("OM_MODE", "standard"),

            # Metadata
            "metadata_backend": os.getenv("OM_METADATA_BACKEND", "sqlite"),
            "db_path": os.getenv("OM_DB_PATH", "./data/openmemory.sqlite"),
            "pg_host": os.getenv("OM_PG_HOST", "localhost"),
            "pg_port": int(os.getenv("OM_PG_PORT", "5432")),
            "pg_db": os.getenv("OM_PG_DB", "openmemory"),
            "pg_user": os.getenv("OM_PG_USER", "postgres"),
            "pg_pass": os.getenv("OM_PG_PASSWORD", "postgres"),
            "pg_schema": os.getenv("OM_PG_SCHEMA", "public"),
            "pg_table": os.getenv("OM_PG_TABLE", "openmemory_memories"),
            "pg_ssl": os.getenv("OM_PG_SSL", "disable"),

            # Vector
            "vector_backend": os.getenv("OM_VECTOR_BACKEND", "sqlite"),
            "vector_table": os.getenv("OM_VECTOR_TABLE", "openmemory_vectors"),
            "weaviate_url": os.getenv("OM_WEAVIATE_URL", ""),
            "weaviate_key": os.getenv("OM_WEAVIATE_API_KEY", ""),
            "weaviate_class": os.getenv("OM_WEAVIATE_CLASS", "OpenMemory"),

            # Embeddings
            "emb_kind": os.getenv("OM_EMBEDDINGS", "openai"),
            "vec_dim": int(os.getenv("OM_VEC_DIM", "1536")),
            "embed_mode": os.getenv("OM_EMBED_MODE", "simple"),
            "adv_embed_parallel": os.getenv("OM_ADV_EMBED_PARALLEL", "false").lower() == "true",
            "embed_delay": int(os.getenv("OM_EMBED_DELAY_MS", "200")),
            "openai_base": os.getenv("OM_OPENAI_BASE_URL", "https://api.openai.com/v1"),
            "openai_model": os.getenv("OM_OPENAI_MODEL", ""),
            "max_payload": int(os.getenv("OM_MAX_PAYLOAD_SIZE", "1000000")),

            # API Keys
            "openai_key": os.getenv("OPENAI_API_KEY", ""),
            "gemini_key": os.getenv("GEMINI_API_KEY", ""),
            "AWS_ACCESS_KEY_ID": os.getenv("AWS_ACCESS_KEY_ID", ""),
            "AWS_SECRET_ACCESS_KEY": os.getenv("AWS_SECRET_ACCESS_KEY", ""),
            "AWS_REGION": os.getenv("AWS_REGION", "us-east-1"),
            "ollama_url": os.getenv("OLLAMA_URL", "http://localhost:11434"),
            "local_model_path": os.getenv("LOCAL_MODEL_PATH", ""),

            # Tier
            "tier": os.getenv("OM_TIER", "hybrid"),
            "keyword_boost": float(os.getenv("OM_KEYWORD_BOOST", "2.5")),
            "keyword_min_len": int(os.getenv("OM_KEYWORD_MIN_LENGTH", "3")),
            "min_score": float(os.getenv("OM_MIN_SCORE", "0.3")),

            # Decay
            "decay_interval_minutes": int(os.getenv("OM_DECAY_INTERVAL_MINUTES", "120")),
            "decay_threads": int(os.getenv("OM_DECAY_THREADS", "3")),
            "decay_cold_threshold": float(os.getenv("OM_DECAY_COLD_THRESHOLD", "0.25")),
            "decay_reinforce_on_query": os.getenv("OM_DECAY_REINFORCE_ON_QUERY", "true").lower() == "true",
            "regeneration_enabled": os.getenv("OM_REGENERATION_ENABLED", "true").lower() == "true",
            "max_vector_dim": int(os.getenv("OM_MAX_VECTOR_DIM", "1536")),
            "min_vector_dim": int(os.getenv("OM_MIN_VECTOR_DIM", "64")),
            "summary_layers": int(os.getenv("OM_SUMMARY_LAYERS", "3")),

            # Graph
            "use_summary_only": os.getenv("OM_USE_SUMMARY_ONLY", "true").lower() == "true",
            "summary_max_len": int(os.getenv("OM_SUMMARY_MAX_LENGTH", "300")),
            "seg_size": int(os.getenv("OM_SEG_SIZE", "10000")),
            "cache_segments": int(os.getenv("OM_CACHE_SEGMENTS", "3")),
            "max_active": int(os.getenv("OM_MAX_ACTIVE", "64")),

            # Reflection
            "auto_reflect": os.getenv("OM_AUTO_REFLECT", "false").lower() == "true",
            "reflect_interval": int(os.getenv("OM_REFLECT_INTERVAL", "10")),
            "reflect_min": int(os.getenv("OM_REFLECT_MIN_MEMORIES", "20")),

            # Compression
            "compression_enabled": os.getenv("OM_COMPRESSION_ENABLED", "false").lower() == "true",
            "compression_min_length": int(os.getenv("OM_COMPRESSION_MIN_LENGTH", "100")),
            "compression_algorithm": os.getenv("OM_COMPRESSION_ALGORITHM", "auto"),

            # LangGraph
            "lg_namespace": os.getenv("OM_LG_NAMESPACE", "default"),
            "lg_max_context": int(os.getenv("OM_LG_MAX_CONTEXT", "50")),
            "lg_reflective": os.getenv("OM_LG_REFLECTIVE", "true").lower() == "true",
        }

    def configure(self, options: dict):
        self.env.update(options)

# Singleton instance
config = Config()
env = config.env
configure = config.configure
