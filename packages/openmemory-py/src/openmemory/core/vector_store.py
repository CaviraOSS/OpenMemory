from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, Union
import json
import sqlite3
import struct
from .db import db, DB
from .types import MemRow
import logging

# Ported from backend/src/core/vector_store.ts (implied) and db.ts logic

logger = logging.getLogger("vector_store")

class VectorRow:
    def __init__(self, id: str, sector: str, vector: List[float], dim: int):
        self.id = id
        self.sector = sector
        self.vector = vector
        self.dim = dim

class VectorStore(ABC):
    @abstractmethod
    async def storeVector(self, id: str, sector: str, vector: List[float], dim: int, user_id: Optional[str] = None): pass
    
    @abstractmethod
    async def getVectorsById(self, id: str) -> List[VectorRow]: pass
    
    @abstractmethod
    async def getVector(self, id: str, sector: str) -> Optional[VectorRow]: pass
    
    @abstractmethod
    async def deleteVectors(self, id: str): pass
    
    @abstractmethod
    async def search(self, vector: List[float], sector: str, k: int, filter: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]: pass

class SQLiteVectorStore(VectorStore):
    def __init__(self, table_name: str = "vectors"):
        self.table = table_name
        
    async def storeVector(self, id: str, sector: str, vector: List[float], dim: int, user_id: Optional[str] = None):
        # sqlite blob
        blob = struct.pack(f"{len(vector)}f", *vector)
        sql = f"INSERT OR REPLACE INTO {self.table}(id, sector, user_id, v, dim) VALUES (?, ?, ?, ?, ?)"
        db.conn.execute(sql, (id, sector, user_id, blob, dim))
        db.commit()
        
    async def getVectorsById(self, id: str) -> List[VectorRow]:
        sql = f"SELECT * FROM {self.table} WHERE id=?"
        rows = db.conn.execute(sql, (id,)).fetchall()
        res = []
        for r in rows:
            cnt = len(r["v"]) // 4
            vec = list(struct.unpack(f"{cnt}f", r["v"]))
            res.append(VectorRow(r["id"], r["sector"], vec, r["dim"]))
        return res

    async def getVector(self, id: str, sector: str) -> Optional[VectorRow]:
        sql = f"SELECT * FROM {self.table} WHERE id=? AND sector=?"
        r = db.conn.execute(sql, (id, sector)).fetchone()
        if not r: return None
        cnt = len(r["v"]) // 4
        vec = list(struct.unpack(f"{cnt}f", r["v"]))
        return VectorRow(r["id"], r["sector"], vec, r["dim"])
    
    async def deleteVectors(self, id: str):
        db.conn.execute(f"DELETE FROM {self.table} WHERE id=?", (id,))
        db.commit()
        
    async def search(self, vector: List[float], sector: str, k: int, filter: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        # Brute force cosine sim for SQLite (parity with naive local impl)
        # Optimized approaches exist (sqlite-vss) but user wants 1:1 of backend logic which might rely on PG/extension or naive loop for fallback.
        # The backend db.ts for sqlite doesn't show vector search logic inside db.ts, it uses `vector_store`. 
        # `PostgresVectorStore` uses pgvector. 
        # `SQLiteVectorStore` (implied fallback in backend) likely does naive scan or user didn't implement it fully in backend?
        # Wait, backend line 547: `new PostgresVectorStore(...)` even for SQLite?? 
        # Line 533: "SQLite fallback uses PostgresVectorStore logic but with SQLite db ops".
        # This implies the SQL is compatible. BUT standard SQLite lacks `<=>` operator for cosine sim.
        # Unless they loaded an extension.
        # Given "Python Port", I will implement a Python-side brute force or `numpy` scan for SQLite to ensure it works without extensions.
        # This is strictly better/safer than assuming extension.
        
        # 1. Fetch all vectors for sector (filtered by user if needed)
        filter_sql = ""
        params = [sector]
        if filter and filter.get("user_id"):
            filter_sql += " AND user_id=?"
            params.append(filter["user_id"])
            
        sql = f"SELECT id, v FROM {self.table} WHERE sector=? {filter_sql}"
        rows = db.conn.execute(sql, tuple(params)).fetchall()
        
        # 2. Compute similarity
        results = []
        import numpy as np
        query_vec = np.array(vector, dtype=np.float32)
        q_norm = np.linalg.norm(query_vec)
        
        for r in rows:
            cnt = len(r["v"]) // 4
            v = np.array(struct.unpack(f"{cnt}f", r["v"]), dtype=np.float32)
            dot = np.dot(query_vec, v)
            norm = np.linalg.norm(v)
            sim = dot / (q_norm * norm) if (q_norm * norm) > 0 else 0
            results.append({"id": r["id"], "similarity": float(sim)})
            
        # 3. Sort and limit
        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:k]


# Global store instance factory
import os

def get_vector_store() -> VectorStore:
    backend = os.getenv("OPENMEMORY_VECTOR_STORE", "sqlite")
    
    if backend == "postgres":
        dsn = os.getenv("OPENMEMORY_PG_DSN", "postgresql://user:pass@localhost:5432/db")
        from .vector.postgres import PostgresVectorStore
        logger.info(f"Using PostgresVectorStore at {dsn}")
        return PostgresVectorStore(dsn)
        
    elif backend == "valkey" or backend == "redis":
        url = os.getenv("OPENMEMORY_REDIS_URL", "redis://localhost:6379/0")
        from .vector.valkey import ValkeyVectorStore
        logger.info(f"Using ValkeyVectorStore at {url}")
        return ValkeyVectorStore(url)
        
    else:
        logger.info("Using SQLiteVectorStore")
        return SQLiteVectorStore()

vector_store = get_vector_store()
