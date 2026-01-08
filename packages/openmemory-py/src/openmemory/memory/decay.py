import asyncio
import time
import math
import random
import json
from typing import List, Dict, Any, Optional

from ..core.db import q, db
from ..core.config import env
from ..core.vector_store import vector_store as store
from ..utils.vectors import buf_to_vec, vec_to_buf, cos_sim
from ..utils.text import canonical_tokens_from_text

class DecayCfg:
    def __init__(self):
        self.threads = int(env.decay_threads or 3)
        self.cold_threshold = float(env.decay_cold_threshold or 0.25)
        self.reinforce_on_query = True
        self.regeneration_enabled = True
        self.max_vec_dim = int(env.max_vector_dim or 1536)
        self.min_vec_dim = int(env.min_vector_dim or 64)
        self.summary_layers = min(3, max(1, int(env.summary_layers or 3)))
        self.lambda_hot = 0.005
        self.lambda_warm = 0.02
        self.lambda_cold = 0.05
        self.time_unit_ms = 86_400_000

cfg = DecayCfg()

active_q = 0
last_decay = 0
COOLDOWN = 60000

def inc_q():
    global active_q
    active_q += 1

def dec_q():
    global active_q
    active_q = max(0, active_q - 1)

def pick_tier(m: Dict, now_ts: int) -> str:
    dt = max(0, now_ts - (m["last_seen_at"] or m["updated_at"] or now_ts))
    recent = dt < 6 * 86_400_000
    high = (m.get("coactivations") or 0) > 5 or (m["salience"] or 0) > 0.7
    if recent and high: return "hot"
    if recent or (m["salience"] or 0) > 0.4: return "warm"
    return "cold"

def mean(arr: List[float]) -> float:
    return sum(arr) / len(arr) if arr else 0

def normalize(v: List[float]):
    n = math.sqrt(sum(x*x for x in v))
    if n > 0:
        for i in range(len(v)): v[i] /= n

def compress_vector(vec: List[float], f: float, min_dim=64, max_dim=1536) -> List[float]:
    src = vec if vec else [1.0]
    tgt_dim = max(min_dim, min(max_dim, math.floor(len(src) * max(0.0, min(1.0, f)))))
    dim = max(min_dim, min(len(src), tgt_dim))

    if dim >= len(src): return list(src)

    pooled = []
    bucket = math.ceil(len(src) / dim)
    for i in range(0, len(src), bucket):
        sub = src[i : i+bucket]
        pooled.append(mean(sub))

    normalize(pooled)
    return pooled

def hash_to_vec(s: str, d=32) -> List[float]:
    h = 2166136261
    for c in s:
        h ^= ord(c)
        h = (h * 16777619) & 0xffffffff

    out = [0.0] * max(2, d)
    x = h or 1
    for i in range(len(out)):
        x ^= (x << 13) & 0xffffffff
        x ^= (x >> 17) & 0xffffffff
        x ^= (x << 5) & 0xffffffff
        out[i] = ((x / 0xffffffff) * 2 - 1)

    normalize(out)
    return out

def top_keywords(t: str, k=5) -> List[str]:
    words = canonical_tokens_from_text(t)
    freq = {}
    for w in words: freq[w] = freq.get(w, 0) + 1
    items = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [x[0] for x in items[:k]]

def fingerprint_mem(m: Dict) -> Dict[str, Any]:
    base = f"{m['id']}|{m.get('summary') or m['content'] or ''}".strip()
    vec = hash_to_vec(base, 32)
    summary = " ".join(top_keywords(m.get('summary') or m['content'] or "", 3))
    return {"vector": vec, "summary": summary}

def calc_recency_score(last_seen: int) -> float:
    now = int(time.time() * 1000)
    dt = max(0, now - last_seen)
    hours = dt / 3600000.0
    return math.exp(-0.05 * hours)


