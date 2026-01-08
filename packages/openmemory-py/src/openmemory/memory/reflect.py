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

logger = logging.getLogger("reflect")

def vec_tf(txt: str) -> List[int]:
    w = txt.lower().split()
    uniq = sorted(list(set(w)))
    return [w.count(u) for u in uniq]

def sim_txt(t1: str, t2: str) -> float:
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
        if m.get("meta") and "consolidated" in str(m["meta"]): continue

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
