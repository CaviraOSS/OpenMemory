"""
notion connector for openmemory
requires: notion-client
env vars: NOTION_API_KEY
"""
from typing import List, Dict, Optional
import os
from .base import base_connector

class notion_connector(base_connector):
    """connector for notion pages and databases"""

    name = "notion"

    def __init__(self, user_id: str = None):
        super().__init__(user_id)
        self.client = None

    async def connect(self, **creds) -> bool:
        """
        authenticate with notion api

        env vars:
            NOTION_API_KEY: notion integration token

        or pass:
            api_key: notion integration token
        """
        try:
            from notion_client import Client
        except ImportError:
            raise ImportError("pip install notion-client")

        api_key = creds.get("api_key") or os.environ.get("NOTION_API_KEY")

        if not api_key:
            raise ValueError("no notion api key provided")

        self.client = Client(auth=api_key)
        self._connected = True
        return True

    async def list_items(self, database_id: str = None, **filters) -> List[Dict]:
        """
        list pages from notion

        args:
            database_id: optional database to query

        if no database_id, searches all accessible pages
        """
        if not self._connected:
            await self.connect()

        results = []

        if database_id:
            has_more = True
            start_cursor = None

            while has_more:
                resp = self.client.databases.query(
                    database_id=database_id,
                    start_cursor=start_cursor
                )

                for page in resp.get("results", []):
                    title = ""
                    props = page.get("properties", {})
                    for prop in props.values():
                        if prop.get("type") == "title":
                            titles = prop.get("title", [])
                            if titles:
                                title = titles[0].get("plain_text", "")
                            break

                    results.append({
                        "id": page["id"],
                        "name": title or "Untitled",
                        "type": "page",
                        "url": page.get("url", ""),
                        "last_edited": page.get("last_edited_time")
                    })

                has_more = resp.get("has_more", False)
                start_cursor = resp.get("next_cursor")
        else:
            resp = self.client.search(filter={"property": "object", "value": "page"})

            for page in resp.get("results", []):
                title = ""
                props = page.get("properties", {})

                for prop in props.values():
                    if prop.get("type") == "title":
                        titles = prop.get("title", [])
                        if titles:
                            title = titles[0].get("plain_text", "")
                        break

                results.append({
                    "id": page["id"],
                    "name": title or "Untitled",
                    "type": "page",
                    "url": page.get("url", ""),
                    "last_edited": page.get("last_edited_time")
                })

        return results

    async def fetch_item(self, item_id: str) -> Dict:
        """fetch page content as text"""
        if not self._connected:
            await self.connect()
        page = self.client.pages.retrieve(page_id=item_id)
        title = ""
        props = page.get("properties", {})
        for prop in props.values():
            if prop.get("type") == "title":
                titles = prop.get("title", [])
                if titles:
                    title = titles[0].get("plain_text", "")
                break
        blocks = []
        has_more = True
        start_cursor = None

        while has_more:
            resp = self.client.blocks.children.list(
                block_id=item_id,
                start_cursor=start_cursor
            )
            blocks.extend(resp.get("results", []))
            has_more = resp.get("has_more", False)
            start_cursor = resp.get("next_cursor")
        def block_to_text(block):
            texts = []
            block_type = block.get("type", "")

            if block_type in ["paragraph", "heading_1", "heading_2", "heading_3",
                              "bulleted_list_item", "numbered_list_item", "quote", "callout"]:
                rich_text = block.get(block_type, {}).get("rich_text", [])
                for rt in rich_text:
                    texts.append(rt.get("plain_text", ""))

            elif block_type == "code":
                rich_text = block.get("code", {}).get("rich_text", [])
                for rt in rich_text:
                    texts.append(rt.get("plain_text", ""))

            elif block_type == "to_do":
                checked = block.get("to_do", {}).get("checked", False)
                rich_text = block.get("to_do", {}).get("rich_text", [])
                prefix = "[x] " if checked else "[ ] "
                for rt in rich_text:
                    texts.append(prefix + rt.get("plain_text", ""))

            elif block_type == "toggle":
                rich_text = block.get("toggle", {}).get("rich_text", [])
                for rt in rich_text:
                    texts.append(rt.get("plain_text", ""))

            return "".join(texts)

        text_parts = [f"# {title}"] if title else []

        for block in blocks:
            txt = block_to_text(block)
            if txt.strip():
                text_parts.append(txt)

        text = "\n\n".join(text_parts)

        return {
            "id": item_id,
            "name": title or "Untitled",
            "type": "notion_page",
            "text": text,
            "data": text,
            "meta": {
                "source": "notion",
                "page_id": item_id,
                "url": page.get("url", ""),
                "block_count": len(blocks)
            }
        }
