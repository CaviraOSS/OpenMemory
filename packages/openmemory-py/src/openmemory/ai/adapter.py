from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class AIAdapter(ABC):
    @abstractmethod
    async def chat(self, messages: List[Dict[str, str]], model: str = None, **kwargs) -> str:
        """Simple chat completion"""
        pass

    @abstractmethod
    async def embed(self, text: str, model: str = None) -> List[float]:
        """Generate single embedding"""
        pass

    @abstractmethod
    async def embed_batch(self, texts: List[str], model: str = None) -> List[List[float]]:
        """Generate batch embeddings"""
        pass
