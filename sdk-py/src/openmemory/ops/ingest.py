import uuid
import time
import json
from ..core.db import q
from ..memory.hsg import classify_content
from ..__init__ import OpenMemory # Circular dependency? No, OpenMemory uses hsg, ingest uses hsg.
# Actually ingest uses add_hsg_memory from memory/hsg. I need to expose that or use OpenMemory.add logic.
# In JS, it imports add_hsg_memory. I haven't implemented add_hsg_memory in hsg.py yet, I put it in OpenMemory.add.
# I should refactor OpenMemory.add to use a standalone function in hsg.py or similar.
# For now, I'll just replicate the logic or assume OpenMemory instance is passed or I use the db directly.
# The JS code uses q.ins_mem directly for root, and add_hsg_memory for child.

# I'll define a helper here or in hsg.py
from ..memory.hsg import classify_content, sector_configs, calc_mean_vec
from ..memory.embed import embed_multi_sector, vector_to_buffer
from ..utils.chunking import chunk_text

async def add_hsg_memory(content, tags, meta, user_id=None):
    # Replicating logic from OpenMemory.add for internal use
    id = str(uuid.uuid4())
    now = int(time.time() * 1000)

    classification = classify_content(content, meta)
    primary_sector = classification["primary"]
    sectors = [primary_sector] + classification["additional"]

    chunks = chunk_text(content) if len(content) > 3000 else None
    embeddings = await embed_multi_sector(id, content, sectors, chunks)
    mean_vec = calc_mean_vec(embeddings, sectors)
    mean_buf = vector_to_buffer(mean_vec)

    tags_json = json.dumps(tags) if tags else None
    meta_json = json.dumps(meta) if meta else None
    salience = 0.5
    decay_lambda = sector_configs.get(primary_sector, {}).get("decay_lambda", 0.001)

    q.ins_mem.run(
        id, user_id, 0, content, None, primary_sector,
        tags_json, meta_json, now, now, now, salience, decay_lambda, 1,
        len(mean_vec), mean_buf, None, 0
    )

    for emb in embeddings:
        vec_buf = vector_to_buffer(emb["vector"])
        q.ins_vec.run(id, emb["sector"], user_id, vec_buf, emb["dim"])
        
    return {"id": id}

def split(t, sz):
    if len(t) <= sz: return [t]
    secs = []
    paras = t.split("\n\n") # Regex split in JS was /\n\n+/
    cur = ""
    for p in paras:
        if len(cur) + len(p) > sz and len(cur) > 0:
            secs.append(cur.strip())
            cur = p
        else:
            cur += ("\n\n" if cur else "") + p
    if cur.strip(): secs.append(cur.strip())
    return secs

async def ingest_document(t, data, meta=None, cfg=None, user_id=None):
    # Placeholder for extractText
    text = t # Assume t is text for now
    ex_meta = {"estimated_tokens": len(t) // 4, "content_type": "text/plain"}
    
    th = cfg.get("lg_thresh", 8000) if cfg else 8000
    sz = cfg.get("sec_sz", 3000) if cfg else 3000
    use_rc = (cfg.get("force_root") if cfg else False) or ex_meta["estimated_tokens"] > th
    
    if not use_rc:
        r = await add_hsg_memory(text, [], {**(meta or {}), **ex_meta, "ingestion_strategy": "single", "ingested_at": int(time.time()*1000)}, user_id)
        return {
            "root_memory_id": r["id"],
            "child_count": 0,
            "total_tokens": ex_meta["estimated_tokens"],
            "strategy": "single",
            "extraction": ex_meta
        }
        
    secs = split(text, sz)
    rid = str(uuid.uuid4())
    ts = int(time.time() * 1000)
    
    # Root creation
    sum_text = text[:500] + "..." if len(text) > 500 else text
    cnt = f"[Document: {ex_meta['content_type'].upper()}]\n\n{sum_text}\n\n[Full content split across {len(secs)} sections]"
    
    q.ins_mem.run(
        rid, user_id, 0, cnt, None, "reflective",
        json.dumps([]), json.dumps({**(meta or {}), **ex_meta, "is_root": True, "ingestion_strategy": "root-child", "ingested_at": ts}),
        ts, ts, ts, 1.0, 0.1, 1, 0, None, None, 0
    )
    
    cids = []
    for i, sec in enumerate(secs):
        cid = (await add_hsg_memory(sec, [], {**(meta or {}), "is_child": True, "section_index": i, "total_sections": len(secs), "parent_id": rid}, user_id))["id"]
        cids.append(cid)
        q.ins_waypoint.run(rid, cid, user_id, 1.0, ts, ts)
        
    return {
        "root_memory_id": rid,
        "child_count": len(secs),
        "total_tokens": ex_meta["estimated_tokens"],
        "strategy": "root-child",
        "extraction": ex_meta
    }
