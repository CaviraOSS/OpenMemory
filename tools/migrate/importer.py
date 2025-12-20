import json
import asyncio
import time
import httpx
from typing import Dict, Any, List
from .schemas import MigrationConfig, MigrationRecord, MigrationStats
from .utils import logger, RateLimiter

class Importer:
    def __init__(self, config: MigrationConfig):
        self.config = config
        self.stats = MigrationStats()
        self.base_url = config.openmemory_url
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.openmemory_key}"
        }
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self.client.aclose()

    async def run(self, input_file: str) -> MigrationStats:
        self.stats.start_time = time.time()
        logger.info(f"[IMPORT] Reading from {input_file}")

        tasks = []
        batch_size = self.config.batch_size
        semaphore = asyncio.Semaphore(10)  # Limit concurrent requests

        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if not line.strip(): continue
                    self.stats.total_records += 1
                    try:
                        record_dict = json.loads(line)
                        # Reconstruct record object not strictly needed if we just pass dict, 
                        # but helps validation. For speed we might skip full obj if simple.
                        # Let's clean it up.
                        tasks.append(self._import_record(record_dict, semaphore))
                    except Exception as e:
                        logger.error(f"Bad JSON line: {e}")
                        self.stats.failed += 1

                    if len(tasks) >= batch_size:
                        await asyncio.gather(*tasks)
                        tasks = []
                        logger.info(f"[IMPORT] Processed {self.stats.imported + self.stats.failed} records...")

            if tasks:
                await asyncio.gather(*tasks)

        except Exception as e:
            logger.error(f"[FATAL] Import failed: {e}")
            raise

        self.stats.end_time = time.time()
        return self.stats

    async def _import_record(self, data: Dict[str, Any], semaphore: asyncio.Semaphore):
        async with semaphore:
            try:
                # Transform to OpenMemory API format
                payload = {
                    "content": data.get("content", ""),
                    "tags": data.get("tags", []),
                    "user_id": data.get("uid", "default"),
                    "metadata": {
                        **(data.get("metadata") or {}),
                        "migrated": True,
                        "orig_id": data.get("id"),
                        "orig_created_at": data.get("created_at"),
                        #"orig_last_seen": data.get("last_seen"),
                    }
                }
                
                # Check user_id != 'default' logic from JS?
                # JS: if (d.uid && d.uid !== 'default') payload.user_id = d.uid;
                # Python schema has uid.
                
                url = f"{self.base_url}/memory/add"
                resp = await self.client.post(url, json=payload, headers=self.headers)
                
                if resp.status_code >= 400:
                    text = resp.text
                    logger.warning(f"Failed to import {data.get('id')}: {resp.status_code} - {text}")
                    self.stats.failed += 1
                else:
                    self.stats.imported += 1

            except Exception as e:
                logger.warning(f"Exception importing {data.get('id')}: {e}")
                self.stats.failed += 1
