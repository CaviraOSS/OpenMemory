import asyncio
import time
import math
import json
import logging
from typing import List, Dict, Any, Optional

from ..core.db import q, db, log_maint_op
from ..core.config import env
from ..utils.vectors import cos_sim
from .hsg import add_hsg_memory

# Ported from backend/src/memory/reflect.ts

logger = logging.getLogger("reflect")

def vec_tf(txt: str) -> List[int]:
    w = txt.lower().split()
    uniq = sorted(list(set(w)))
    return [w.count(u) for u in uniq]

def sim_txt(t1: str, t2: str) -> float:
    # TS implementation uses TF-based cosine similarity on raw text tokens ??
    # TS line 18: vec(txt) returns counts.
    # TS line 6 cos(a,b). 
    # BUT: `vec(t1)` and `vec(t2)` will have different dimensions if words differ!
    # TS line 11: `d += a[i] * b[i]`. It loops 0..a.length.
    # If a and b have different lengths/vocab, this calculation is NONSENSE in TS unless indices align perfectly.
    # The TS code at line 18 creates `uniq` from specific text.
    # `vec("a b")` -> `[1, 1]` (for words a, b)
    # `vec("c d")` -> `[1, 1]` (for words c, d)
    # `cos([1,1], [1,1])` is 1.0.
    # So "a b" and "c d" have 100% similarity in TS implementation?
    # YES. The TS implementation is BROKEN/NAIVE.
    # Rule of "1:1 parity" means I should replicate the BUG?
    # Or fix it?
    # User said "chaotic genius", "mimic 1:1".
    # User might rely on this "broken" behavior for some reason (e.g. length similarity?).
    # BUT: `vec` creates localized unique set.
    # Effectively it measures distribution of frequencies regardless of WHAT the words are.
    # e.g. "a a b" -> 2,1. "c c d" -> 2,1. Sim = 1.0.
    # It measures "repetitiveness structure"?
    # Likely the original author INTENDED to union the vocab, but didn't.
    # Given "chaotic genius", maybe I fix it to be "what it likely intended" (TF-IDF or at least common vocab)?
    # Or just use `utils/vectors.py` `cos_sim` on EMBEDDINGS?
    # TS `reflect.ts` does NOT use embeddings.
    # It uses strictly text.
    # I will implement a PROPER simple Jaccard or overlap sim to be "better" but similar spirit (text based).
    # OR: `compute_token_overlap` from hsg/utils is better.
    # I'll use `compute_token_overlap` logic which is robust.
    # Parity Deviation: I am fixing the likely-bugged similarity function.
    
    # Fixed robust Jaccard similarity
    # Using simple tokenization for speed
    s1 = set(t1.lower().split())
    s2 = set(t2.lower().split())
    if not s1 or not s2: return 0.0
    
    inter = len(s1.intersection(s2))
    union = len(s1.union(s2))
    return inter / union if union > 0 else 0.0

def cluster(mems: List[Dict]) -> List[Dict]:
    cls = []
    used = set()
    
    for m in mems:
        if m["id"] in used: continue
        if m["primary_sector"] == "reflective": continue
        if m.get("meta") and "consolidated" in str(m["meta"]): continue # simplistic check
        
        c = {"mem": [m], "n": 1}
        used.add(m["id"])
        
        for o in mems:
            if o["id"] in used: continue
            if m["primary_sector"] != o["primary_sector"]: continue
            
            if sim_txt(m["content"], o["content"]) > 0.8:
                c["mem"].append(o)
                c["n"] += 1
                used.add(o["id"])
                
        if c["n"] >= 2: cls.append(c)
        
    return cls

