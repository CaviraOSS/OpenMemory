
import asyncio
import json
import traceback
import sys
from typing import Any, Optional, Dict, List
try:
    from mcp.server import Server, NotificationOptions
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent, ImageContent, EmbeddedResource
except ImportError:
    Server = None

from ..main import Memory
from ..core.config import env
mem = Memory()

async def run_mcp_server():
    if not Server:
        print("Error: 'mcp' package not found. Install it via 'pip install mcp'", file=sys.stderr)
        sys.exit(1)

    server = Server("openmemory-mcp")

    @server.list_tools()
    async def handle_list_tools() -> list[Tool]:
        return [
            Tool(
                name="openmemory_query",
                description="Run a semantic retrieval against OpenMemory",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Free-form search text"},
                        "k": {"type": "integer", "default": 10, "description": "Max results"},
                        "user_id": {"type": "string", "description": "User context"},
                        "sector": {"type": "string", "description": "Restrict to sector (lexical, semantic, etc)"}
                    },
                    "required": ["query"]
                }
            ),
            Tool(
                name="openmemory_store",
                description="Persist new content into OpenMemory",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "Memory content"},
                        "user_id": {"type": "string"},
                        "tags": {"type": "array", "items": {"type": "string"}},
                        "metadata": {"type": "object"}
                    },
                    "required": ["content"]
                }
            ),
             Tool(
                name="openmemory_get",
                description="Fetch a single memory by ID",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"}
                    },
                    "required": ["id"]
                }
                }
            ),
             Tool(
                name="openmemory_delete",
                description="Delete a memory by ID",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "user_id": {"type": "string"}
                    },
                    "required": ["id"]
                }
            ),
             Tool(
                name="openmemory_list",
                description="List recent memories",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "default": 20},
                        "user_id": {"type": "string"}
                    }
                }
            )
        ]

    @server.call_tool()
    async def handle_call_tool(name: str, arguments: dict | None) -> list[TextContent | ImageContent | EmbeddedResource]:
        args = arguments or {}

        try:
            if name == "openmemory_query":
                q = args.get("query")
                limit = args.get("k", 10)
                uid = args.get("user_id")
                sector = args.get("sector")

                filters = {}
                if sector: filters["sector"] = sector

                results = await mem.search(q, user_id=uid, limit=limit, **filters)

                summary = f"Found {len(results)} matches for '{q}'"
                json_res = json.dumps(results, default=str, indent=2)

                return [
                    TextContent(type="text", text=summary),
                    TextContent(type="text", text=json_res)
                ]

            elif name == "openmemory_store":
                content = args.get("content")
                uid = args.get("user_id")
                tags = args.get("tags", [])
                meta = args.get("metadata", {})
                if tags: meta["tags"] = tags

                res = await mem.add(content, user_id=uid, meta=meta)
                return [
                    TextContent(type="text", text=f"Stored memory {res.get('root_memory_id') or res.get('id')}"),
                    TextContent(type="text", text=json.dumps(res, default=str, indent=2))
                ]

            elif name == "openmemory_get":
                mid = args.get("id")
                m = mem.get(mid)
                if not m:
                    return [TextContent(type="text", text=f"Memory {mid} not found")]
                return [TextContent(type="text", text=json.dumps(dict(m), default=str, indent=2))]

            elif name == "openmemory_delete":
                mid = args.get("id")
                uid = args.get("user_id")
                
                # Check exist/ownership
                m = await mem.get(mid)
                if not m:
                    return [TextContent(type="text", text=f"Memory {mid} not found")]
                
                if uid and m["user_id"] != uid:
                     return [TextContent(type="text", text=f"Memory {mid} not found for user {uid}")]

                await mem.delete(mid)
                return [TextContent(type="text", text=f"Memory {mid} deleted")]

            elif name == "openmemory_list":
                limit = args.get("limit", 20)
                uid = args.get("user_id")
                res = mem.history(user_id=uid, limit=limit)
                return [TextContent(type="text", text=json.dumps([dict(r) for r in res], default=str, indent=2))]

            else:
                raise ValueError(f"Unknown tool: {name}")

        except Exception as e:
            traceback.print_exc(file=sys.stderr)
            return [TextContent(type="text", text=f"Error: {str(e)}")]

    async with stdio_server() as (read, write):
        await server.run(read, write, NotificationOptions(), raise_exceptions=False)
