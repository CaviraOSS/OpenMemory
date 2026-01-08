import asyncio
import time
import math
import json
import hashlib
from typing import List, Dict, Optional, Any, Tuple
import numpy as np
import httpx

from ..core.config import env
from ..core.models import get_model
from ..core.db import q
from ..core.constants import SECTOR_CONFIGS, SEC_WTS
from ..utils.text import canonical_tokens_from_text, synonyms_for, canonicalize_token
from ..utils.vectors import vec_to_buf, buf_to_vec

from ..ai.openai import OpenAIAdapter
from ..ai.ollama import OllamaAdapter
from ..ai.gemini import GeminiAdapter
from ..ai.aws import AwsAdapter
from ..ai.synthetic import SyntheticAdapter

async def emb_dispatch(provider: str, t: str, s: str) -> List[float]:
    if provider == "synthetic":
        return await SyntheticAdapter(env.vec_dim or 768).embed(t, model=s)
    if provider == "openai":
        return await OpenAIAdapter().embed(t, model=env.openai_model)
    if provider == "ollama":
        return await OllamaAdapter().embed(t, model=env.ollama_embedding_model)
    if provider == "gemini":
        return await GeminiAdapter().embed(t, model=env.gemini_embedding_model)
    if provider == "aws":
        return await AwsAdapter().embed(t, model=env.aws_embedding_model)

    return await SyntheticAdapter(env.vec_dim or 768).embed(t, model=s)

async def embed_for_sector(t: str, s: str) -> List[float]:
    if s not in SECTOR_CONFIGS: raise Exception(f"Unknown sector: {s}")

    return await emb_dispatch(env.emb_kind or "synthetic", t, s)

async def embed_multi_sector(id: str, txt: str, secs: List[str], chunks: Optional[List[dict]] = None) -> List[Dict[str, Any]]:
    q.ins_log(id=id, model="multi-sector", status="pending", ts=int(time.time()*1000), err=None)

    res = []
    try:
        for s in secs:
            v = await embed_for_sector(txt, s)
            res.append({"sector": s, "vector": v, "dim": len(v)})

        q.upd_log(id=id, status="completed", err=None)
        return res
    except Exception as e:
        q.upd_log(id=id, status="failed", err=str(e))
        raise e
def calc_mean_vec(emb_res: List[Dict[str, Any]], all_sectors: List[str]) -> List[float]:
    if not emb_res: return []
    d = emb_res[0]["dim"]
    mean = np.zeros(d, dtype=np.float32)
    for r in emb_res:
         mean += np.array(r["vector"], dtype=np.float32)
    mean /= len(emb_res)
    return mean.tolist()
