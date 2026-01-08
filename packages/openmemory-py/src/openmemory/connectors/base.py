"""
base connector class for openmemory data sources
"""
from typing import Any, List, Dict, Optional
from abc import ABC, abstractmethod
import os

class base_connector(ABC):
    """base class for all connectors"""

    name: str = "base"

    def __init__(self, user_id: str = None):
        self.user_id = user_id or "anonymous"
        self._connected = False

    @property
    def connected(self) -> bool:
        return self._connected

    @abstractmethod
    async def connect(self, **creds) -> bool:
        """authenticate with the service"""
        pass

    @abstractmethod
    async def list_items(self, **filters) -> List[Dict]:
        """list available items from the source"""
        pass

    @abstractmethod
    async def fetch_item(self, item_id: str) -> Dict:
        """fetch a single item by id"""
        pass

    async def ingest_all(self, **filters) -> List[str]:
        """fetch and ingest all items matching filters"""
        from ..ops.ingest import ingest_document

        items = await self.list_items(**filters)
        ids = []

        for item in items:
            content = await self.fetch_item(item["id"])
            result = await ingest_document(
                t=content.get("type", "text"),
                data=content.get("data", content.get("text", "")),
                meta={"source": self.name, **content.get("meta", {})},
                user_id=self.user_id
            )
            ids.append(result["root_memory_id"])

        return ids

    def _get_env(self, key: str, default: str = None) -> Optional[str]:
        """helper to get env var"""
        return os.environ.get(key, default)
