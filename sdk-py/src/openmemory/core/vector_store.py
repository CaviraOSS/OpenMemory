from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, Tuple
import struct

class VectorStore(ABC):
    @abstractmethod
    async def store_vector(self, id: str, sector: str, vector: List[float], dim: int, user_id: Optional[str] = None):
        pass

    @abstractmethod
    async def delete_vector(self, id: str, sector: str):
        pass

    @abstractmethod
    async def delete_vectors(self, id: str):
        pass

    @abstractmethod
    async def search_similar(self, sector: str, query_vec: List[float], top_k: int) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_vector(self, id: str, sector: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_vectors_by_id(self, id: str) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_vectors_by_sector(self, sector: str) -> List[Dict[str, Any]]:
        pass

class SQLiteVectorStore(VectorStore):
    def __init__(self, db_ops: Dict[str, Any], table_name: str = "vectors"):
        self.db_ops = db_ops
        self.table = table_name

    def _vec_to_blob(self, vector: List[float]) -> bytes:
        return struct.pack(f'{len(vector)}f', *vector)

    def _blob_to_vec(self, blob: bytes) -> List[float]:
        dim = len(blob) // 4
        return list(struct.unpack(f'{dim}f', blob))
    
    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = sum(a * a for a in v1) ** 0.5
        norm2 = sum(a * a for a in v2) ** 0.5
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return dot / (norm1 * norm2)

    async def store_vector(self, id: str, sector: str, vector: List[float], dim: int, user_id: Optional[str] = None):
        blob = self._vec_to_blob(vector)
        # Assuming db_ops['exec'] is synchronous wrapper or async?
        # In db.py, exec_query is synchronous (it uses `with db_lock`).
        # But SDK might wrap it or caller might expect async.
        # However, the SDK seems to use synchronous sqlite3 calls in db.py?
        # Let's check db.py again. `exec_query` is def, not async def.
        # But `VectorStore` interface methods are `async def`?
        # In JS SDK everything is async.
        # In Python SDK, if `db.py` functions are sync, `VectorStore` implementation should probably be wrapper.
        # But for 'syncing' with backend/JS, maybe I should make it async compatible?
        # If I make store_vector async, I can just call the sync function.
        sql = f"insert or replace into {self.table}(id,sector,user_id,v,dim) values(?,?,?,?,?)"
        self.db_ops['exec'](sql, (id, sector, user_id, blob, dim))

    async def delete_vector(self, id: str, sector: str):
        sql = f"delete from {self.table} where id=? and sector=?"
        self.db_ops['exec'](sql, (id, sector))

    async def delete_vectors(self, id: str):
        sql = f"delete from {self.table} where id=?"
        self.db_ops['exec'](sql, (id,))

    async def search_similar(self, sector: str, query_vec: List[float], top_k: int) -> List[Dict[str, Any]]:
        # In-memory search
        sql = f"select id,v,dim from {self.table} where sector=?"
        rows = self.db_ops['many'](sql, (sector,))
        sims = []
        for row in rows:
            vec = self._blob_to_vec(row['v'])
            sim = self._cosine_similarity(query_vec, vec)
            sims.append({"id": row['id'], "score": sim})
        
        sims.sort(key=lambda x: x['score'], reverse=True)
        return sims[:top_k]

    async def get_vector(self, id: str, sector: str) -> Optional[Dict[str, Any]]:
        sql = f"select v,dim from {self.table} where id=? and sector=?"
        row = self.db_ops['one'](sql, (id, sector))
        if not row:
            return None
        return {"vector": self._blob_to_vec(row['v']), "dim": row['dim']}

    async def get_vectors_by_id(self, id: str) -> List[Dict[str, Any]]:
        sql = f"select sector,v,dim from {self.table} where id=?"
        rows = self.db_ops['many'](sql, (id,))
        return [{"sector": r['sector'], "vector": self._blob_to_vec(r['v']), "dim": r['dim']} for r in rows]

    async def get_vectors_by_sector(self, sector: str) -> List[Dict[str, Any]]:
        sql = f"select id,v,dim from {self.table} where sector=?"
        rows = self.db_ops['many'](sql, (sector,))
        return [{"id": r['id'], "vector": self._blob_to_vec(r['v']), "dim": r['dim']} for r in rows]
