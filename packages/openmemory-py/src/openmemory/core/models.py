import yaml
import os
from pathlib import Path
from typing import Dict, Any, Optional

ModelCfg = Dict[str, Dict[str, str]]

_cfg: Optional[ModelCfg] = None

def get_defaults() -> ModelCfg:
    return {
        "episodic": { "openai": "text-embedding-3-small", "local": "all-MiniLM-L6-v2" },
        "semantic": { "openai": "text-embedding-3-small", "local": "all-MiniLM-L6-v2" },
        "procedural": { "openai": "text-embedding-3-small", "local": "all-MiniLM-L6-v2" },
        "emotional": { "openai": "text-embedding-3-small", "local": "all-MiniLM-L6-v2" },
        "reflective": { "openai": "text-embedding-3-large", "local": "all-mpnet-base-v2" }
    }

def load_models() -> ModelCfg:
    global _cfg
    if _cfg: return _cfg
    p = Path(__file__).parent.parent.parent.parent / "models.yml"
    if not p.exists():
        print("[MODELS] models.yml not found, using defaults")
        return get_defaults()

    try:
        with open(p, "r", encoding="utf-8") as f:
            _cfg = yaml.safe_load(f)
            print(f"[MODELS] Loaded models.yml")
            return _cfg
    except Exception as e:
        print(f"[MODELS] Failed to parse models.yml: {e}")
        return get_defaults()

def get_model(sector: str, provider: str) -> str:
    cfg = load_models()
    sec = cfg.get(sector) or cfg.get("semantic") or {}
    return sec.get(provider, "all-MiniLM-L6-v2")
