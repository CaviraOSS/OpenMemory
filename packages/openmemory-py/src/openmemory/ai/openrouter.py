from typing import List, Dict

from openai import AsyncOpenAI

from ..core.config import env
from .adapter import AIAdapter


class OpenRouterAdapter(AIAdapter):
    """OpenRouter adapter for chat completions and embeddings."""

    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or env.openrouter_key
        self.base_url = base_url or env.openrouter_base_url
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    async def chat(
        self, messages: List[Dict[str, str]], model: str = None, **kwargs
    ) -> str:
        selected_model = model or env.openrouter_model or "openrouter/auto"
        response = await self.client.chat.completions.create(
            model=selected_model,
            messages=messages,
            **kwargs,
        )
        return response.choices[0].message.content or ""

    async def embed(self, text: str, model: str = None) -> List[float]:
        selected_model = (
            model
            or env.openrouter_embedding_model
            or "openai/text-embedding-3-small"
        )
        response = await self.client.embeddings.create(
            input=text,
            model=selected_model,
        )
        return response.data[0].embedding

    async def embed_batch(
        self, texts: List[str], model: str = None
    ) -> List[List[float]]:
        selected_model = (
            model
            or env.openrouter_embedding_model
            or "openai/text-embedding-3-small"
        )
        response = await self.client.embeddings.create(
            input=texts,
            model=selected_model,
        )
        return [item.embedding for item in response.data]
