from typing import Dict, Any, AsyncGenerator, List
from .base import BaseProvider
from ..schemas import MigrationRecord
from ..utils import logger

class Mem0Provider(BaseProvider):
    def __init__(self, config):
        super().__init__(config)
        self.base_url = config.source_url or "https://api.mem0.ai"
        self.headers = {
            "Authorization": f"Token {config.api_key}",
            "Content-Type": "application/json"
        }

    async def connect(self) -> Dict[str, Any]:
        try:
            users = await self._fetch_all_users(limit_check=True)
            return {"ok": True, "users": len(users)}
        except Exception as e:
            raise Exception(f"Mem0 connection failed: {e}")

    async def export(self) -> AsyncGenerator[MigrationRecord, None]:
        try:
            users = await self._fetch_all_users()
            logger.info(f"[MEM0] Found {len(users)} users")
            
            for i, user in enumerate(users):
                if i % 10 == 0:
                    logger.info(f"[MEM0] Processing user {i}/{len(users)}")
                
                user_id = user.get("user_id")
                if not user_id: continue

                memories = await self._fetch_user_memories(user_id)
                for mem in memories:
                    yield self._transform(mem, user_id)
        except Exception as e:
            logger.error(f"[MEM0] Export failed: {e}")
            raise

    async def _fetch_all_users(self, limit_check: bool = False) -> List[Dict]:
        users = []
        page = 1
        limit = 100
        while True:
            url = f"{self.base_url}/v1/entities/users?page={page}&limit={limit}"
            try:
                data = await self._get(url, headers=self.headers)
                batch = data.get("users", []) or data.get("results", [])
                if not batch:
                    break
                users.extend(batch)
                if limit_check: 
                    return users
                page += 1
                if len(batch) < limit:
                    break
            except Exception as e:
                logger.warning(f"[MEM0] Failed to fetch users page {page}: {e}")
                break
        return users if users else [{"user_id": "default"}]

    async def _fetch_user_memories(self, user_id: str) -> List[Dict]:
        memories = []
        page = 1
        limit = 100
        while True:
            url = f"{self.base_url}/v1/memories?user_id={user_id}&page={page}&limit={limit}"
            try:
                data = await self._get(url, headers=self.headers)
                batch = data.get("memories", []) or data.get("results", [])
                if not batch:
                    break
                memories.extend(batch)
                page += 1
                if len(batch) < limit:
                    break
            except Exception as e:
                logger.warning(f"[MEM0] Failed fetch memories for {user_id}: {e}")
                break
        return memories

    def _transform(self, m: Dict, uid: str) -> MigrationRecord:
        from dateutil import parser
        
        created_at = 0
        if m.get("created_at"):
            try:
                created_at = int(parser.parse(m["created_at"]).timestamp() * 1000)
            except: pass

        return MigrationRecord(
            id=str(m.get("id") or m.get("memory_id") or f"mem0_{created_at}"),
            uid=str(m.get("user_id") or uid or "default"),
            content=m.get("text") or m.get("content") or (m.get("data") or {}).get("text") or "",
            tags=m.get("tags") or m.get("categories") or [],
            metadata={
                "provider": "mem0",
                "category": m.get("category"),
                "original_metadata": m.get("metadata", {})
            },
            created_at=created_at
        )
