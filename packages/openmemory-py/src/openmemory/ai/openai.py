import os
from typing import List, Dict, Any, Optional
from openai import AsyncOpenAI
from ..core.config import env
from .adapter import AIAdapter

class OpenAIAdapter(AIAdapter):
    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or env.openai_key
        self.base_url = base_url or env.openai_base_url
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    async def chat(self, messages: List[Dict[str, str]], model: str = None, **kwargs) -> str:
        m = model or env.openai_model or "gpt-4o-mini"
        res = await self.client.chat.completions.create(
            model=m,
            messages=messages,
            **kwargs
        )
        return res.choices[0].message.content or ""

    async def embed(self, text: str, model: str = None) -> List[float]:
        m = model or "text-embedding-3-small"
        res = await self.client.embeddings.create(input=text, model=m)
        return res.data[0].embedding

    async def embed_batch(self, texts: List[str], model: str = None) -> List[List[float]]:
        m = model or "text-embedding-3-small"
        res = await self.client.embeddings.create(input=texts, model=m)
        return [d.embedding for d in res.data]
