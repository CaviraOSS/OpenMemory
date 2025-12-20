import httpx
from typing import Dict, Any, List
from .schemas import MigrationConfig, MigrationStats
from .utils import logger

class Verifier:
    def __init__(self, config: MigrationConfig):
        self.config = config
        self.base_url = config.openmemory_url
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.openmemory_key}"
        }

    async def verify(self, stats: MigrationStats) -> bool:
        logger.info("[VERIFY] Starting verification...")
        issues = []
        
        async with httpx.AsyncClient() as client:
            # 1. Check Count
            try:
                resp = await client.post(
                    f"{self.base_url}/memory/search",
                    json={"query": "", "limit": 10000}, # Limit might need to be higher or paginated
                    headers=self.headers
                )
                if resp.status_code != 200:
                    issues.append(f"API Error: {resp.status_code}")
                else:
                    data = resp.json()
                    memories = data.get("memories", [])
                    count = len(memories)
                    logger.info(f"[VERIFY] API reports {count} memories")
                    
                    if abs(count - stats.imported) > (stats.imported * 0.05):
                        issues.append(f"Count mismatch: Expected ~{stats.imported}, got {count}")

                    # 2. Check Duplicates (Sampling)
                    dupes = self._check_duplicates(memories)
                    if dupes > 0:
                        drift = (dupes / count) * 100
                        if drift > 1.0:
                            issues.append(f"High duplicate rate: {drift:.1f}%")

            except Exception as e:
                issues.append(f"Verification exception: {e}")

        if issues:
            logger.warning("[VERIFY] Issues found:")
            for i in issues:
                logger.warning(f" - {i}")
            return False
        
        logger.info("[VERIFY] Verification passed.")
        return True

    def _check_duplicates(self, memories: List[Dict]) -> int:
        hashes = set()
        dupes = 0
        for m in memories:
            content = m.get("content", "")
            h = hash(content)
            if h in hashes:
                dupes += 1
            else:
                hashes.add(h)
        return dupes
