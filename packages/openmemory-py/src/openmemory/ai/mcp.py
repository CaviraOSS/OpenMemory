
import asyncio
import os
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
from ..temporal_graph.store import insert_fact
from ..temporal_graph.query import query_facts_at_time

mem = Memory()

MCP_QUERY_TIMEOUT_S = 12.0

def _query_timeout_s() -> float:
    raw = None
    try:
        raw = os.environ.get("OM_MCP_QUERY_TIMEOUT_MS")
        if raw:
            ms = float(raw)
            if ms > 0:
                return ms / 1000.0
    except (TypeError, ValueError):
        pass
    return MCP_QUERY_TIMEOUT_S

def _has_fact_pattern(fp: dict | None) -> bool:
    if not fp:
        return False
    return bool(fp.get("subject") or fp.get("predicate") or fp.get("object"))

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
                description="Query OpenMemory for contextual memories (HSG) and/or temporal facts",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Free-form search text"},
                        "type": {"type": "string", "enum": ["contextual", "factual", "unified"], "default": "contextual", "description": "Query type: 'contextual' for HSG semantic search (default), 'factual' for temporal fact queries, 'unified' for both"},
                        "fact_pattern": {
                            "type": "object",
                            "properties": {
                                "subject": {"type": "string", "description": "Subject pattern (entity)"},
                                "predicate": {"type": "string", "description": "Predicate pattern (relationship)"},
                                "object": {"type": "string", "description": "Object pattern (value)"}
                            },
                            "description": "Fact pattern for temporal queries. Used when type is 'factual' or 'unified'"
                        },
                        "at": {"type": "string", "description": "ISO date string for point-in-time queries (default: now)"},
                        "k": {"type": "integer", "default": 10, "description": "Max results for HSG queries"},
                        "user_id": {"type": "string", "description": "Isolate results to specific user"},
                        "sector": {"type": "string", "description": "Restrict to sector (lexical, semantic, etc)"}
                    },
                    "required": ["query"]
                }
            ),
            Tool(
                name="openmemory_store",
                description="Persist new content into OpenMemory (HSG contextual memory and/or temporal facts)",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "content": {"type": "string", "description": "Raw memory text to store"},
                        "type": {"type": "string", "enum": ["contextual", "factual", "both"], "default": "contextual", "description": "Storage type: 'contextual' for HSG only (default), 'factual' for temporal facts only, 'both' for both systems"},
                        "facts": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "subject": {"type": "string", "description": "Fact subject (entity)"},
                                    "predicate": {"type": "string", "description": "Fact predicate (relationship)"},
                                    "object": {"type": "string", "description": "Fact object (value)"},
                                    "confidence": {"type": "number", "minimum": 0, "maximum": 1, "description": "Confidence score (0-1, default 1.0)"},
                                    "valid_from": {"type": "string", "description": "ISO date string for fact validity start (default: now)"}
                                },
                                "required": ["subject", "predicate", "object"]
                            },
                            "description": "Array of facts to store. Required when type is 'factual' or 'both'"
                        },
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
                qtype = args.get("type", "contextual")
                limit = args.get("k", 10)
                uid = args.get("user_id")
                sector = args.get("sector")
                fact_pattern = args.get("fact_pattern", {})
                at_str = args.get("at")
                
                import datetime
                at_date = datetime.datetime.fromisoformat(at_str) if at_str else datetime.datetime.now()
                at_ts = int(at_date.timestamp() * 1000)
                
                results = {"type": qtype, "query": q}
                warnings = []
                top_k = int(limit or 10)
                if top_k < 1:
                    top_k = 1
                if top_k > 32:
                    top_k = 32
                timeout_s = _query_timeout_s()

                # contextual (hsg) query — fail-soft so a hung embed cannot
                # kill the MCP session. Default type is contextual.
                if qtype in ["contextual", "unified"]:
                    filters = {}
                    if sector: filters["sector"] = sector
                    try:
                        contextual = await asyncio.wait_for(
                            mem.search(q, user_id=uid, limit=top_k, **filters),
                            timeout=timeout_s,
                        )
                        results["contextual"] = [{
                            "source": "hsg",
                            "id": m.get("id"),
                            "score": round(m.get("score", 0), 4),
                            "primary_sector": m.get("primary_sector"),
                            "salience": round(m.get("salience", 0), 4),
                            "content": m.get("content")
                        } for m in contextual]
                    except asyncio.TimeoutError:
                        msg = f"HSG contextual search timed out after {int(timeout_s * 1000)}ms"
                        if qtype == "contextual":
                            return [TextContent(type="text", text=f"openmemory_query failed: {msg}")]
                        warnings.append(f"contextual search failed: {msg}")
                        results["contextual"] = []
                        results["contextual_error"] = msg
                    except Exception as e:
                        msg = str(e) or "HSG contextual search failed"
                        if qtype == "contextual":
                            return [TextContent(type="text", text=f"openmemory_query failed: {msg}")]
                        warnings.append(f"contextual search failed: {msg}")
                        results["contextual"] = []
                        results["contextual_error"] = msg

                # temporal fact query
                if qtype in ["factual", "unified"]:
                    fp = fact_pattern or {}
                    patterned = _has_fact_pattern(fp)
                    fact_limit = max(top_k, 32) if patterned else top_k
                    try:
                        facts = await asyncio.wait_for(
                            query_facts_at_time(
                                subject=fp.get("subject"),
                                predicate=fp.get("predicate"),
                                subject_object=fp.get("object"),
                                at=at_ts,
                                min_confidence=0.0,
                                user_id=uid,
                                limit=fact_limit,
                            ),
                            timeout=timeout_s,
                        )
                        results["factual"] = [{
                            "source": "temporal",
                            "id": f["id"],
                            "subject": f["subject"],
                            "predicate": f["predicate"],
                            "object": f["object"],
                            "valid_from": f["valid_from"],
                            "valid_to": f.get("valid_to"),
                            "confidence": round(f["confidence"], 4),
                            "content": f"{f['subject']} {f['predicate']} {f['object']}"
                        } for f in facts]
                        if not patterned:
                            results["factual_capped"] = top_k
                            warnings.append(
                                f"factual results capped at k={top_k}; pass fact_pattern to narrow the graph scan"
                            )
                    except asyncio.TimeoutError:
                        msg = f"temporal fact query timed out after {int(timeout_s * 1000)}ms"
                        if qtype == "factual":
                            return [TextContent(type="text", text=f"openmemory_query failed: {msg}")]
                        warnings.append(f"factual search failed: {msg}")
                        results["factual"] = []
                        results["factual_error"] = msg
                    except Exception as e:
                        msg = str(e) or "temporal fact query failed"
                        if qtype == "factual":
                            return [TextContent(type="text", text=f"openmemory_query failed: {msg}")]
                        warnings.append(f"factual search failed: {msg}")
                        results["factual"] = []
                        results["factual_error"] = msg

                if warnings:
                    results["warnings"] = warnings

                # build summary
                if qtype == "contextual":
                    count = len(results.get("contextual", []))
                    summary = f"Found {count} contextual memories for '{q}'" if count > 0 else "No contextual memories matched."
                elif qtype == "factual":
                    count = len(results.get("factual", []))
                    summary = f"Found {count} temporal facts" if count > 0 else "No temporal facts matched."
                else:  # unified
                    ctx_count = len(results.get("contextual", []))
                    fact_count = len(results.get("factual", []))
                    summary = f"Found {ctx_count} contextual memories and {fact_count} temporal facts"

                if warnings:
                    summary = "\n".join(f"Warning: {w}" for w in warnings) + "\n\n" + summary

                return [
                    TextContent(type="text", text=summary),
                    TextContent(type="text", text=json.dumps(results, default=str, indent=2))
                ]

            elif name == "openmemory_store":
                content = args.get("content")
                stype = args.get("type", "contextual")
                uid = args.get("user_id")
                tags = args.get("tags", [])
                meta = args.get("metadata", {})
                facts_data = args.get("facts", [])
                
                # validate facts requirement
                if stype in ["factual", "both"] and not facts_data:
                    raise ValueError(f"Facts array is required when type is '{stype}'. Please provide at least one fact.")
                
                results = {"type": stype}
                
                # store contextual memory
                if stype in ["contextual", "both"]:
                    if tags: meta["tags"] = tags
                    res = await mem.add(content, user_id=uid, meta=meta)
                    results["hsg"] = {
                        "id": res.get('root_memory_id') or res.get('id'),
                        "primary_sector": res.get('primary_sector')
                    }
                
                # store temporal facts
                if stype in ["factual", "both"] and facts_data:
                    import datetime
                    temporal_results = []
                    for fact in facts_data:
                        valid_from_str = fact.get("valid_from")
                        valid_from_dt = datetime.datetime.fromisoformat(valid_from_str) if valid_from_str else datetime.datetime.now()
                        valid_from_ts = int(valid_from_dt.timestamp() * 1000)
                        confidence = fact.get("confidence", 1.0)
                        
                        fact_id = await insert_fact(
                            subject=fact["subject"],
                            predicate=fact["predicate"],
                            subject_object=fact["object"],
                            valid_from=valid_from_ts,
                            confidence=confidence,
                            metadata=meta,
                            user_id=uid
                        )
                        
                        temporal_results.append({
                            "id": fact_id,
                            "subject": fact["subject"],
                            "predicate": fact["predicate"],
                            "object": fact["object"],
                            "valid_from": valid_from_dt.isoformat(),
                            "confidence": confidence
                        })
                    results["temporal"] = temporal_results
                
                # build response message
                if stype == "contextual":
                    txt = f"Stored memory {results['hsg']['id']}"
                    if uid:
                        txt += f" [user={uid}]"
                elif stype == "factual":
                    txt = f"Stored {len(results['temporal'])} temporal fact(s)"
                    if uid:
                        txt += f" [user={uid}]"
                else:  # both
                    txt = f"Stored in both systems: HSG memory {results['hsg']['id']} + {len(results['temporal'])} temporal fact(s)"
                    if uid:
                        txt += f" [user={uid}]"
                
                return [
                    TextContent(type="text", text=txt),
                    TextContent(type="text", text=json.dumps(results, default=str, indent=2))
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
