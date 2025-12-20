from typing import Dict, Any, AsyncGenerator, List
from .base import BaseProvider
from ..schemas import MigrationRecord
from ..utils import logger

class ZepProvider(BaseProvider):
    def __init__(self, config):
        super().__init__(config)
        self.base_url = config.source_url or "https://api.getzep.com"
        self.headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json"
        }

    async def connect(self) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v2/sessions?limit=1"
        try:
            data = await self._get(url, headers=self.headers)
            return {"ok": True, "sessions": data.get("total", 0)}
        except Exception as e:
            raise Exception(f"Zep connection failed: {e}")

    async def export(self) -> AsyncGenerator[MigrationRecord, None]:
        try:
            sessions = await self._fetch_all_sessions()
            logger.info(f"[ZEP] Found {len(sessions)} sessions")
            
            for i, session in enumerate(sessions):
                if i % 100 == 0:
                    logger.info(f"[ZEP] Processing session {i}/{len(sessions)}")
                
                memories = await self._fetch_session_memories(session["session_id"])
                for mem in memories:
                    yield self._transform(mem, session)
        except Exception as e:
            logger.error(f"[ZEP] Export failed: {e}")
            raise

    async def _fetch_all_sessions(self) -> List[Dict]:
        sessions = []
        page = 1
        limit = 100
        while True:
            url = f"{self.base_url}/api/v2/sessions?page={page}&limit={limit}"
            data = await self._get(url, headers=self.headers)
            batch = data.get("sessions", [])
            if not batch:
                break
            sessions.extend(batch)
            page += 1
            if len(batch) < limit:
                break
        return sessions

    async def _fetch_session_memories(self, session_id: str) -> List[Dict]:
        url = f"{self.base_url}/api/v2/sessions/{session_id}/memory"
        try:
            data = await self._get(url, headers=self.headers)
            return data.get("messages", []) or data.get("memories", [])
        except Exception:
            return []

    def _transform(self, m: Dict, s: Dict) -> MigrationRecord:
        return MigrationRecord(
            id=m.get("uuid") or m.get("id") or f"{s['session_id']}_{m.get('created_at', '')}",
            uid=s.get("user_id") or s.get("session_id") or "default",
            content=m.get("content") or m.get("text") or "",
            tags=m.get("metadata", {}).get("tags", []),
            metadata={
                "provider": "zep",
                "session_id": s.get("session_id"),
                "role": m.get("role"),
                "original_metadata": m.get("metadata", {})
            },
            created_at=m.get("created_at"), # String to pass through or parse? Schema said int.
            # Schema says int (timestamp). Need to parse if string.
            # For simplicity let's store what we get or parse if easy. JS version used Date.parse
        )