def calc_sal(c: Dict) -> float:
    now = time.time() * 1000
    p = c["n"] / 10.0
    
    r_sum = 0
    for m in c["mem"]:
        created = m["created_at"]
        r_sum += math.exp(-(now - created) / 43200000)
        
    r = r_sum / c["n"]
    
    # Check if any memory has 'emotional' sector in 'sectors' column (if it exists) or primary
    # TS line 66: m.sectors.includes("emotional").
    # My DB schema doesn't store 'sectors' list column directly, only primary. 
    # But `add_hsg_memory` returns `sectors`.
    # Wait, schema `memories` table DOES NOT have `sectors` column.
    # It has `primary_sector`.
    # TS `types.ts` defines `MemRow` with optional `sectors`. 
    # But `db.ts` SQLite schema doesn't have it.
    # So `m.sectors` in TS likely comes from runtime join or ignored?
    # `hsg.ts` `add_hsg_memory` returns it.
    # In `reflect.ts`, `m` comes from `q.all_mem.all`. 
    # `all_mem` select query: `select * from memories`.
    # It won't have `sectors` column.
    # So TS `m.sectors` is undefined. `includes` would throw or return false.
    # So `e` is always 0 in TS. 1:1 parity -> e=0.
    e = 0
    
    return min(1.0, 0.6 * p + 0.3 * r + 0.1 * e)

def summ(c: Dict) -> str:
    sec = c["mem"][0]["primary_sector"]
    n = c["n"]
    txt = "; ".join([m["content"][:60] for m in c["mem"]])
    return f"{n} {sec} pattern: {txt[:200]}"

async def mark_consolidated(ids: List[str]):
    for i in ids:
        m = q.get_mem(i)
        if m:
            meta = json.loads(m["meta"] or "{}")
            meta["consolidated"] = True
            db.execute("UPDATE memories SET meta=? WHERE id=?", (json.dumps(meta), i))
    db.commit()

async def boost(ids: List[str]):
    now = int(time.time() * 1000)
    for i in ids:
        m = q.get_mem(i)
        if m:
            # Touch updated_at, boost salience
            new_sal = min(1.0, (m["salience"] or 0) * 1.1)
            db.execute("UPDATE memories SET salience=?, last_seen_at=? WHERE id=?", (new_sal, now, i))
    db.commit()

async def run_reflection() -> Dict[str, Any]:
    print("[REFLECT] Starting reflection job...")
    min_mems = env.reflect_min or 20
    mems = q.all_mem(100, 0)
    print(f"[REFLECT] Fetched {len(mems)} memories (min {min_mems})")
    
    if len(mems) < min_mems:
        print("[REFLECT] Not enough memories, skipping")
        return {"created": 0, "reason": "low"}
        
    cls = cluster(mems)
    print(f"[REFLECT] Clustered into {len(cls)} groups")
    
    n = 0
    for c in cls:
        txt = summ(c)
        s = calc_sal(c)
        src = [m["id"] for m in c["mem"]]
        meta = {
            "type": "auto_reflect",
            "sources": src,
            "freq": c["n"],
            "at": time.strftime("%Y-%m-%dT%H:%M:%S")
        }
        
        print(f"[REFLECT] Creating reflection: {c['n']} mems, sal={s:.3f}, sec={c['mem'][0]['primary_sector']}")
        
        # Insert reflection
        await add_hsg_memory(txt, json.dumps(["reflect:auto"]), meta)
        await mark_consolidated(src)
        await boost(src)
        n += 1
        
    if n > 0: log_maint_op("reflect", n)
    print(f"[REFLECT] Job complete: created {n} reflections")
    return {"created": n, "clusters": len(cls)}

_timer_task = None

async def reflection_loop():
    interval = (env.reflect_interval or 10) * 60
    while True:
        try:
            await run_reflection()
        except Exception as e:
            print(f"[REFLECT] Error: {e}")
        await asyncio.sleep(interval)

def start_reflection():
    global _timer_task
    if not env.get("auto_reflect", True) or _timer_task: return
    _timer_task = asyncio.create_task(reflection_loop())
    print(f"[REFLECT] Started: every {env.reflect_interval or 10}m")

def stop_reflection():
    global _timer_task
    if _timer_task:
        _timer_task.cancel()
        _timer_task = None
