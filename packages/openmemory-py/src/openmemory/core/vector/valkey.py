
from typing import List, Optional, Dict, Any
import json
import logging
import asyncio
import numpy as np
from ..vector_store import VectorStore, VectorRow

logger = logging.getLogger("vector_store.valkey")

class ValkeyVectorStore(VectorStore):
    def __init__(self, url: str, prefix: str = "om:vec:"):
        self.url = url
        self.prefix = prefix
        self.client = None

    async def _get_client(self):
        import redis.asyncio as redis
        if not self.client:
            self.client = redis.from_url(self.url)
        return self.client

    def _key(self, id: str) -> str:
        return f"{self.prefix}{id}"

    async def storeVector(self, id: str, sector: str, vector: List[float], dim: int, user_id: Optional[str] = None):
        client = await self._get_client()
        key = self._key(id)
        vec_bytes = np.array(vector, dtype=np.float32).tobytes()

        mapping = {
            "id": id,
            "sector": sector,
            "dim": dim,
            "v": vec_bytes,
            "user_id": user_id or ""
        }
        await client.hset(key, mapping=mapping)

    async def getVectorsById(self, id: str) -> List[VectorRow]:
        client = await self._get_client()
        key = self._key(id)
        data = await client.hgetall(key)
        if not data: return []
        def dec(x): return x.decode('utf-8') if isinstance(x, bytes) else str(x)

        vec_bytes = data.get(b'v') or data.get('v')
        vec = list(np.frombuffer(vec_bytes, dtype=np.float32))

        return [VectorRow(
            dec(data.get(b'id') or data.get('id')),
            dec(data.get(b'sector') or data.get('sector')),
            vec,
            int(dec(data.get(b'dim') or data.get('dim')))
        )]

    async def getVector(self, id: str, sector: str) -> Optional[VectorRow]:
        rows = await self.getVectorsById(id)
        for r in rows:
            if r.sector == sector:
                return r
        return None

    async def deleteVectors(self, id: str):
        client = await self._get_client()
        await client.delete(self._key(id))

    async def search(self, vector: List[float], sector: str, k: int, filter: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:

        client = await self._get_client()
        query_vec = np.array(vector, dtype=np.float32)
        q_norm = np.linalg.norm(query_vec)

        cursor = 0
        results = []

        while True:
            cursor, keys = await client.scan(cursor, match=f"{self.prefix}*", count=100)
            if keys:
                pipe = client.pipeline()
                for key in keys:
                    pipe.hgetall(key)
                items = await pipe.execute()

                for item in items:
                    if not item: continue
                    def dec(x): return x.decode('utf-8') if isinstance(x, bytes) else str(x)

                    i_sector = dec(item.get(b'sector') or item.get('sector'))
                    if i_sector != sector: continue

                    if filter and filter.get("user_id"):
                        i_uid = dec(item.get(b'user_id') or item.get('user_id'))
                        if i_uid != filter["user_id"]: continue

                    v_bytes = item.get(b'v') or item.get('v')
                    v = np.frombuffer(v_bytes, dtype=np.float32)

                    dot = np.dot(query_vec, v)
                    norm = np.linalg.norm(v)
                    sim = dot / (q_norm * norm) if (q_norm * norm) > 0 else 0

                    results.append({
                        "id": dec(item.get(b'id') or item.get('id')),
                        "similarity": float(sim)
                    })

            if cursor == 0: break

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:k]
