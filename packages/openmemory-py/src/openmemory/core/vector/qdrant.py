import logging
import os
import uuid
from typing import List, Optional, Dict, Any

from ..vector_store import VectorStore, VectorRow
from ..config import env

logger = logging.getLogger("vector_store.qdrant")

KNOWN_SECTORS = [
    "episodic",
    "semantic",
    "procedural",
    "emotional",
    "reflective",
    "_mean",
]


def _point_uuid(memory_id: str, sector: str) -> str:
    return str(
        uuid.uuid5(uuid.NAMESPACE_DNS, f"openmemory/{sector}:{memory_id}")
    )


class QdrantVectorStore(VectorStore):
    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        collection_prefix: Optional[str] = None,
    ):
        self.url = (
            url
            or os.getenv("OM_QDRANT_URL")
            or os.getenv("QDRANT_URL")
            or "http://localhost:6333"
        )
        self.api_key = (
            api_key
            or os.getenv("OM_QDRANT_API_KEY")
            or os.getenv("QDRANT_API_KEY")
            or None
        )
        self.collection_prefix = (
            collection_prefix
            if collection_prefix is not None
            else os.getenv("OM_QDRANT_COLLECTION_PREFIX", "openmemory_")
        )
        self.client = None
        self._initialized: set = set()

    async def _get_client(self):
        if self.client is None:
            from qdrant_client import AsyncQdrantClient

            if self.api_key:
                self.client = AsyncQdrantClient(
                    url=self.url, api_key=self.api_key
                )
            else:
                self.client = AsyncQdrantClient(url=self.url)
        return self.client

    def _col(self, sector: str) -> str:
        return f"{self.collection_prefix}{sector}"

    async def _ensure_collection(self, sector: str):
        name = self._col(sector)
        if name in self._initialized:
            return
        client = await self._get_client()
        if not await client.collection_exists(name):
            try:
                from qdrant_client import models

                await client.create_collection(
                    collection_name=name,
                    vectors_config=models.VectorParams(
                        size=int(env.vec_dim),
                        distance=models.Distance.COSINE,
                    ),
                )
                for field in ("user_id", "sector"):
                    try:
                        await client.create_payload_index(
                            collection_name=name,
                            field_name=field,
                            field_schema="keyword",
                        )
                    except Exception as e:
                        logger.warning(
                            "Payload index %s on %s failed: %s", field, name, e
                        )
                logger.info("Created Qdrant collection %s", name)
            except Exception:
                if not await client.collection_exists(name):
                    raise
        self._initialized.add(name)

    async def storeVector(
        self,
        id: str,
        sector: str,
        vector: List[float],
        dim: int,
        user_id: Optional[str] = None,
    ):
        client = await self._get_client()
        await self._ensure_collection(sector)
        await client.upsert(
            collection_name=self._col(sector),
            points=[
                {
                    "id": _point_uuid(id, sector),
                    "vector": list(vector),
                    "payload": {
                        "user_id": user_id or "anonymous",
                        "dim": dim,
                        "sector": sector,
                        "memory_id": id,
                    },
                }
            ],
            wait=True,
        )

    async def getVectorsById(self, id: str) -> List[VectorRow]:
        out = []
        for sector in KNOWN_SECTORS:
            row = await self.getVector(id, sector)
            if row:
                out.append(row)
        return out

    async def getVector(self, id: str, sector: str) -> Optional[VectorRow]:
        client = await self._get_client()
        name = self._col(sector)
        if not await client.collection_exists(name):
            return None
        res = await client.retrieve(
            collection_name=name,
            ids=[_point_uuid(id, sector)],
            with_vectors=True,
            with_payload=True,
        )
        if not res:
            return None
        p = res[0]
        vec = p.vector
        if isinstance(vec, dict) and "default" in vec:
            vec = vec["default"]
        vec = list(vec)
        payload = p.payload or {}
        dim = payload.get("dim")
        if not dim:
            dim = len(vec)
        return VectorRow(id, sector, vec, dim)

    async def deleteVectors(self, id: str):
        client = await self._get_client()
        for sector in KNOWN_SECTORS:
            name = self._col(sector)
            if not await client.collection_exists(name):
                continue
            await client.delete(
                collection_name=name,
                points_selector=[_point_uuid(id, sector)],
                wait=True,
            )

    async def search(
        self,
        vector: List[float],
        sector: str,
        k: int,
        filter: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        client = await self._get_client()
        name = self._col(sector)
        if not await client.collection_exists(name):
            return []
        must = []
        if filter and filter.get("user_id"):
            must.append(
                {"key": "user_id", "match": {"value": filter["user_id"]}}
            )
        res = await client.query_points(
            collection_name=name,
            query=list(vector),
            limit=k,
            with_payload=True,
            query_filter={"must": must} if must else None,
        )
        out = []
        for p in res.points:
            payload = p.payload or {}
            mem_id = payload.get("memory_id") or str(p.id)
            out.append({"id": mem_id, "similarity": float(p.score)})
        return out