async def apply_decay():
    global last_decay
    if active_q > 0:
        print(f"[decay] skipped - {active_q} active queries")
        return

    now_ts = int(time.time() * 1000)
    if now_ts - last_decay < COOLDOWN:
        rem = (COOLDOWN - (now_ts - last_decay)) / 1000
        print(f"[decay] skipped - cooldown active ({rem:.0f}s left)")
        return

    last_decay = now_ts
    t0 = time.time()
    segments_rows = db.fetchall("SELECT DISTINCT segment FROM memories ORDER BY segment DESC")
    segments = [r["segment"] for r in segments_rows]

    tot_proc = 0
    tot_chg = 0
    tot_comp = 0
    tot_fp = 0
    tier_counts = {"hot": 0, "warm": 0, "cold": 0}

    for seg in segments:
        rows = db.fetchall("SELECT id,content,summary,salience,decay_lambda,last_seen_at,updated_at,primary_sector,feedback_score as coactivations FROM memories WHERE segment=?", (seg,))

        decay_ratio = env.decay_ratio or 0.03
        batch_sz = max(1, int(len(rows) * decay_ratio))
        if not rows: continue

        start_idx = random.randint(0, max(0, len(rows) - batch_sz))
        batch = rows[start_idx : start_idx + batch_sz]

        for m in batch:
            dict_m = dict(m)
            m_tier = pick_tier(dict_m, now_ts)
            tier_counts[m_tier] += 1

            lam = cfg.lambda_hot if m_tier == "hot" else (cfg.lambda_warm if m_tier == "warm" else cfg.lambda_cold)
            dt = max(0, (now_ts - (dict_m["last_seen_at"] or dict_m["updated_at"] or 0)) / cfg.time_unit_ms)
            act = max(0, dict_m.get("coactivations") or dict_m.get("feedback_score") or 0)
            sal = max(0.0, min(1.0, (dict_m["salience"] or 0.5) * (1 + math.log1p(act))))

            f = math.exp(-lam * (dt / (sal + 0.1)))
            new_sal = max(0.0, min(1.0, sal * f))
            changed = abs(new_sal - (dict_m["salience"] or 0)) > 0.001
            if f < 0.7:
                sector = dict_m["primary_sector"] or "semantic"
                vec_row = await store.getVector(dict_m["id"], sector)
                if vec_row and vec_row.vector:
                    vec = vec_row.vector
                    if len(vec) > 0:
                         new_vec = compress_vector(vec, f, cfg.min_vec_dim, cfg.max_vec_dim)

                         if len(new_vec) < len(vec):
                             await store.storeVector(dict_m["id"], sector, new_vec, len(new_vec))
                             tot_comp += 1
                             changed = True
            if f < max(0.3, cfg.cold_threshold):
                sector = dict_m["primary_sector"] or "semantic"
                fp = fingerprint_mem(dict_m)
                await store.storeVector(dict_m["id"], sector, fp["vector"], len(fp["vector"]))
                db.conn.execute("UPDATE memories SET summary=? WHERE id=?", (fp["summary"], dict_m["id"]))
                tot_fp += 1
                changed = True

            if changed:
                db.conn.execute("UPDATE memories SET salience=?, updated_at=? WHERE id=?", (new_sal, int(time.time()*1000), dict_m["id"]))
                tot_chg += 1

            tot_proc += 1
            await asyncio.sleep(0)

    db.commit()
    dur = (time.time() - t0) * 1000
    print(f"[decay] {tot_chg}/{tot_proc} | tiers: {tier_counts} | comp={tot_comp} fp={tot_fp} | {dur:.1f}ms")

async def on_query_hit(mem_id: str, sector: str, reembed_fn = None):
    if not cfg.regeneration_enabled and not cfg.reinforce_on_query: return

    m = q.get_mem(mem_id)
    if not m: return

    updated = False
    if cfg.regeneration_enabled and reembed_fn:
        vec_row = await store.getVector(mem_id, sector)
        if vec_row and vec_row.vector and len(vec_row.vector) <= 64:
             try:
                 base = m["summary"] or m["content"] or ""
                 new_vec = await reembed_fn(base)
                 await store.storeVector(mem_id, sector, new_vec, len(new_vec))
                 updated = True
             except Exception:
                 pass
    if cfg.reinforce_on_query:
        new_sal = min(1.0, (m["salience"] or 0.5) + 0.15)
        new_sal = min(1.0, (m["salience"] or 0.5) + 0.5)

        db.conn.execute("UPDATE memories SET salience=?, last_seen_at=? WHERE id=?", (new_sal, int(time.time()*1000), mem_id))
        db.commit()
        updated = True

    if updated:
        pass
