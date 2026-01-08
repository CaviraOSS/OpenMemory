
from typing import List, Optional, Dict, Any
import json
import logging
from ..types import MemRow
from ..vector_store import VectorStore, VectorRow

logger = logging.getLogger("vector_store.postgres")

class PostgresVectorStore(VectorStore):
    def __init__(self, dsn: str, table_name: str = "vectors"):
        self.dsn = dsn
        self.table = table_name
        self.pool = None

    async def _get_pool(self):
        import asyncpg
        if not self.pool:
            self.pool = await asyncpg.create_pool(self.dsn)
            async with self.pool.acquire() as conn:
                await conn.execute(f"""
                    CREATE TABLE IF NOT EXISTS {self.table} (
                        id TEXT PRIMARY KEY,
                        sector TEXT NOT NULL,
                        user_id TEXT,
                        v vector,
                        dim INTEGER,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
        return self.pool

    async def storeVector(self, id: str, sector: str, vector: List[float], dim: int, user_id: Optional[str] = None):
        pool = await self._get_pool()
        vec_str = str(vector)

        sql = f"""
            INSERT INTO {self.table} (id, sector, user_id, v, dim)
            VALUES ($1, $2, $3, $4::vector, $5)
            ON CONFLICT (id) DO UPDATE SET
                sector = EXCLUDED.sector,
                user_id = EXCLUDED.user_id,
                v = EXCLUDED.v
        """
        async with pool.acquire() as conn:
            await conn.execute(sql, id, sector, user_id, vec_str, dim)

    async def getVectorsById(self, id: str) -> List[VectorRow]:
        pool = await self._get_pool()
        sql = f"SELECT id, sector, v::text as v_txt, dim FROM {self.table} WHERE id=$1"
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, id)

        res = []
        for r in rows:
            vec = json.loads(r["v_txt"])
            res.append(VectorRow(r["id"], r["sector"], vec, r["dim"]))
        return res

    async def getVector(self, id: str, sector: str) -> Optional[VectorRow]:
        pool = await self._get_pool()
        sql = f"SELECT id, sector, v::text as v_txt, dim FROM {self.table} WHERE id=$1 AND sector=$2"
        async with pool.acquire() as conn:
            r = await conn.fetchrow(sql, id, sector)

        if not r: return None
        vec = json.loads(r["v_txt"])
        return VectorRow(r["id"], r["sector"], vec, r["dim"])

    async def deleteVectors(self, id: str):
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(f"DELETE FROM {self.table} WHERE id=$1", id)

    async def search(self, vector: List[float], sector: str, k: int, filter: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        pool = await self._get_pool()
        vec_str = str(vector)

        filter_sql = " AND sector=$2"
        args = [vec_str, sector]
        arg_idx = 3

        if filter and filter.get("user_id"):
            filter_sql += f" AND user_id=${arg_idx}"
            args.append(filter["user_id"])
            arg_idx += 1
        sql = f"""
            SELECT id, 1 - (v <=> $1::vector) as similarity
            FROM {self.table}
            WHERE 1=1 {filter_sql}
            ORDER BY v <=> $1::vector
            LIMIT {k}
        """

        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)

        return [{"id": r["id"], "similarity": float(r["similarity"])} for r in rows]
