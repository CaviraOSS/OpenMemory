import httpx
from typing import List, Dict, Any, Optional
from ..core.config import env
from .adapter import AIAdapter

class OllamaAdapter(AIAdapter):
    def __init__(self, base_url: str = None):
        base = getattr(env, "ollama_base_url", None) or getattr(env, "ollama_url", None)
        self.base_url = base_url or base or "http://localhost:11434"

    async def chat(self, messages: List[Dict[str, str]], model: str = None, **kwargs) -> str:
        m = model or getattr(env, "ollama_model", None) or "llama3"
        url = f"{self.base_url.rstrip('/')}/api/chat"
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json={
                "model": m,
                "messages": messages,
                "stream": False,
                **kwargs
            })
            if res.status_code != 200: raise Exception(f"Ollama: {res.text}")
            return res.json()["message"]["content"]

    async def embed(self, text: str, model: str = None) -> List[float]:
        m = model or env.ollama_embedding_model or "nomic-embed-text"
        return (await self.embed_batch([text], m))[0]

    async def embed_batch(self, texts: List[str], model: str = None) -> List[List[float]]:
        m = model or env.ollama_embedding_model or "nomic-embed-text"
        url = f"{self.base_url.rstrip('/')}/api/embeddings"
        res = []
        async with httpx.AsyncClient() as client:
            for t in texts:
                r = await client.post(url, json={"model": m, "prompt": t})
                if r.status_code != 200: raise Exception(f"Ollama Emb: {r.text}")
                res.append(r.json()["embedding"])
        return res
