from abc import ABC, abstractmethod
from typing import Dict, Any, AsyncGenerator, List, Optional
import asyncio
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

    async def _get(
        self,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        max_retries: int = 8,
    ) -> Any:
        for attempt in range(max_retries + 1):
            await self.rate_limiter.wait()
            try:
                response = await self.client.get(url, headers=headers or {})
                if response.status_code != 429:
                    response.raise_for_status()
                    return response.json()

                if attempt >= max_retries:
                    response.raise_for_status()

                retry_after_header = response.headers.get("retry-after", "5")
                try:
                    retry_after = float(retry_after_header)
                except (TypeError, ValueError):
                    retry_after = 5.0

                wait_seconds = max(1.0, min(retry_after, 60.0))
                logger.warning(
                    f"Rate limit hit. Waiting {wait_seconds:.1f}s... (attempt {attempt + 1}/{max_retries})"
                )
                await asyncio.sleep(wait_seconds)
            except httpx.HTTPError as e:
                logger.error(f"HTTP Error: {e}")
                raise

        raise RuntimeError("Max retries exceeded")

    @abstractmethod
    async def connect(self) -> Dict[str, Any]:
        """Test connection and return stats"""
        pass

    @abstractmethod
    def export(self) -> AsyncGenerator[MigrationRecord, None]:
        """Yield migration records"""
        raise NotImplementedError
