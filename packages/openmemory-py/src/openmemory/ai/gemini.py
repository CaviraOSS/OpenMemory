import httpx
import os
import asyncio
from typing import List, Dict, Any, Optional
from ..core.config import env
from .adapter import AIAdapter

class GeminiAdapter(AIAdapter):
    def __init__(self, api_key: str = None):
        self.api_key = api_key or env.gemini_key or os.getenv("GEMINI_API_KEY")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def chat(self, messages: List[Dict[str, str]], model: str = None, **kwargs) -> str:
        if not self.api_key: raise ValueError("Gemini key missing")
        m = model or "models/gemini-1.5-flash"
        if "models/" not in m: m = f"models/{m}"

        contents = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            content = msg["content"]
            if msg["role"] == "system":
                 content = f"System Instruction: {content}"
                 role = "user"

            contents.append({
                "role": role,
                "parts": [{ "text": content }]
            })

        url = f"{self.base_url}/{m}:generateContent?key={self.api_key}"

        async with httpx.AsyncClient() as client:
            res = await client.post(url, json={
                "contents": contents,
                "generationConfig": kwargs
            })

            if res.status_code != 200:
                raise Exception(f"Gemini Chat Error: {res.text}")

            data = res.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                return ""

    async def embed(self, text: str, model: str = None) -> List[float]:
        return (await self.embed_batch([text], model))[0]

    async def embed_batch(self, texts: List[str], model: str = None) -> List[List[float]]:
        if not self.api_key: raise ValueError("Gemini key missing")
        m = model or "models/text-embedding-004"
        if "models/" not in m: m = f"models/{m}"

        url = f"{self.base_url}/{m}:batchEmbedContents?key={self.api_key}"

        reqs = []
        for t in texts:
            reqs.append({
                "model": m,
                "content": { "parts": [{ "text": t }] },
                "taskType": "SEMANTIC_SIMILARITY"
            })

        async with httpx.AsyncClient() as client:
            res = await client.post(url, json={"requests": reqs})
            if res.status_code != 200: raise Exception(f"Gemini: {res.text}")

            data = res.json()
            if "embeddings" not in data: return []
            return [e["values"] for e in data["embeddings"]]
