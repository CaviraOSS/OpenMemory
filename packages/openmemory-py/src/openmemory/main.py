import logging
from typing import List, Dict, Optional, Any
from .core.db import db, q
from .memory.hsg import hsg_query, add_hsg_memory
from .ops.ingest import ingest_document
from .openai_handler import OpenAIRegistrar

logger = logging.getLogger("openmemory")

class Memory:
    def __init__(self, user: str = None):
        self.default_user = user
        db.connect()
        self._openai = OpenAIRegistrar(self)

    @property
    def openai(self):
        return self._openai

    async def add(self, content: str, user_id: str = None, **kwargs) -> Dict[str, Any]:
        uid = user_id or self.default_user
        res = await ingest_document("text", content, meta=kwargs.get("meta"), user_id=uid, tags=kwargs.get("tags"))
        if "root_memory_id" in res:
            res["id"] = res["root_memory_id"]
        return res

    async def search(self, query: str, user_id: str = None, limit: int = 10, **kwargs) -> List[Dict[str, Any]]:
        uid = user_id or self.default_user
        filters = kwargs.copy()
        filters["user_id"] = uid
        return await hsg_query(query, limit, filters)

    async def get(self, memory_id: str):
        return q.get_mem(memory_id)

    async def delete(self, memory_id: str):
        q.del_mem(memory_id)

    async def delete_all(self, user_id: str = None):
        uid = user_id or self.default_user
        if uid:
            q.del_mem_by_user(uid)

    def history(self, user_id: str = None, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        uid = user_id or self.default_user
        rows = q.all_mem_by_user(uid, limit, offset)
        return [dict(r) for r in rows]

    def source(self, name: str):
        """
        get a pre-configured source connector.

        usage:
            github = mem.source("github")
            await github.connect(token="ghp_...")
            await github.ingest_all(repo="owner/repo")

        available sources: github, notion, google_drive, google_sheets,
                          google_slides, onedrive, web_crawler
        """
        from . import connectors

        sources = {
            "github": connectors.github_connector,
            "notion": connectors.notion_connector,
            "google_drive": connectors.google_drive_connector,
            "google_sheets": connectors.google_sheets_connector,
            "google_slides": connectors.google_slides_connector,
            "onedrive": connectors.onedrive_connector,
            "web_crawler": connectors.web_crawler_connector,
        }

        if name not in sources:
            raise ValueError(f"unknown source: {name}. available: {list(sources.keys())}")

        return sources[name](user_id=self.default_user)

def run_mcp():
    import asyncio
    from .ai.mcp import run_mcp_server
    try:
        asyncio.run(run_mcp_server())
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        print("Server mode removed. Use 'mcp' for agentic usage.")
    elif len(sys.argv) > 1 and sys.argv[1] == "mcp":
        run_mcp()
    else:
        print("OpenMemory Python SDK")
        print("Usage: python -m openmemory.main mcp")
