
from typing import List, Optional, Dict, Any
import json
import logging
import asyncio
import numpy as np
from ..vector_store import VectorStore, VectorRow

# pip install redis

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
        
        # Store metadata and vector as bytes
        # Using simple blob for vector to allow numpy retrieval
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
        
        # Decode
        # Redis return bytes for keys and values usually if not decoding responses
        # Assuming decode_responses=False default, or handling bytes manually
        # Let's handle bytes safely
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
        # KV store doesn't support query by two keys efficiently without index, 
        # but ID is the primary key here basically.
        rows = await self.getVectorsById(id)
        for r in rows:
            if r.sector == sector:
                return r
        return None

    async def deleteVectors(self, id: str):
        client = await self._get_client()
        await client.delete(self._key(id))

    async def search(self, vector: List[float], sector: str, k: int, filter: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        # Without RediSearch module, we must scan.
        # This is expensive (O(N)), but valid for small scale or fallback.
        # Ideally we use FT.SEARCH if available.
        # For this port, we implement the Scan logic for maximum compatibility (parity with sqlite impl logic)
        
        client = await self._get_client()
        query_vec = np.array(vector, dtype=np.float32)
        q_norm = np.linalg.norm(query_vec)
        
        cursor = 0
        results = []
        
        # SCAN for all keys with prefix
        # optimize: maintain a set of IDs per sector?
        # For now, naive scan.
        
        while True:
            cursor, keys = await client.scan(cursor, match=f"{self.prefix}*", count=100)
            if keys:
                # pipeline fetch
                pipe = client.pipeline()
                for key in keys:
                    pipe.hgetall(key)
                items = await pipe.execute()
                
                for item in items:
                    if not item: continue
                    # decode
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
