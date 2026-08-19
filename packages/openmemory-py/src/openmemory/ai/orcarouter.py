import os
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
from ..core.config import env
from .adapter import AIAdapter


class OrcaRouterAdapter(AIAdapter):
    """OrcaRouter adapter for chat completions and embeddings.

    OrcaRouter exposes an OpenAI-compatible API gateway at
    https://api.orcarouter.ai/v1. It also runs gateway-level, zero-trust
    security for AI agents on the same endpoint.
    """

    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or env.orcarouter_key
        self.base_url = base_url or env.orcarouter_base_url
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    async def chat(self, messages: List[Dict[str, str]], model: str = None, **kwargs) -> str:
        m = model or env.orcarouter_model or "orcarouter/auto"
        res = await self.client.chat.completions.create(
            model=m,
            messages=messages,
            **kwargs
        )
        return res.choices[0].message.content or ""

    async def embed(self, text: str, model: str = None) -> List[float]:
        m = model or env.orcarouter_embedding_model or "orcarouter/auto"
        res = await self.client.embeddings.create(input=text, model=m)
        return res.data[0].embedding

    async def embed_batch(self, texts: List[str], model: str = None) -> List[List[float]]:
        m = model or env.orcarouter_embedding_model or "orcarouter/auto"
        res = await self.client.embeddings.create(input=texts, model=m)
        return [d.embedding for d in res.data]
