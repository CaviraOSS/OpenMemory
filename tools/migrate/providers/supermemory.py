from typing import Dict, Any, AsyncGenerator, List
from .base import BaseProvider
from ..schemas import MigrationRecord
from ..utils import logger

class SupermemoryProvider(BaseProvider):
    def __init__(self, config):
        super().__init__(config)
        self.base_url = config.source_url or "https://api.supermemory.ai"
        self.headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json"
        }

    async def connect(self) -> Dict[str, Any]:
        try:
            url = f"{self.base_url}/v3/documents?limit=1"
            data = await self._get(url, headers=self.headers)
            return {"ok": True, "documents": data.get("total", 0)}
        except Exception as e:
            raise Exception(f"Supermemory connection failed: {e}")

    async def export(self) -> AsyncGenerator[MigrationRecord, None]:
        try:
            logger.info("[SUPERMEMORY] Fetching documents...")
            page = 1
            limit = 100
            total = 0
            
            while True:
                url = f"{self.base_url}/v3/documents?page={page}&limit={limit}"
                data = await self._get(url, headers=self.headers)
                batch = data.get("documents", []) or data.get("data", [])
                
                if not batch:
                    break
                    
                for doc in batch:
                    yield self._transform(doc)
                    total += 1
                    if total % 100 == 0:
                        logger.info(f"[SUPERMEMORY] Exported {total} documents...")

                page += 1
                if len(batch) < limit:
                    break
        except Exception as e:
            logger.error(f"[SUPERMEMORY] Export failed: {e}")
            raise

    def _transform(self, d: Dict) -> MigrationRecord:
        from dateutil import parser
        
        created_at = 0
        if d.get("created_at"):
            try:
                created_at = int(parser.parse(d["created_at"]).timestamp() * 1000)
            except: pass

        return MigrationRecord(
            id=str(d.get("id") or d.get("document_id") or f"sm_{created_at}"),
            uid=str(d.get("user_id") or d.get("owner_id") or "default"),
            content=d.get("content") or d.get("text") or d.get("body") or "",
            tags=d.get("tags") or d.get("labels") or [],
            metadata={
                "provider": "supermemory",
                "source": d.get("source"),
                "url": d.get("url"),
                "original_metadata": d.get("metadata", {})
            },
            created_at=created_at
        )
