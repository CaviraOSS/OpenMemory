from __future__ import annotations

import os
import asyncio
import logging
import re
import io
import time
import warnings
from pathlib import Path
from contextlib import asynccontextmanager, redirect_stderr, redirect_stdout
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field


logger = logging.getLogger(__name__)
_HF_HTTP_LOGGER_NAME = "huggingface_hub.utils._http"
_HF_UNAUTH_WARNING_SNIPPET = "unauthenticated requests to the HF Hub"


class UpsertDocumentRequest(BaseModel):
    document_id: str = Field(min_length=1)
    content: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)
    user_id: str | None = None
    project_id: str | None = None
    finalize: bool = False


class QueryRequest(BaseModel):
    query: str = Field(min_length=1)
    k: int = Field(default=8, ge=1, le=32)
    user_id: str | None = None
    project_id: str | None = None
    return_context: bool = True


class DeleteDocumentRequest(BaseModel):
    document_id: str = Field(min_length=1)
    finalize: bool = False


class BackfillScopeRequest(BaseModel):
    document_ids: list[str] = Field(default_factory=list)
    dry_run: bool = False
    limit: int = Field(default=1000, ge=1, le=10000)


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


async def _tcp_reachable(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False


def _missing_model_env() -> list[str]:
    required = ["OM_GRAPHRAG_LLM_MODEL", "OM_GRAPHRAG_EMBEDDER_MODEL"]
    return [name for name in required if not os.getenv(name)]


def _missing_bridge_auth_env() -> list[str]:
    return [] if os.getenv("OM_GRAPHRAG_BRIDGE_API_KEY") else ["OM_GRAPHRAG_BRIDGE_API_KEY"]


def _require_model_env() -> None:
    missing = _missing_model_env()
    if missing:
        raise RuntimeError(
            "Missing GraphRAG model configuration: " + ", ".join(missing)
        )


def _require_bridge_auth(request: Request) -> None:
    expected = os.getenv("OM_GRAPHRAG_BRIDGE_API_KEY")
    if not expected:
        raise HTTPException(status_code=503, detail="OM_GRAPHRAG_BRIDGE_API_KEY is required")
    provided = request.headers.get("x-graph-api-key")
    if provided != expected:
        raise HTTPException(status_code=401, detail="invalid GraphRAG bridge API key")


def _model_dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    if isinstance(value, list):
        return [_model_dump(item) for item in value]
    if isinstance(value, dict):
        return {key: _model_dump(item) for key, item in value.items()}
    return value


def _debug_timing_enabled(request: Request) -> bool:
    header = request.headers.get("x-graph-debug-timings", "")
    if header.lower() in {"1", "true", "yes", "on"}:
        return True
    return _debug_timing_env_enabled()


def _debug_timing_env_enabled() -> bool:
    return os.getenv("OM_GRAPHRAG_DEBUG_TIMINGS", "false").lower() == "true"


def _emit_debug_timing(event: str, **fields: Any) -> None:
    payload = " ".join(f"{key}={value}" for key, value in fields.items())
    logger.warning("[graphrag-debug] %s %s", event, payload)


def _with_provenance(req: UpsertDocumentRequest) -> str:
    lines = [
        f"OpenMemory document id: {req.document_id}",
        f"OpenMemory user id: {req.user_id or 'unknown'}",
        f"OpenMemory project id: {req.project_id or 'system_global'}",
    ]
    source = req.metadata.get("source")
    if source:
        lines.append(f"OpenMemory source: {source}")
    return "\n".join(lines) + "\n\n" + req.content


def _load_graphrag():
    try:
        from graphrag_sdk import ConnectionConfig, GraphRAG, LiteLLM, LiteLLMEmbedder
        from graphrag_sdk.api import main as sdk_main
        from graphrag_sdk.core.connection import FalkorDBConnection
        from graphrag_sdk.core.models import ChatMessage, RagResult, RetrieverResult, RetrieverResultItem
    except Exception as exc:  # pragma: no cover - depends on optional install
        raise RuntimeError(
            "graphrag-sdk is not installed. Install tools/openmemory-graphrag-bridge/requirements.txt."
        ) from exc

    return (
        ConnectionConfig,
        FalkorDBConnection,
        GraphRAG,
        LiteLLM,
        LiteLLMEmbedder,
        sdk_main,
        ChatMessage,
        RagResult,
        RetrieverResult,
        RetrieverResultItem,
    )


def _retrieval_strategy_for_k(rag: Any, k: int) -> Any:
    from graphrag_sdk.retrieval import MultiPathRetrieval

    graph_store = getattr(rag, "_graph_store", None)
    vector_store = getattr(rag, "_vector_store", None)
    if graph_store is None or vector_store is None:
        raise RuntimeError("GraphRAG SDK internals needed for k-limited retrieval are unavailable")

    req_k = k
    return MultiPathRetrieval(
        graph_store=graph_store,
        vector_store=vector_store,
        embedder=rag.embedder,
        llm=rag.llm,
        chunk_top_k=req_k,
        rel_top_k=req_k,
        max_entities=max(req_k * 2, 8),
        max_relationships=max(req_k * 2, 8),
        keyword_limit=min(req_k, 10),
    )


def _extract_provenance_value(block: str, label: str) -> str | None:
    pattern = rf"^{re.escape(label)}\s*(.+)$"
    match = re.search(pattern, block, flags=re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip()


def _extract_source_doc_id(block: str) -> str | None:
    match = re.match(r"^\[Source:\s*([^\]]+)\]", block)
    if not match:
        return None
    return match.group(1).strip()


def _scope_matches_block(block: str, user_id: str | None, project_id: str | None) -> bool:
    if user_id:
        if _extract_provenance_value(block, "OpenMemory user id:") != user_id:
            return False
    if project_id:
        if _extract_provenance_value(block, "OpenMemory project id:") != project_id:
            return False
    return True


def _split_passage_blocks(content: str) -> tuple[str, list[str]]:
    text = content.strip()
    if not text:
        return "", []

    heading = ""
    body = text
    if text.startswith("## "):
        first_nl = text.find("\n")
        if first_nl != -1:
            heading = text[:first_nl]
            body = text[first_nl + 1 :].lstrip()

    blocks = [
        block.strip()
        for block in re.split(r"\n---\n(?=\[Source: )", body)
        if block.strip()
    ]
    return heading, blocks


async def _lookup_document_scope_map(rag: Any, doc_ids: list[str]) -> dict[str, dict[str, str | None]]:
    graph_store = getattr(rag, "_graph_store", None)
    if graph_store is None or not doc_ids:
        return {}

    result = await graph_store.query_raw(
        "UNWIND $ids AS id "
        "MATCH (d:Document {id: id}) "
        "RETURN d.id AS id, d.openmemory_user_id AS user_id, d.openmemory_project_id AS project_id",
        {"ids": doc_ids},
    )
    scope_map: dict[str, dict[str, str | None]] = {}
    for row in result.result_set:
        scope_map[row[0]] = {
            "user_id": row[1] if len(row) > 1 else None,
            "project_id": row[2] if len(row) > 2 else None,
        }
    return scope_map


def _scope_matches_graph_metadata(
    doc_scope: dict[str, str | None] | None,
    *,
    user_id: str | None,
    project_id: str | None,
) -> bool:
    if not doc_scope:
        return False
    if user_id and doc_scope.get("user_id") != user_id:
        return False
    if project_id and doc_scope.get("project_id") != project_id:
        return False
    return True


async def _scoped_chunk_pushdown_retriever(
    rag: Any,
    req: QueryRequest,
    *,
    RetrieverResult: Any,
    RetrieverResultItem: Any,
) -> Any | None:
    from graphrag_sdk.storage.vector_store import _escape_fulltext_query

    graph_store = getattr(rag, "_graph_store", None)
    embedder = getattr(rag, "embedder", None)
    if graph_store is None or embedder is None:
        return None

    query_vector = await embedder.aembed_query(req.query)
    top_k = max(req.k * 4, 8)
    chunks: dict[str, dict[str, Any]] = {}

    def _add(row: list[Any], source: str) -> None:
        if not row:
            return
        chunk_id = row[0]
        text = row[1] if len(row) > 1 else ""
        document_id = row[2] if len(row) > 2 else None
        score = row[3] if len(row) > 3 else None
        if not chunk_id or not text or chunk_id in chunks:
            return
        chunks[chunk_id] = {
            "text": text,
            "document_id": document_id,
            "source": source,
            "score": score,
        }

    fulltext_result = await graph_store.query_raw(
        "CALL db.idx.fulltext.queryNodes('Chunk', $query_text) "
        "YIELD node, score "
        "MATCH (d:Document)-[:PART_OF]->(node) "
        "WHERE ($user_id IS NULL OR d.openmemory_user_id = $user_id) "
        "  AND ($project_id IS NULL OR d.openmemory_project_id = $project_id) "
        "RETURN node.id AS id, node.text AS text, d.id AS document_id, score "
        "ORDER BY score DESC LIMIT $top_k",
        {
            "query_text": _escape_fulltext_query(req.query),
            "top_k": top_k,
            "user_id": req.user_id,
            "project_id": req.project_id,
        },
    )
    for row in fulltext_result.result_set:
        _add(row, "fulltext_scoped")

    vector_result = await graph_store.query_raw(
        "CALL db.idx.vector.queryNodes('Chunk', 'embedding', $top_k, vecf32($vector)) "
        "YIELD node, score "
        "MATCH (d:Document)-[:PART_OF]->(node) "
        "WHERE ($user_id IS NULL OR d.openmemory_user_id = $user_id) "
        "  AND ($project_id IS NULL OR d.openmemory_project_id = $project_id) "
        "RETURN node.id AS id, node.text AS text, d.id AS document_id, score "
        "ORDER BY score DESC LIMIT $top_k",
        {
            "top_k": top_k,
            "vector": query_vector,
            "user_id": req.user_id,
            "project_id": req.project_id,
        },
    )
    for row in vector_result.result_set:
        _add(row, "vector_scoped")

    if not chunks:
        return None

    passages = []
    for entry in chunks.values():
        source = entry["document_id"] or "unknown"
        passages.append(f"[Source: {source}]\n{entry['text']}")

    return RetrieverResult(
        items=[
            RetrieverResultItem(
                content="## Source Document Passages\n" + "\n---\n".join(passages),
                metadata={
                    "section": "passages",
                    "scope_filtered": True,
                    "scope_filter_mode": "graph_native_chunk_pushdown",
                },
            )
        ],
        metadata={
            "strategy": "graph_native_chunk_pushdown",
            "scope_filtered": True,
            "scope_user_id": req.user_id,
            "scope_project_id": req.project_id,
            "scope_candidate_chunk_count": len(chunks),
            "scope_candidate_paths": ["fulltext_scoped", "vector_scoped"],
        },
    )


def _merge_scoped_retriever_results(
    primary: Any | None,
    secondary: Any | None,
    *,
    RetrieverResult: Any,
    RetrieverResultItem: Any,
) -> Any:
    if primary is None and secondary is None:
        return RetrieverResult(items=[], metadata={})

    seen_blocks: set[str] = set()
    merged_blocks: list[str] = []
    blocks_graph_matched = 0
    blocks_legacy_matched = 0
    candidate_chunk_count = getattr(primary, "metadata", {}).get(
        "scope_candidate_chunk_count", 0
    )

    for item in getattr(primary, "items", []) if primary is not None else []:
        if item.metadata.get("section") != "passages":
            continue
        _heading, blocks = _split_passage_blocks(item.content)
        for block in blocks:
            if block in seen_blocks:
                continue
            seen_blocks.add(block)
            merged_blocks.append(block)
            blocks_graph_matched += 1

    for item in getattr(secondary, "items", []) if secondary is not None else []:
        if item.metadata.get("section") != "passages":
            continue
        _heading, blocks = _split_passage_blocks(item.content)
        for block in blocks:
            if block in seen_blocks:
                continue
            seen_blocks.add(block)
            merged_blocks.append(block)
            blocks_legacy_matched += 1

    mode = "none"
    if blocks_graph_matched > 0:
        mode = "graph_native_chunk_pushdown"
    if blocks_legacy_matched > 0:
        mode = (
            "graph_native_pushdown_with_legacy_backfill"
            if mode == "graph_native_chunk_pushdown"
            else "legacy_filtered_retriever"
        )

    if not merged_blocks:
        return RetrieverResult(
            items=[],
            metadata={
                "scope_retrieval_mode": mode,
                "scope_blocks_graph_matched": blocks_graph_matched,
                "scope_blocks_legacy_matched": blocks_legacy_matched,
                "scope_candidate_chunk_count": candidate_chunk_count,
            },
        )

    return RetrieverResult(
        items=[
            RetrieverResultItem(
                content="## Source Document Passages\n" + "\n---\n".join(merged_blocks),
                metadata={
                    "section": "passages",
                    "scope_filtered": True,
                    "scope_filter_mode": mode,
                },
            )
        ],
        metadata={
            "scope_retrieval_mode": mode,
            "scope_blocks_graph_matched": blocks_graph_matched,
            "scope_blocks_legacy_matched": blocks_legacy_matched,
            "scope_candidate_chunk_count": candidate_chunk_count,
        },
    )


def _finalize_graph_native_retriever_result(
    primary: Any | None,
    *,
    RetrieverResult: Any,
    RetrieverResultItem: Any,
) -> Any:
    candidate_chunk_count = getattr(primary, "metadata", {}).get(
        "scope_candidate_chunk_count", 0
    )
    if primary is None:
        return RetrieverResult(
            items=[],
            metadata={
                "scope_retrieval_mode": "none",
                "scope_blocks_graph_matched": 0,
                "scope_blocks_legacy_matched": 0,
                "scope_candidate_chunk_count": candidate_chunk_count,
            },
        )

    merged_blocks: list[str] = []
    for item in getattr(primary, "items", []):
        if item.metadata.get("section") != "passages":
            continue
        _heading, blocks = _split_passage_blocks(item.content)
        merged_blocks.extend(blocks)

    blocks_graph_matched = len(merged_blocks)
    if not merged_blocks:
        return RetrieverResult(
            items=[],
            metadata={
                **getattr(primary, "metadata", {}),
                "scope_retrieval_mode": "none",
                "scope_blocks_graph_matched": 0,
                "scope_blocks_legacy_matched": 0,
                "scope_candidate_chunk_count": candidate_chunk_count,
            },
        )

    return RetrieverResult(
        items=[
            RetrieverResultItem(
                content="## Source Document Passages\n" + "\n---\n".join(merged_blocks),
                metadata={
                    "section": "passages",
                    "scope_filtered": True,
                    "scope_filter_mode": "graph_native_chunk_pushdown",
                },
            )
        ],
        metadata={
            **getattr(primary, "metadata", {}),
            "scope_retrieval_mode": "graph_native_chunk_pushdown",
            "scope_blocks_graph_matched": blocks_graph_matched,
            "scope_blocks_legacy_matched": 0,
            "scope_candidate_chunk_count": candidate_chunk_count,
        },
    )


async def _filter_retriever_result_by_scope(
    rag: Any,
    retriever_result: Any,
    *,
    user_id: str | None,
    project_id: str | None,
    RetrieverResult: Any,
    RetrieverResultItem: Any,
) -> Any:
    filtered_items: list[Any] = []
    blocks_seen = 0
    blocks_kept = 0
    blocks_graph_matched = 0
    blocks_legacy_matched = 0

    doc_ids: list[str] = []
    for item in retriever_result.items:
        if item.metadata.get("section") != "passages":
            continue
        _heading, blocks = _split_passage_blocks(item.content)
        for block in blocks:
            doc_id = _extract_source_doc_id(block)
            if doc_id:
                doc_ids.append(doc_id)
    doc_scope_map = await _lookup_document_scope_map(rag, sorted(set(doc_ids)))

    for item in retriever_result.items:
        section = item.metadata.get("section")
        if section != "passages":
            continue

        heading, blocks = _split_passage_blocks(item.content)
        kept_blocks: list[str] = []
        for block in blocks:
            blocks_seen += 1
            doc_id = _extract_source_doc_id(block)
            graph_match = _scope_matches_graph_metadata(
                doc_scope_map.get(doc_id) if doc_id else None,
                user_id=user_id,
                project_id=project_id,
            )
            legacy_match = False
            if not graph_match:
                legacy_match = _scope_matches_block(block, user_id, project_id)

            if graph_match or legacy_match:
                blocks_kept += 1
                if graph_match:
                    blocks_graph_matched += 1
                else:
                    blocks_legacy_matched += 1
                kept_blocks.append(block)

        if not kept_blocks:
            continue

        merged = "\n---\n".join(kept_blocks)
        if heading:
            merged = f"{heading}\n{merged}"

        filtered_items.append(
            RetrieverResultItem(
                content=merged,
                metadata={
                    **item.metadata,
                    "scope_filtered": True,
                    "scope_filter_mode": "graph_metadata" if blocks_legacy_matched == 0 else "graph_metadata_with_legacy_fallback",
                },
                score=item.score,
            )
        )

    return RetrieverResult(
        items=filtered_items,
        metadata={
            **getattr(retriever_result, "metadata", {}),
            "scope_filtered": True,
            "scope_user_id": user_id,
            "scope_project_id": project_id,
            "scope_blocks_seen": blocks_seen,
            "scope_blocks_kept": blocks_kept,
            "scope_blocks_graph_matched": blocks_graph_matched,
            "scope_blocks_legacy_matched": blocks_legacy_matched,
        },
    )


async def _apply_scope_metadata(
    rag: Any,
    *,
    document_id: str,
    user_id: str | None,
    project_id: str | None,
    source: str | None,
) -> None:
    graph_store = getattr(rag, "_graph_store", None)
    if graph_store is None:
        return

    await graph_store.query_raw(
        "MATCH (d:Document {id: $document_id}) "
        "SET d.openmemory_document_id = $document_id, "
        "    d.openmemory_user_id = $user_id, "
        "    d.openmemory_project_id = $project_id, "
        "    d.openmemory_source = $source "
        "WITH d "
        "OPTIONAL MATCH (d)-[:PART_OF]->(c:Chunk) "
        "SET c.openmemory_document_id = $document_id, "
        "    c.openmemory_user_id = $user_id, "
        "    c.openmemory_project_id = $project_id, "
        "    c.openmemory_source = $source",
        {
            "document_id": document_id,
            "user_id": user_id,
            "project_id": project_id,
            "source": source,
        },
    )


def _parse_scope_from_chunk_text(text: str) -> dict[str, str | None]:
    return {
        "user_id": _extract_provenance_value(text, "OpenMemory user id:"),
        "project_id": _extract_provenance_value(text, "OpenMemory project id:"),
        "source": _extract_provenance_value(text, "OpenMemory source:"),
    }


async def _backfill_scope_metadata(
    rag: Any,
    *,
    document_ids: list[str] | None = None,
    dry_run: bool = False,
    limit: int = 1000,
) -> dict[str, Any]:
    graph_store = getattr(rag, "_graph_store", None)
    if graph_store is None:
        raise RuntimeError("GraphRAG graph_store is unavailable for backfill")

    if document_ids:
        result = await graph_store.query_raw(
            "UNWIND $ids AS id "
            "MATCH (d:Document {id: id})-[:PART_OF]->(c:Chunk) "
            "RETURN d.id AS document_id, c.text AS chunk_text "
            "LIMIT $limit",
            {"ids": document_ids, "limit": limit},
        )
    else:
        result = await graph_store.query_raw(
            "MATCH (d:Document)-[:PART_OF]->(c:Chunk) "
            "WHERE d.openmemory_user_id IS NULL OR d.openmemory_project_id IS NULL "
            "RETURN d.id AS document_id, c.text AS chunk_text "
            "LIMIT $limit",
            {"limit": limit},
        )

    seen_docs: set[str] = set()
    scanned = 0
    backfilled = 0
    skipped = 0
    candidates: list[dict[str, str | None]] = []

    for row in result.result_set:
        document_id = row[0] if row else None
        chunk_text = row[1] if len(row) > 1 else None
        if not document_id or document_id in seen_docs:
            continue
        seen_docs.add(document_id)
        scanned += 1
        parsed = _parse_scope_from_chunk_text(chunk_text or "")
        if not parsed["user_id"] or not parsed["project_id"]:
            skipped += 1
            continue
        candidate = {
            "document_id": document_id,
            "user_id": parsed["user_id"],
            "project_id": parsed["project_id"],
            "source": parsed["source"],
        }
        candidates.append(candidate)
        if not dry_run:
            await _apply_scope_metadata(
                rag,
                document_id=document_id,
                user_id=parsed["user_id"],
                project_id=parsed["project_id"],
                source=parsed["source"],
            )
        backfilled += 1

    return {
        "ok": True,
        "dry_run": dry_run,
        "scanned_documents": scanned,
        "backfilled_documents": backfilled,
        "skipped_documents": skipped,
        "document_ids": [item["document_id"] for item in candidates],
    }


async def _scoped_completion(
    rag: Any,
    req: QueryRequest,
    *,
    sdk_main: Any,
    ChatMessage: Any,
    RagResult: Any,
    RetrieverResult: Any,
    RetrieverResultItem: Any,
) -> dict[str, Any]:
    strategy = _retrieval_strategy_for_k(rag, req.k)
    pushdown = await _scoped_chunk_pushdown_retriever(
        rag,
        req,
        RetrieverResult=RetrieverResult,
        RetrieverResultItem=RetrieverResultItem,
    )
    if _scope_legacy_backfill_required_state is None:
        _update_scope_state(await _scope_gap_counts())

    legacy_recovery_active = bool(
        _scope_legacy_backfill_required_state and _legacy_scope_recovery_enabled()
    )

    if not legacy_recovery_active:
        filtered = _finalize_graph_native_retriever_result(
            pushdown,
            RetrieverResult=RetrieverResult,
            RetrieverResultItem=RetrieverResultItem,
        )
    else:
        legacy = None
        retriever_result = await rag.retrieve(req.query, strategy=strategy)
        legacy = await _filter_retriever_result_by_scope(
            rag,
            retriever_result,
            user_id=req.user_id,
            project_id=req.project_id,
            RetrieverResult=RetrieverResult,
            RetrieverResultItem=RetrieverResultItem,
        )
        filtered = _merge_scoped_retriever_results(
            pushdown,
            legacy,
            RetrieverResult=RetrieverResult,
            RetrieverResultItem=RetrieverResultItem,
        )
    retrieval_mode = filtered.metadata.get("scope_retrieval_mode", "none")

    if not filtered.items:
        meta = getattr(filtered, "metadata", {})
        return {
            "ok": False,
            "error": "scoped query returned no scope-matching context",
            "scope_enforced": True,
            "scope_retrieval_mode": retrieval_mode,
            "scope_legacy_recovery_enabled": _legacy_scope_recovery_enabled(),
            "user_id": req.user_id,
            "project_id": req.project_id,
            "scope_blocks_seen": meta.get("scope_blocks_seen", 0),
            "scope_blocks_kept": meta.get("scope_blocks_kept", 0),
            "scope_blocks_graph_matched": meta.get("scope_blocks_graph_matched", 0),
            "scope_blocks_legacy_matched": meta.get("scope_blocks_legacy_matched", 0),
            "scope_candidate_chunk_count": meta.get("scope_candidate_chunk_count", 0),
        }

    context_str = "\n---\n".join(
        sdk_main._neutralize_context_close_tag(item.content)
        for item in filtered.items
    )
    messages = [
        ChatMessage(role="system", content=sdk_main._RAG_SYSTEM_PROMPT_DELIMITED),
        ChatMessage(
            role="user",
            content=sdk_main._RAG_PROMPT.format(
                context=context_str,
                question=req.query,
            ),
        ),
    ]
    llm_response = await rag.llm.ainvoke_messages(messages)
    result = RagResult(
        answer=rag._clean_answer(llm_response.content),
        retriever_result=filtered if req.return_context else None,
        metadata={
            "model": rag.llm.model_name,
            "num_context_items": len(filtered.items),
            "strategy": strategy.__class__.__name__,
            "has_history": False,
            "retrieval_query": req.query,
            "scope_enforced": True,
            "scope_retrieval_mode": retrieval_mode,
            "scope_legacy_recovery_enabled": _legacy_scope_recovery_enabled(),
            "scope_user_id": req.user_id,
            "scope_project_id": req.project_id,
            "scope_blocks_seen": filtered.metadata.get("scope_blocks_seen", 0),
            "scope_blocks_kept": filtered.metadata.get("scope_blocks_kept", 0),
            "scope_blocks_graph_matched": filtered.metadata.get("scope_blocks_graph_matched", 0),
            "scope_blocks_legacy_matched": filtered.metadata.get("scope_blocks_legacy_matched", 0),
            "scope_candidate_chunk_count": filtered.metadata.get("scope_candidate_chunk_count", 0),
        },
    )
    return {
        "ok": True,
        "query": req.query,
        "k": req.k,
        "k_applied": True,
        "user_id": req.user_id,
        "project_id": req.project_id,
        "scope_enforced": True,
        "scope_retrieval_mode": retrieval_mode,
        "scope_legacy_recovery_enabled": _legacy_scope_recovery_enabled(),
        "result": _model_dump(result),
    }


@asynccontextmanager
async def _rag_context():
    _require_model_env()
    (
        ConnectionConfig,
        _FalkorDBConnection,
        GraphRAG,
        LiteLLM,
        LiteLLMEmbedder,
        _sdk_main,
        _ChatMessage,
        _RagResult,
        _RetrieverResult,
        _RetrieverResultItem,
    ) = _load_graphrag()

    api_base = os.getenv("OM_GRAPHRAG_API_BASE") or os.getenv("OLLAMA_API_BASE")
    llm_kwargs: dict[str, Any] = {}
    embedder_kwargs: dict[str, Any] = {}
    if api_base:
        llm_kwargs["api_base"] = api_base
        embedder_kwargs["api_base"] = api_base

    llm_max_tokens = os.getenv("OM_GRAPHRAG_LLM_MAX_TOKENS")
    if llm_max_tokens:
        llm_kwargs["max_tokens"] = int(llm_max_tokens)

    embedding_dimension = 256
    dimensions = os.getenv("OM_GRAPHRAG_EMBEDDER_DIMENSIONS")
    if dimensions:
        embedding_dimension = int(dimensions)

    async with GraphRAG(
        connection=ConnectionConfig(
            host=os.getenv("FALKORDB_HOST", "localhost"),
            port=_env_int("FALKORDB_PORT", 6379),
            username=os.getenv("FALKORDB_USERNAME") or None,
            password=os.getenv("FALKORDB_PASSWORD") or None,
            graph_name=os.getenv("OM_GRAPHRAG_GRAPH_NAME", "openmemory"),
        ),
        llm=LiteLLM(model=os.getenv("OM_GRAPHRAG_LLM_MODEL"), **llm_kwargs),
        embedder=LiteLLMEmbedder(
            model=os.getenv("OM_GRAPHRAG_EMBEDDER_MODEL"),
            **embedder_kwargs,
        ),
        embedding_dimension=embedding_dimension,
    ) as rag:
        yield rag


async def _scope_gap_counts() -> dict[str, int] | None:
    try:
        (
            ConnectionConfig,
            FalkorDBConnection,
            _GraphRAG,
            _LiteLLM,
            _LiteLLMEmbedder,
            _sdk_main,
            _ChatMessage,
            _RagResult,
            _RetrieverResult,
            _RetrieverResultItem,
        ) = _load_graphrag()
        conn = FalkorDBConnection(
            ConnectionConfig(
                host=os.getenv("FALKORDB_HOST", "localhost"),
                port=_env_int("FALKORDB_PORT", 6379),
                username=os.getenv("FALKORDB_USERNAME") or None,
                password=os.getenv("FALKORDB_PASSWORD") or None,
                graph_name=os.getenv("OM_GRAPHRAG_GRAPH_NAME", "openmemory"),
            )
        )
        docs_total = await conn.query("MATCH (d:Document) RETURN count(d)")
        docs_missing = await conn.query(
            "MATCH (d:Document) WHERE d.openmemory_project_id IS NULL OR d.openmemory_user_id IS NULL RETURN count(d)"
        )
        chunks_total = await conn.query("MATCH (c:Chunk) RETURN count(c)")
        chunks_missing = await conn.query(
            "MATCH (c:Chunk) WHERE c.openmemory_project_id IS NULL OR c.openmemory_user_id IS NULL RETURN count(c)"
        )
        return {
            "documents_total": docs_total.result_set[0][0] if docs_total.result_set else 0,
            "documents_missing_scope": docs_missing.result_set[0][0] if docs_missing.result_set else 0,
            "chunks_total": chunks_total.result_set[0][0] if chunks_total.result_set else 0,
            "chunks_missing_scope": chunks_missing.result_set[0][0] if chunks_missing.result_set else 0,
        }
    except Exception:
        return None


app = FastAPI(title="OpenMemory GraphRAG Bridge", version="0.1.0")
_gliner_prewarm_status = "not_started"
_gliner_prewarm_error: str | None = None
_gliner_offline_after_prewarm = False
_gliner_local_model_path: str | None = None
_gliner_patch_installed = False
_gliner_debug_patch_installed = False
_litellm_debug_patch_installed = False
_hf_warning_filter_patch_installed = False
_hf_warning_logger_filter: logging.Filter | None = None
_scope_gap_counts_state: dict[str, int] | None = None
_scope_legacy_backfill_required_state: bool | None = None


def _update_scope_state(scope_counts: dict[str, int] | None) -> None:
    global _scope_gap_counts_state, _scope_legacy_backfill_required_state
    _scope_gap_counts_state = scope_counts
    _scope_legacy_backfill_required_state = (
        None
        if scope_counts is None
        else bool(
            scope_counts["documents_missing_scope"] > 0
            or scope_counts["chunks_missing_scope"] > 0
        )
    )


def _scope_health_contract_fields(scope_legacy_required: bool | None) -> dict[str, Any]:
    scope_storage_contract = (
        "document_chunk_properties_with_legacy_fallback"
        if scope_legacy_required in (None, True)
        else "document_chunk_properties"
    )
    return {
        "scope_storage_contract": scope_storage_contract,
        "scope_operator_recovery_path_present": True,
        # Deprecated compatibility alias. Kept to avoid breaking existing consumers.
        "scope_storage_compatibility_path_present": True,
    }


def _gliner_model_name() -> str:
    return os.getenv("OM_GRAPHRAG_GLINER_MODEL", "urchade/gliner_medium-v2.1")


def _gliner_cache_dir() -> str | None:
    return os.getenv("OM_GRAPHRAG_GLINER_CACHE_DIR") or os.getenv("HF_HOME")


def _gliner_prewarm_enabled() -> bool:
    return os.getenv("OM_GRAPHRAG_GLINER_PREWARM", "true").lower() == "true"


def _gliner_online_fallback_enabled() -> bool:
    return os.getenv("OM_GRAPHRAG_GLINER_ALLOW_ONLINE_FALLBACK", "false").lower() == "true"


def _legacy_scope_recovery_enabled() -> bool:
    return os.getenv("OM_GRAPHRAG_ENABLE_LEGACY_SCOPE_RECOVERY", "false").lower() == "true"


def _test_disable_extraction() -> bool:
    return os.getenv("OM_GRAPHRAG_TEST_DISABLE_EXTRACTION", "false").lower() == "true"


def _test_extractor_override() -> Any | None:
    if not _test_disable_extraction():
        return None

    class _NoOpExtractionStrategy:
        async def extract(self, chunks: Any, schema: Any, ctx: Any) -> Any:
            from graphrag_sdk.core.models import GraphData

            if ctx is not None:
                try:
                    ctx.log("Using no-op GraphRAG extraction override")
                except Exception:
                    pass

            return GraphData(
                nodes=[],
                relationships=[],
                mentions=[],
                extracted_entities=[],
                extracted_relations=[],
            )

    return _NoOpExtractionStrategy()


class _HFWarningMessageFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return _HF_UNAUTH_WARNING_SNIPPET not in record.getMessage()


def _install_hf_warning_filter_patch() -> None:
    global _hf_warning_filter_patch_installed, _hf_warning_logger_filter
    if _hf_warning_filter_patch_installed:
        return

    target_logger = logging.getLogger(_HF_HTTP_LOGGER_NAME)
    if _hf_warning_logger_filter is None:
        _hf_warning_logger_filter = _HFWarningMessageFilter()
    if _hf_warning_logger_filter not in target_logger.filters:
        target_logger.addFilter(_hf_warning_logger_filter)
    _hf_warning_filter_patch_installed = True


def _gliner_cache_snapshot_path(model_name: str, cache_dir: str | None) -> str | None:
    if not cache_dir or "/" not in model_name:
        return None

    namespace, repo = model_name.split("/", 1)
    repo_dir = Path(cache_dir) / f"models--{namespace}--{repo}"
    snapshots_dir = repo_dir / "snapshots"
    refs_dir = repo_dir / "refs"

    if refs_dir.exists():
        for ref_name in ("main", "master"):
            ref_file = refs_dir / ref_name
            if ref_file.exists():
                commit = ref_file.read_text(encoding="utf-8").strip()
                candidate = snapshots_dir / commit
                if candidate.exists():
                    return str(candidate)

    if snapshots_dir.exists():
        candidates = [path for path in snapshots_dir.iterdir() if path.is_dir()]
        if candidates:
            candidates.sort(key=lambda path: path.stat().st_mtime, reverse=True)
            return str(candidates[0])

    return None


def _resolve_gliner_local_path(*, allow_download: bool) -> str | None:
    configured = os.getenv("OM_GRAPHRAG_GLINER_LOCAL_PATH")
    if configured and os.path.exists(configured):
        return configured

    model_name = _gliner_model_name()
    if os.path.exists(model_name):
        return model_name

    cache_hit = _gliner_cache_snapshot_path(model_name, _gliner_cache_dir())
    if cache_hit:
        return cache_hit

    if not allow_download:
        return None

    try:
        from huggingface_hub import snapshot_download

        return snapshot_download(
            model_name,
            cache_dir=_gliner_cache_dir(),
            local_files_only=not allow_download,
        )
    except Exception:
        return None


def _install_gliner_local_path_patch() -> None:
    global _gliner_patch_installed
    if _gliner_patch_installed or not _gliner_local_model_path:
        return

    from graphrag_sdk.ingestion.extraction_strategies.entity_extractors import GLiNERExtractor

    original_init = GLiNERExtractor.__init__

    def patched_init(self, threshold: float = 0.75, model_name: str = "urchade/gliner_medium-v2.1") -> None:
        effective = model_name
        if model_name == "urchade/gliner_medium-v2.1" and _gliner_local_model_path:
            effective = _gliner_local_model_path
        original_init(self, threshold=threshold, model_name=effective)

    GLiNERExtractor.__init__ = patched_init  # type: ignore[assignment]
    _gliner_patch_installed = True


def _install_gliner_debug_patch() -> None:
    global _gliner_debug_patch_installed
    if _gliner_debug_patch_installed or not _debug_timing_env_enabled():
        return

    from graphrag_sdk.ingestion.extraction_strategies.entity_extractors import GLiNERExtractor

    original_load_model = GLiNERExtractor._load_model
    original_predict_sync = GLiNERExtractor._predict_sync

    def patched_load_model(self: Any) -> Any:
        started = time.perf_counter()
        _emit_debug_timing(
            "gliner_load_model_start",
            model_name=getattr(self, "_model_name", "unknown"),
        )
        try:
            model = original_load_model(self)
            _emit_debug_timing(
                "gliner_load_model_done",
                model_name=getattr(self, "_model_name", "unknown"),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            return model
        except Exception as exc:
            _emit_debug_timing(
                "gliner_load_model_error",
                model_name=getattr(self, "_model_name", "unknown"),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                error=repr(exc),
            )
            raise

    def patched_predict_sync(self: Any, text: str, entity_types: list[str]) -> list[dict[str, Any]]:
        started = time.perf_counter()
        _emit_debug_timing(
            "gliner_predict_start",
            model_name=getattr(self, "_model_name", "unknown"),
            text_len=len(text),
            entity_types=len(entity_types),
        )
        try:
            result = original_predict_sync(self, text, entity_types)
            _emit_debug_timing(
                "gliner_predict_done",
                model_name=getattr(self, "_model_name", "unknown"),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                entities=len(result),
            )
            return result
        except Exception as exc:
            _emit_debug_timing(
                "gliner_predict_error",
                model_name=getattr(self, "_model_name", "unknown"),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                error=repr(exc),
            )
            raise

    GLiNERExtractor._load_model = patched_load_model  # type: ignore[assignment]
    GLiNERExtractor._predict_sync = patched_predict_sync  # type: ignore[assignment]
    _gliner_debug_patch_installed = True


def _install_litellm_debug_patch() -> None:
    global _litellm_debug_patch_installed
    if _litellm_debug_patch_installed or not _debug_timing_env_enabled():
        return

    from graphrag_sdk import LiteLLM, LiteLLMEmbedder

    original_ainvoke = LiteLLM.ainvoke
    original_embed_async = LiteLLMEmbedder._raw_embed_async

    async def patched_ainvoke(self: Any, prompt: str, *args: Any, **kwargs: Any) -> Any:
        started = time.perf_counter()
        _emit_debug_timing(
            "litellm_ainvoke_start",
            model_name=getattr(self, "model_name", "unknown"),
            prompt_len=len(prompt),
        )
        try:
            result = await original_ainvoke(self, prompt, *args, **kwargs)
            _emit_debug_timing(
                "litellm_ainvoke_done",
                model_name=getattr(self, "model_name", "unknown"),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
            )
            return result
        except Exception as exc:
            _emit_debug_timing(
                "litellm_ainvoke_error",
                model_name=getattr(self, "model_name", "unknown"),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                error=repr(exc),
            )
            raise

    async def patched_embed_async(self: Any, texts: list[str], *args: Any, **kwargs: Any) -> list[list[float]]:
        started = time.perf_counter()
        _emit_debug_timing(
            "litellm_embed_start",
            model_name=getattr(self, "model", "unknown"),
            batch_size=len(texts),
            total_chars=sum(len(text) for text in texts),
        )
        try:
            result = await original_embed_async(self, texts, *args, **kwargs)
            _emit_debug_timing(
                "litellm_embed_done",
                model_name=getattr(self, "model", "unknown"),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                vectors=len(result),
            )
            return result
        except Exception as exc:
            _emit_debug_timing(
                "litellm_embed_error",
                model_name=getattr(self, "model", "unknown"),
                elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                error=repr(exc),
            )
            raise

    LiteLLM.ainvoke = patched_ainvoke  # type: ignore[assignment]
    LiteLLMEmbedder._raw_embed_async = patched_embed_async  # type: ignore[assignment]
    _litellm_debug_patch_installed = True


def _prewarm_gliner_sync() -> None:
    from gliner import GLiNER

    global _gliner_local_model_path
    cache_dir = _gliner_cache_dir()
    old_hf_offline = os.environ.get("HF_HUB_OFFLINE")
    old_tf_offline = os.environ.get("TRANSFORMERS_OFFLINE")
    local_path = _resolve_gliner_local_path(allow_download=False)
    if local_path:
        _gliner_local_model_path = local_path
        _install_gliner_local_path_patch()
    sink = io.StringIO()
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message=r".*resume_download.*deprecated.*",
        )
        with redirect_stderr(sink), redirect_stdout(sink):
            try:
                os.environ["HF_HUB_OFFLINE"] = "1"
                os.environ["TRANSFORMERS_OFFLINE"] = "1"
                GLiNER.from_pretrained(
                    _gliner_local_model_path or _gliner_model_name(),
                    cache_dir=cache_dir,
                    local_files_only=True,
                )
                return
            except Exception:
                if old_hf_offline is None:
                    os.environ.pop("HF_HUB_OFFLINE", None)
                else:
                    os.environ["HF_HUB_OFFLINE"] = old_hf_offline
                if old_tf_offline is None:
                    os.environ.pop("TRANSFORMERS_OFFLINE", None)
                else:
                    os.environ["TRANSFORMERS_OFFLINE"] = old_tf_offline
                if local_path and not _gliner_online_fallback_enabled():
                    raise RuntimeError(
                        "cached local GLiNER prewarm failed and online fallback is disabled"
                    )
                if not local_path and not _gliner_online_fallback_enabled():
                    raise RuntimeError(
                        "GLiNER cache miss and online fallback is disabled"
                    )
                downloaded = GLiNER.from_pretrained(_gliner_model_name(), cache_dir=cache_dir)
                if _gliner_local_model_path is None:
                    resolved = _resolve_gliner_local_path(allow_download=False)
                    if resolved:
                        _gliner_local_model_path = resolved
                        _install_gliner_local_path_patch()
                return downloaded


async def _prewarm_gliner() -> None:
    global _gliner_prewarm_status, _gliner_prewarm_error, _gliner_offline_after_prewarm
    _gliner_prewarm_status = "running"
    _gliner_prewarm_error = None
    try:
        await asyncio.to_thread(_prewarm_gliner_sync)
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        _gliner_offline_after_prewarm = True
        _gliner_prewarm_status = "ready"
    except Exception as exc:  # pragma: no cover - best-effort warm path
        _gliner_prewarm_status = "failed"
        _gliner_prewarm_error = str(exc)


@app.on_event("startup")
async def startup_event() -> None:
    _install_hf_warning_filter_patch()
    _install_gliner_debug_patch()
    _install_litellm_debug_patch()
    if _gliner_prewarm_enabled():
        asyncio.create_task(_prewarm_gliner())


@app.get("/health")
async def health() -> dict[str, Any]:
    missing_model_env = _missing_model_env()
    missing_bridge_auth_env = _missing_bridge_auth_env()
    falkordb_host = os.getenv("FALKORDB_HOST", "localhost")
    falkordb_port = _env_int("FALKORDB_PORT", 6379)
    falkordb_reachable = await _tcp_reachable(falkordb_host, falkordb_port)
    try:
        _load_graphrag()
        import_available = True
        error = None
    except RuntimeError as exc:
        import_available = False
        error = str(exc)
    scope_counts = await _scope_gap_counts() if import_available and falkordb_reachable else None
    _update_scope_state(scope_counts)
    scope_legacy_required = _scope_legacy_backfill_required_state
    scope_contract_fields = _scope_health_contract_fields(scope_legacy_required)

    return {
        "ok": import_available and not missing_model_env and not missing_bridge_auth_env and falkordb_reachable,
        "graphrag_available": import_available,
        "configured": not missing_model_env and not missing_bridge_auth_env,
        "missing_model_env": missing_model_env,
        "bridge_auth_configured": not missing_bridge_auth_env,
        "missing_bridge_auth_env": missing_bridge_auth_env,
        "falkordb_reachable": falkordb_reachable,
        "scope_query_filtering": True,
        **scope_contract_fields,
        "scope_legacy_recovery_enabled": _legacy_scope_recovery_enabled(),
        "test_disable_extraction": _test_disable_extraction(),
        "gliner_model": _gliner_model_name(),
        "gliner_local_model_path": _gliner_local_model_path,
        "gliner_cache_dir": _gliner_cache_dir(),
        "gliner_prewarm_enabled": _gliner_prewarm_enabled(),
        "gliner_online_fallback_enabled": _gliner_online_fallback_enabled(),
        "gliner_prewarm_status": _gliner_prewarm_status,
        "gliner_prewarm_error": _gliner_prewarm_error,
        "gliner_offline_after_prewarm": _gliner_offline_after_prewarm,
        "hf_warning_filter_patch_installed": _hf_warning_filter_patch_installed,
        "scope_gap_counts": scope_counts,
        "scope_legacy_backfill_required": scope_legacy_required,
        "error": error,
        "graph_name": os.getenv("OM_GRAPHRAG_GRAPH_NAME", "openmemory"),
        "falkordb_host": falkordb_host,
        "falkordb_port": falkordb_port,
    }


@app.post("/documents/upsert")
async def upsert_document(request: Request, req: UpsertDocumentRequest) -> dict[str, Any]:
    _require_bridge_auth(request)
    debug_timing = _debug_timing_enabled(request)
    started = time.perf_counter()
    phase_started = started
    timings_ms: dict[str, float] = {}

    def record_phase(name: str) -> None:
        nonlocal phase_started
        now = time.perf_counter()
        elapsed_ms = round((now - phase_started) * 1000, 2)
        timings_ms[name] = elapsed_ms
        phase_started = now
        if debug_timing:
            _emit_debug_timing(
                "phase",
                document_id=req.document_id,
                phase=name,
                elapsed_ms=elapsed_ms,
                total_ms=round((now - started) * 1000, 2),
            )

    try:
        if debug_timing:
            _emit_debug_timing(
                "start",
                document_id=req.document_id,
                finalize=req.finalize,
                user_id=req.user_id or "unknown",
                project_id=req.project_id or "system_global",
            )
        async with _rag_context() as rag:
            record_phase("rag_context_entered")
            extractor = _test_extractor_override()
            metadata = {
                **req.metadata,
                "openmemory_user_id": req.user_id,
                "openmemory_project_id": req.project_id,
                "openmemory_document_id": req.document_id,
            }

            result = await rag.update(
                text=_with_provenance(req),
                document_id=req.document_id,
                extractor=extractor,
                if_missing="ingest",
                ctx=None,
            )
            record_phase("rag_update")
            await _apply_scope_metadata(
                rag,
                document_id=req.document_id,
                user_id=req.user_id,
                project_id=req.project_id,
                source=req.metadata.get("source"),
            )
            record_phase("scope_metadata")
            if hasattr(result, "metadata") and isinstance(result.metadata, dict):
                result.metadata.update(metadata)

            finalize_result = None
            if req.finalize:
                finalize_result = await rag.finalize()
                record_phase("finalize")

            total_ms = round((time.perf_counter() - started) * 1000, 2)
            if debug_timing:
                _emit_debug_timing(
                    "done",
                    document_id=req.document_id,
                    total_ms=total_ms,
                )
            return {
                "ok": True,
                "document_id": req.document_id,
                "ingestion": _model_dump(result),
                "finalize": _model_dump(finalize_result),
                "timings_ms": timings_ms if debug_timing else None,
                "total_ms": total_ms if debug_timing else None,
            }
    except Exception as exc:
        if debug_timing:
            _emit_debug_timing(
                "error",
                document_id=req.document_id,
                phase=list(timings_ms.keys())[-1] if timings_ms else "start",
                error=repr(exc),
                total_ms=round((time.perf_counter() - started) * 1000, 2),
            )
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/documents/delete")
async def delete_document(request: Request, req: DeleteDocumentRequest) -> dict[str, Any]:
    _require_bridge_auth(request)
    try:
        async with _rag_context() as rag:
            result = await rag.delete_document(req.document_id, if_missing="ignore")

            finalize_result = None
            if req.finalize:
                finalize_result = await rag.finalize()

            return {
                "ok": True,
                "document_id": req.document_id,
                "deletion": _model_dump(result),
                "finalize": _model_dump(finalize_result),
            }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/scope/backfill")
async def backfill_scope(request: Request, req: BackfillScopeRequest) -> dict[str, Any]:
    _require_bridge_auth(request)
    try:
        async with _rag_context() as rag:
            result = await _backfill_scope_metadata(
                rag,
                document_ids=req.document_ids or None,
                dry_run=req.dry_run,
                limit=req.limit,
            )
            if not req.dry_run:
                _update_scope_state(await _scope_gap_counts())
            return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/query")
async def query(request: Request, req: QueryRequest) -> dict[str, Any]:
    _require_bridge_auth(request)
    try:
        (
            _ConnectionConfig,
            _FalkorDBConnection,
            _GraphRAG,
            _LiteLLM,
            _LiteLLMEmbedder,
            sdk_main,
            ChatMessage,
            RagResult,
            RetrieverResult,
            RetrieverResultItem,
        ) = _load_graphrag()
        async with _rag_context() as rag:
            if req.user_id or req.project_id:
                return await _scoped_completion(
                    rag,
                    req,
                    sdk_main=sdk_main,
                    ChatMessage=ChatMessage,
                    RagResult=RagResult,
                    RetrieverResult=RetrieverResult,
                    RetrieverResultItem=RetrieverResultItem,
                )

            strategy = _retrieval_strategy_for_k(rag, req.k)
            result = await rag.completion(
                req.query,
                strategy=strategy,
                return_context=req.return_context,
            )
            payload = _model_dump(result)
            return {
                "ok": True,
                "query": req.query,
                "k": req.k,
                "k_applied": True,
                "user_id": req.user_id,
                "project_id": req.project_id,
                "scope_enforced": False,
                "result": payload,
            }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
