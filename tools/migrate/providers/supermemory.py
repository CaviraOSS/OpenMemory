import asyncio
from typing import Dict, Any, AsyncGenerator
from .base import BaseProvider
from ..schemas import MigrationRecord
from ..utils import logger


class SupermemoryProvider(BaseProvider):
    def __init__(self, config):
        super().__init__(config)
        self.base_url = config.source_url or "https://api.supermemory.ai"
        self.headers = {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        }

    async def connect(self) -> Dict[str, Any]:
        try:
            data = await self._post(
                f"{self.base_url}/v3/documents/list",
                json={"page": 1, "limit": 1, "includeContent": False},
                headers=self.headers,
            )
            pagination = data.get("pagination") or {}
            total = (
                pagination.get("totalItems")
                or pagination.get("totalDocuments")
                or data.get("total")
                or 0
            )
            return {"ok": True, "documents": total}
        except Exception as e:
            raise Exception(f"Supermemory connection failed (v3): {e}")

    async def _post(
        self,
        url: str,
        json: Dict[str, Any],
        headers: Dict[str, str],
        max_retries: int = 8,
    ) -> Any:
        for attempt in range(max_retries + 1):
            await self.rate_limiter.wait()
            response = await self.client.post(url, json=json, headers=headers)

            if response.status_code != 429:
                response.raise_for_status()
                return response.json()

            if attempt >= max_retries:
                response.raise_for_status()

            retry_after_header = response.headers.get("retry-after", "5")
            try:
                retry_after = float(retry_after_header)
            except (TypeError, ValueError):
                retry_after = 5.0

            wait_seconds = max(1.0, min(retry_after, 60.0))
            logger.warning(
                f"[SUPERMEMORY] Rate limit hit. Waiting {wait_seconds:.1f}s (attempt {attempt + 1}/{max_retries})..."
            )
            await asyncio.sleep(wait_seconds)

        raise RuntimeError("Max retries exceeded while calling Supermemory API")

    async def export(self) -> AsyncGenerator[MigrationRecord, None]:
        try:
            logger.info("[SUPERMEMORY] Fetching documents...")
            page = 1
            limit = 100
            total = 0

            while True:
                data = await self._post(
                    f"{self.base_url}/v3/documents/list",
                    json={"page": page, "limit": limit, "includeContent": True},
                    headers=self.headers,
                )
                batch = (
                    data.get("memories", [])
                    or data.get("documents", [])
                    or data.get("data", [])
                )

                if not batch:
                    if page == 1:
                        keys = (
                            sorted(list(data.keys())) if isinstance(data, dict) else []
                        )
                        logger.warning(
                            f"[SUPERMEMORY] No documents found in first page. Response keys: {keys}"
                        )
                    break

                for doc in batch:
                    yield self._transform(doc)
                    total += 1
                    if total % 100 == 0:
                        logger.info(f"[SUPERMEMORY] Exported {total} documents...")

                pagination = data.get("pagination") or {}
                current_page = pagination.get("currentPage", page)
                total_pages = pagination.get("totalPages")
                has_next = pagination.get("hasNext")

                if total_pages is not None and current_page >= total_pages:
                    break
                if has_next is False:
                    break
                if total_pages is None and has_next is None and len(batch) < limit:
                    break

                page += 1
        except Exception as e:
            logger.error(f"[SUPERMEMORY] Export failed: {e}")
            raise

    def _transform(self, d: Dict) -> MigrationRecord:
        from dateutil import parser

        created_at = 0
        created_at_raw = d.get("created_at") or d.get("createdAt")
        if created_at_raw:
            if isinstance(created_at_raw, (int, float)):
                created_at = int(
                    created_at_raw if created_at_raw > 1e12 else created_at_raw * 1000
                )
            else:
                try:
                    created_at = int(parser.parse(created_at_raw).timestamp() * 1000)
                except:
                    pass

        container_tags = d.get("containerTags") or []
        uid = (
            d.get("user_id")
            or d.get("owner_id")
            or d.get("containerTag")
            or (container_tags[0] if container_tags else None)
            or "default"
        )

        content = (
            d.get("content") or d.get("text") or d.get("body") or d.get("summary") or ""
        )

        return MigrationRecord(
            id=str(
                d.get("id")
                or d.get("document_id")
                or d.get("customId")
                or f"sm_{created_at}"
            ),
            uid=str(uid),
            content=content,
            tags=d.get("tags") or d.get("labels") or [],
            metadata={
                "provider": "supermemory",
                "source": d.get("source"),
                "url": d.get("url"),
                "container_tags": container_tags,
                "original_metadata": d.get("metadata", {}),
            },
            created_at=created_at,
        )
