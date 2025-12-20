from abc import ABC, abstractmethod
from typing import Dict, Any, AsyncGenerator, List
import httpx
from ..schemas import MigrationConfig, MigrationRecord
from ..utils import RateLimiter, logger

class BaseProvider(ABC):
    def __init__(self, config: MigrationConfig):
        self.config = config
        self.rate_limiter = RateLimiter(config.rate_limit)
        self.client = httpx.AsyncClient(timeout=60.0)

    async def close(self):
        await self.client.aclose()

    async def _get(self, url: str, headers: Dict[str, str] = None) -> Any:
        await self.rate_limiter.wait()
        try:
            response = await self.client.get(url, headers=headers)
            if response.status_code == 429:
                retry_after = int(response.headers.get("retry-after", "60"))
                logger.warning(f"Rate limit hit. Waiting {retry_after}s...")
                await self.rate_limiter.wait() # Simplified wait, ideally sleep
                return await self._get(url, headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error(f"HTTP Error: {e}")
            raise

    @abstractmethod
    async def connect(self) -> Dict[str, Any]:
        """Test connection and return stats"""
        pass

    @abstractmethod
    async def export(self) -> AsyncGenerator[MigrationRecord, None]:
        """Yield migration records"""
        pass
