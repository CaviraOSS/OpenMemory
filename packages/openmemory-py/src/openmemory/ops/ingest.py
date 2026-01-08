import asyncio
import json
import logging
import uuid
import time
from typing import Dict, Any, Optional

from ..core.db import q, db, transaction
from ..memory.hsg import add_hsg_memory
from ..utils.vectors import rid
from .extract import extract_text

LG = 8000
SEC = 3000

def split_text(t: str, sz: int) -> list[str]:
    if len(t) <= sz: return [t]
    secs = []
    paras = t.split("\n\n")
    cur = ""
    for p in paras:
        if len(cur) + len(p) > sz and len(cur) > 0:
            secs.append(cur.strip())
            cur = p
        else:
            cur += ("\n\n" if cur else "") + p

    if cur.strip(): secs.append(cur.strip())
    return secs

async def mk_root(txt: str, ex: Dict, meta: Dict = None, user_id: str = None) -> str:
    summ = txt[:500] + "..." if len(txt) > 500 else txt
    ctype = ex["metadata"]["content_type"].upper()
    sec_count = int(len(txt) / SEC) + 1
    content = f"[Document: {ctype}]\n\n{summ}\n\n[Full content split across {sec_count} sections]"

    mid = str(uuid.uuid4())
    ts = int(time.time()*1000)

    try:
        full_meta = meta or {}
        full_meta.update(ex["metadata"])
        full_meta.update({
            "is_root": True,
            "ingestion_strategy": "root-child",
            "ingested_at": ts
        })

        q.ins_mem(
            id=mid,
            content=content,
            primary_sector="reflective",
            tags=json.dumps([]),
            meta=json.dumps(full_meta, default=str),
            created_at=ts,
            updated_at=ts,
            last_seen_at=ts,
            salience=1.0,
            decay_lambda=0.1,
            segment=1,
            user_id=user_id or "anonymous",
            feedback_score=0
        )
        return mid
    except Exception as e:
        raise e

async def mk_child(txt: str, idx: int, tot: int, rid: str, meta: Dict = None, user_id: str = None) -> str:
    m = meta or {}
    m.update({
        "is_child": True,
        "section_index": idx,
        "total_sections": tot,
        "parent_id": rid
    })
    r = await add_hsg_memory(txt, json.dumps([]), m, user_id)
    return r["id"]

async def link(rid: str, cid: str, idx: int, user_id: str = None):
    ts = int(time.time()*1000)
    db.execute("INSERT INTO waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)",
               (rid, cid, user_id or "anonymous", 1.0, ts, ts))
    db.commit()

async def ingest_document(t: str, data: Any, meta: Dict = None, cfg: Dict = None, user_id: str = None, tags: list = None) -> Dict[str, Any]:
    th = cfg.get("lg_thresh", LG) if cfg else LG
    sz = cfg.get("sec_sz", SEC) if cfg else SEC

    ex = await extract_text(t, data)
    text = ex["text"]
    exMeta = ex["metadata"]
    est_tok = exMeta["estimated_tokens"]

    use_rc = (cfg and cfg.get("force_root")) or est_tok > th
    tags_json = json.dumps(tags or [])

    if not use_rc:
        m = meta or {}
        m.update(exMeta)
        m.update({"ingestion_strategy": "single", "ingested_at": int(time.time()*1000)})

        r = await add_hsg_memory(text, tags_json, m, user_id)
        return {
            "root_memory_id": r["id"],
            "child_count": 0,
            "total_tokens": est_tok,
            "strategy": "single",
            "extraction": exMeta
        }

    secs = split_text(text, sz)
    print(f"[INGEST] Splitting into {len(secs)} sections")

    cids = []
    try:
        rid_val = await mk_root(text, ex, meta, user_id)
        for i, s in enumerate(secs):
             cid = await mk_child(s, i, len(secs), rid_val, meta, user_id)
             cids.append(cid)
             await link(rid_val, cid, i, user_id)

        return {
            "root_memory_id": rid_val,
            "child_count": len(secs),
            "total_tokens": est_tok,
            "strategy": "root-child",
            "extraction": exMeta
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[INGEST] Failed: {e}")
        raise e

async def ingest_url(url: str, meta: Dict = None, cfg: Dict = None, user_id: str = None) -> Dict[str, Any]:
    from .extract import extract_url
    ex = await extract_url(url)

    th = cfg.get("lg_thresh", LG) if cfg else LG
    sz = cfg.get("sec_sz", SEC) if cfg else SEC

    use_rc = (cfg and cfg.get("force_root")) or ex["metadata"]["estimated_tokens"] > th

    if not use_rc:
        m = meta or {}
        m.update(ex["metadata"])
        m.update({"ingestion_strategy": "single", "ingested_at": int(time.time()*1000)})
        r = await add_hsg_memory(ex["text"], json.dumps([]), m, user_id)
        return {
            "root_memory_id": r["id"],
            "child_count": 0,
            "total_tokens": ex["metadata"]["estimated_tokens"],
            "strategy": "single",
            "extraction": ex["metadata"]
        }

    secs = split_text(ex["text"], sz)
    cids = []

    m_root = meta or {}
    m_root["source_url"] = url

    try:
        rid_val = await mk_root(ex["text"], ex, m_root, user_id)
        for i, s in enumerate(secs):
             cid = await mk_child(s, i, len(secs), rid_val, m_root, user_id)
             cids.append(cid)
             await link(rid_val, cid, i, user_id)

        return {
            "root_memory_id": rid_val,
            "child_count": len(secs),
            "total_tokens": ex["metadata"]["estimated_tokens"],
            "strategy": "root-child",
            "extraction": ex["metadata"]
        }
    except Exception as e:
        print(f"[INGEST] URL Failed: {e}")
        raise e
