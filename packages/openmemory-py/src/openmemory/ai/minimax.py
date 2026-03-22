import os
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
import httpx
from ..core.config import env
from .adapter import AIAdapter


class MiniMaxAdapter(AIAdapter):
    """MiniMax AI adapter for chat completions and embeddings.

    Chat uses MiniMax's OpenAI-compatible API.
    Embeddings use MiniMax's native embo-01 endpoint (1536 dimensions).
    """

    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or env.minimax_key
        self.base_url = base_url or env.minimax_base_url
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    async def chat(self, messages: List[Dict[str, str]], model: str = None, **kwargs) -> str:
        m = model or env.minimax_model or "MiniMax-M2.7"
        temperature = kwargs.pop("temperature", None)
        if temperature is not None:
            temperature = max(0.0, min(float(temperature), 1.0))
            kwargs["temperature"] = temperature
        res = await self.client.chat.completions.create(
            model=m,
            messages=messages,
            **kwargs
        )
        return res.choices[0].message.content or ""

    async def embed(self, text: str, model: str = None) -> List[float]:
        m = model or env.minimax_embedding_model or "embo-01"
        result = await self._native_embed([text], m, embed_type="query")
        return result[0]

    async def embed_batch(self, texts: List[str], model: str = None) -> List[List[float]]:
        m = model or env.minimax_embedding_model or "embo-01"
        return await self._native_embed(texts, m, embed_type="db")

    async def _native_embed(
        self, texts: List[str], model: str, embed_type: str = "db"
    ) -> List[List[float]]:
        """Call MiniMax's native embedding endpoint.

        MiniMax embedding API is NOT OpenAI-compatible.
        Request: {"model": "embo-01", "texts": [...], "type": "db"|"query"}
        Response: {"vectors": [[...]], "total_tokens": N}
        """
        url = f"{self.base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "texts": texts,
            "type": embed_type,
        }
        async with httpx.AsyncClient() as http:
            resp = await http.post(url, json=payload, headers=headers, timeout=30.0)
            resp.raise_for_status()
            data = resp.json()
        base_resp = data.get("base_resp", {})
        if base_resp.get("status_code", 0) != 0:
            raise RuntimeError(
                f"MiniMax embedding error: {base_resp.get('status_msg', 'unknown error')}"
            )
        return data["vectors"]
