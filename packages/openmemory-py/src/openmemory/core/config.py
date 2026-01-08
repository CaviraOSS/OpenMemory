import os
import sys
from pathlib import Path
from typing import Literal, List, Optional, Any
from dotenv import load_dotenv
msg_root = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(msg_root)

def num(v: Optional[str], d: int | float) -> int | float:
    try:
        return float(v) if v else d
    except ValueError:
        return d

def s_bool(v: Optional[str]) -> bool:
    return str(v).lower() == "true"

def s_str(v: Optional[str], d: str) -> str:
    return v if v else d

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        tomllib = None

class EnvConfig:
    def __init__(self):
        self._toml = {}
        toml_path = Path("openmemory.toml")
        if tomllib and toml_path.exists():
            with open(toml_path, "rb") as f:
                self._toml = tomllib.load(f)
        def get(sec: str, key: str, env_var: str, default: Any) -> Any:
            val = self._toml.get(sec, {}).get(key)
            if val is not None: return val
            return os.getenv(env_var, default)
        self.db_url = get("db", "url", "OM_DB_URL", "sqlite:///openmemory.db")
        if self.db_url.startswith("sqlite:///"):
            self.db_path = self.db_url.replace("sqlite:///", "")
        else:
            default_db_path = str(Path(__file__).parent.parent.parent.parent / "datta" / "openmemory.sqlite")
            self.db_path = s_str(os.getenv("OM_DB_PATH"), default_db_path)
        self.max_context_items = int(get("context", "max_items", "OM_MAX_CONTEXT_ITEMS", 16))
        self.max_context_tokens = int(get("context", "max_tokens", "OM_MAX_CONTEXT_TOKENS", 2048))
        self.decay_half_life = float(get("decay", "half_life_days", "OM_DECAY_HALF_LIFE", 14))
        self.decay_lambda = num(os.getenv("OM_DECAY_LAMBDA"), 0.02)
        self.openai_key = get("ai", "openai_key", "OPENAI_API_KEY", "") or os.getenv("OM_OPENAI_API_KEY")
        self.openai_base_url = get("ai", "openai_base", "OM_OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.openai_model = get("ai", "openai_model", "OM_OPENAI_MODEL", None)

        self.ollama_url = get("ai", "ollama_url", "OLLAMA_URL", "http://localhost:11434")

        self.emb_kind = get("ai", "embedding_provider", "OM_EMBED_KIND", "synthetic")
        self.gemini_key = get("ai", "gemini_key", "GEMINI_API_KEY",  os.getenv("OM_GEMINI_KEY"))
        self.aws_region = get("ai", "aws_region", "AWS_REGION", None)
        self.aws_access_key_id = get("ai", "aws_access_key_id", "AWS_ACCESS_KEY_ID", None)
        self.aws_secret_access_key = get("ai", "aws_secret_access_key", "AWS_SECRET_ACCESS_KEY", None)
        self.vec_dim = int(num(os.getenv("OM_VEC_DIM"), 1536))
        self.min_score = num(os.getenv("OM_MIN_SCORE"), 0.3)
        self.keyword_boost = num(os.getenv("OM_KEYWORD_BOOST"), 2.5)
        self.seg_size = int(num(os.getenv("OM_SEG_SIZE"), 10000))

        self.decay_threads = int(num(os.getenv("OM_DECAY_THREADS"), 3))
        self.decay_cold_threshold = num(os.getenv("OM_DECAY_COLD_THRESHOLD"), 0.25)
        self.max_vector_dim = int(num(os.getenv("OM_MAX_VECTOR_DIM"), 1536))
        self.min_vector_dim = int(num(os.getenv("OM_MIN_VECTOR_DIM"), 64))
        self.summary_layers = int(num(os.getenv("OM_SUMMARY_LAYERS"), 3))
        self.decay_ratio = num(os.getenv("OM_DECAY_RATIO"), 0.03)
        self.embed_delay_ms = int(num(os.getenv("OM_EMBED_DELAY_MS"), 0))
        self.use_summary_only = s_bool(os.getenv("OM_USE_SUMMARY_ONLY"))
        self.summary_max_length = int(num(os.getenv("OM_SUMMARY_MAX_LENGTH"), 1000))
        self.rate_limit_enabled = s_bool(os.getenv("OM_RATE_LIMIT_ENABLED"))
        self.rate_limit_window_ms = int(num(os.getenv("OM_RATE_LIMIT_WINDOW_MS"), 60000))
        self.rate_limit_max_requests = int(num(os.getenv("OM_RATE_LIMIT_MAX"), 100))
        self.keyword_min_length = int(num(os.getenv("OM_KEYWORD_MIN_LENGTH"), 3))
        self.user_summary_interval = int(num(os.getenv("OM_USER_SUMMARY_INTERVAL"), 30))
        self.ollama_embedding_model = os.getenv("OM_OLLAMA_EMBEDDING_MODEL")
        self.gemini_embedding_model = os.getenv("OM_GEMINI_EMBEDDING_MODEL")
        self.aws_embedding_model = os.getenv("OM_AWS_EMBEDDING_MODEL")
    @property
    def database_url(self) -> str:
        return self.db_url

    @database_url.setter
    def database_url(self, val: str):
        self.db_url = val
        if val.startswith("sqlite:///"):
            self.db_path = val.replace("sqlite:///", "")

env = EnvConfig()
