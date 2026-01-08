import time
import math
import asyncio
import json
import re
import random
import numpy as np
import uuid
from typing import List, Dict, Any, Optional, Set, Tuple

from ..core.db import q, db, transaction
from ..core.config import env
from ..core.constants import SECTOR_CONFIGS
from ..core.vector_store import vector_store as store
from ..utils.text import canonical_token_set, canonical_tokens_from_text
from ..utils.chunking import chunk_text
from ..utils.keyword import keyword_filter_memories, compute_keyword_overlap
from ..utils.vectors import buf_to_vec, vec_to_buf, cos_sim
from .embed import embed_multi_sector, embed_for_sector, embed_multi_sector, calc_mean_vec
from .decay import inc_q, dec_q, on_query_hit, calc_recency_score as calc_recency_score_decay, pick_tier
from ..ops.dynamics import (
    calculateCrossSectorResonanceScore,
    applyRetrievalTraceReinforcementToMemory,
    applyRetrievalTraceReinforcementToMemory,
    propagateAssociativeReinforcementToLinkedNodes
)
from .user_summary import update_user_summary
SCORING_WEIGHTS = {
    "similarity": 0.35,
    "overlap": 0.20,
    "waypoint": 0.15,
    "recency": 0.10,
    "tag_match": 0.20,
}

HYBRID_PARAMS = {
    "tau": 3.0,
    "beta": 2.0,
    "eta": 0.1,
    "gamma": 0.2,
    "alpha_reinforce": 0.08,
    "t_days": 7.0,
    "t_max_days": 60.0,
    "tau_hours": 1.0,
    "epsilon": 1e-8,
}

REINFORCEMENT = {
    "salience_boost": 0.1,
    "waypoint_boost": 0.05,
    "max_salience": 1.0,
    "max_waypoint_weight": 1.0,
    "prune_threshold": 0.05,
}

SECTOR_RELATIONSHIPS = {
    "semantic": {"procedural": 0.8, "episodic": 0.6, "reflective": 0.7, "emotional": 0.4},
    "procedural": {"semantic": 0.8, "episodic": 0.6, "reflective": 0.6, "emotional": 0.3},
    "episodic": {"reflective": 0.8, "semantic": 0.6, "procedural": 0.6, "emotional": 0.7},
    "reflective": {"episodic": 0.8, "semantic": 0.7, "procedural": 0.6, "emotional": 0.6},
    "emotional": {"episodic": 0.7, "reflective": 0.6, "semantic": 0.4, "procedural": 0.3},
}

async def embed_query_for_all_sectors(query: str, sectors: List[str]) -> Dict[str, List[float]]:
    res = {}
    for s in sectors:
        res[s] = await embed_for_sector(query, s)
    return res

def has_temporal_markers(text: str) -> bool:
    pats = [
        r"\b(today|yesterday|tomorrow|this\s+week|last\s+week|this\s+morning)\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b20\d{2}[/-]?(0[1-9]|1[0-2])[/-]?(0[1-9]|[12]\d|3[01])\b",
        r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}",
        r"\bwhat\s+(did|have)\s+(i|we)\s+(do|done)\b",
    ]
    return any(re.search(p, text, re.I) for p in pats)

async def compute_tag_match_score(mid: str, q_toks: Set[str]) -> float:
    mem = q.get_mem(mid)
    if not mem or not mem["tags"]: return 0.0
    try:
        tags = json.loads(mem["tags"])
        if not isinstance(tags, list): return 0.0
        matches = 0
        for tag in tags:
            tl = str(tag).lower()
            if tl in q_toks: matches += 2
            else:
                for tok in q_toks:
                    if tl in tok or tok in tl: matches += 1
        return min(1.0, matches / max(1, len(tags) * 2))
    except:
        return 0.0

def compress_vec_for_storage(vec: List[float], target_dim: int) -> List[float]:
    if len(vec) <= target_dim: return vec
    comp = [0.0] * target_dim
    bucketsz = len(vec) / target_dim
    for i in range(target_dim):
        start = int(i * bucketsz)
        end = int((i + 1) * bucketsz)
        s = 0.0
        c = 0
        for j in range(start, min(end, len(vec))):
            s += vec[j]
            c += 1
        comp[i] = s / c if c > 0 else 0.0
    n = math.sqrt(sum(x*x for x in comp))
    if n > 0:
        for i in range(target_dim): comp[i] /= n
    return comp

def classify_content(content: str, metadata: Any = None) -> Dict[str, Any]:
    meta_sec = metadata.get("sector") if isinstance(metadata, dict) else None
    if meta_sec and meta_sec in SECTOR_CONFIGS:
        return {"primary": meta_sec, "additional": [], "confidence": 1.0}

    scores = {k: 0.0 for k in SECTOR_CONFIGS}
    for sec, cfg in SECTOR_CONFIGS.items():
        score = 0
        for pat in cfg["patterns"]:
            matches = pat.findall(content)
            if matches:
                score += len(matches) * cfg["weight"]
        scores[sec] = score

    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    primary, p_score = sorted_scores[0]
    thresh = max(1.0, p_score * 0.3)

    additional = [s for s, sc in sorted_scores[1:] if sc > 0 and sc >= thresh]

    second_score = sorted_scores[1][1] if len(sorted_scores) > 1 else 0
    confidence = min(1.0, p_score / (p_score + second_score + 1)) if p_score > 0 else 0.2

    return {
        "primary": primary if p_score > 0 else "semantic",
        "additional": additional,
        "confidence": confidence
    }

def calc_decay(sec: str, init_sal: float, days_since: float, seg_idx: Optional[int] = None, max_seg: Optional[int] = None) -> float:
    cfg = SECTOR_CONFIGS.get(sec)
    if not cfg: return init_sal
    lam = cfg["decay_lambda"]
    if seg_idx is not None and max_seg is not None and max_seg > 0:
        seg_ratio = math.sqrt(seg_idx / max_seg)
        lam = lam * (1.0 - seg_ratio)

    decayed = init_sal * math.exp(-lam * days_since)
    reinf = HYBRID_PARAMS["alpha_reinforce"] * (1 - math.exp(-lam * days_since))
    return max(0.0, min(1.0, decayed + reinf))

def calc_recency_score(last_seen: int) -> float:
    days = (time.time()*1000 - last_seen) / 86400000.0
    t = HYBRID_PARAMS["t_days"]
    tmax = HYBRID_PARAMS["t_max_days"]
    return math.exp(-days / t) * (1 - days / tmax)

def boosted_sim(s: float) -> float:
    return 1 - math.exp(-HYBRID_PARAMS["tau"] * s)

def compute_simhash(text: str) -> str:
    tokens = canonical_token_set(text)
    hashes = []
    for t in tokens:
        h = 0
        for c in t:
            h = (h << 5) - h + ord(c)
            h = h & 0xffffffff
        h = 0
        for c in t:
             val = (h << 5) - h + ord(c)
             val = val & 0xffffffff
             if val & 0x80000000: val = -((val ^ 0xffffffff) + 1)
             h = val
        hashes.append(h)

    vec = [0] * 64
    for h in hashes:
        for i in range(64):
            bit = 1 << (i % 32)
            if h & bit: vec[i] += 1
            else: vec[i] -= 1

    res_hash = ""
    for i in range(0, 64, 4):
        nibble = 0
        if vec[i] > 0: nibble += 8
        if vec[i+1] > 0: nibble += 4
        if vec[i+2] > 0: nibble += 2
        if vec[i+3] > 0: nibble += 1
        res_hash += format(nibble, 'x')
    return res_hash

def hamming_dist(h1: str, h2: str) -> int:
    dist = 0
    for i in range(len(h1)):
        x = int(h1[i], 16) ^ int(h2[i], 16)
        if x & 8: dist += 1
        if x & 4: dist += 1
        if x & 2: dist += 1
        if x & 1: dist += 1
    return dist

def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))

def extract_essence(raw: str, sec: str, max_len: int) -> str:
    if not env.use_summary_only or len(raw) <= max_len: return raw
    sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", raw) if len(s.strip()) > 10]
    if not sents: return raw[:max_len]

    scored = []
    for idx, s in enumerate(sents):
        sc = 0
        if idx == 0: sc += 10
        if idx == 1: sc += 5
        if re.match(r"^
        if re.match(r"^[A-Z][a-z]+:", s): sc += 6
        if re.search(r"\d{4}-\d{2}-\d{2}", s): sc += 7
        if re.search(r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+", s, re.I): sc += 5
        if re.search(r"\$\d+|\d+\s*(miles|dollars|years|months|km)", s): sc += 4
        if re.search(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+", s): sc += 3
        if re.search(r"\b(bought|purchased|serviced|visited|went|got|received|paid|earned|learned|discovered|found|saw|met|completed|finished|fixed|implemented|created|updated|added|removed|resolved)\b", s, re.I): sc += 4
        if re.search(r"\b(who|what|when|where|why|how)\b", s, re.I): sc += 2
        if len(s) < 80: sc += 2
        if re.search(r"\b(I|my|me)\b", s): sc += 1
        scored.append({"text": s, "score": sc, "idx": idx})

    scored.sort(key=lambda x: x["score"], reverse=True)

    selected = []
    curr_len = 0
    first = next((x for x in scored if x["idx"] == 0), None)
    if first and len(first["text"]) < max_len:
        selected.append(first)
        curr_len += len(first["text"])

    for item in scored:
        if item["idx"] == 0: continue
        if curr_len + len(item["text"]) + 2 <= max_len:
            selected.append(item)
            curr_len += len(item["text"]) + 2

    selected.sort(key=lambda x: x["idx"])
    return " ".join(x["text"] for x in selected)

def compute_token_overlap(q_toks: Set[str], mem_toks: Set[str]) -> float:
    if not q_toks: return 0.0
    ov = len(q_toks.intersection(mem_toks))
    return ov / len(q_toks)

def compute_hybrid_score(sim: float, tok_ov: float, wp_wt: float, rec_sc: float, kw_score: float = 0, tag_match: float = 0) -> float:
    s_p = boosted_sim(sim)
    raw = (SCORING_WEIGHTS["similarity"] * s_p +
           SCORING_WEIGHTS["overlap"] * tok_ov +
           SCORING_WEIGHTS["waypoint"] * wp_wt +
           SCORING_WEIGHTS["recency"] * rec_sc +
           SCORING_WEIGHTS["tag_match"] * tag_match +
           kw_score)
    return sigmoid(raw)

async def create_single_waypoint(new_id: str, new_mean: List[float], ts: int, user_id: str = "anonymous"):
    mems = q.all_mem_by_user(user_id, 1000, 0) if user_id else q.all_mem(1000, 0)
    best = None
    best_sim = -1.0

    import numpy as np
    nm = np.array(new_mean, dtype=np.float32)

    for mem in mems:
        if mem["id"] == new_id or not mem["mean_vec"]: continue
        ex_mean = np.array(buf_to_vec(mem["mean_vec"]), dtype=np.float32)
        sim = cos_sim(nm, ex_mean)
        if sim > best_sim:
            best_sim = sim
            best = mem["id"]

    if best:
        db.execute("INSERT OR REPLACE INTO waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)", (new_id, best, user_id, float(best_sim), ts, ts))
    else:
        db.execute("INSERT OR REPLACE INTO waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)", (new_id, new_id, user_id, 1.0, ts, ts))
    db.commit()

async def create_cross_sector_waypoints(prim_id: str, prim_sec: str, add_secs: List[str], user_id: Optional[str] = None):
    now = int(time.time() * 1000)
    wt = 0.5
    for sec in add_secs:
        uid = user_id or "anonymous"
        db.execute("INSERT OR REPLACE INTO waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                   (prim_id, f"{prim_id}:{sec}", uid, wt, now, now))
        db.execute("INSERT OR REPLACE INTO waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                   (f"{prim_id}:{sec}", prim_id, uid, wt, now, now))
    db.commit()

async def create_inter_mem_waypoints(new_id: str, prim_sec: str, new_vec: List[float], ts: int, user_id: Optional[str] = None):
    thresh = 0.75
    wt = 0.5
    vecs = await store.getVectorsBySector(prim_sec)

    nm = np.array(new_vec, dtype=np.float32)

    for vr in vecs:
        if vr["id"] == new_id: continue
        ex_vec = np.array(vr["vector"], dtype=np.float32)
        sim = cos_sim(nm, ex_vec)

        if sim >= thresh:
            uid = user_id or "anonymous"
            db.execute("INSERT OR REPLACE INTO waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                       (new_id, vr["id"], uid, wt, ts, ts))
            db.execute("INSERT OR REPLACE INTO waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                       (vr["id"], new_id, uid, wt, ts, ts))
    db.commit()

async def create_contextual_waypoints(mem_id: str, rel_ids: List[str], base_wt: float = 0.3, user_id: Optional[str] = None):
    now = int(time.time() * 1000)
    uid = user_id or "anonymous"

    for rel_id in rel_ids:
        if mem_id == rel_id: continue
        existing = db.fetchone("SELECT * FROM waypoints WHERE src_id=? AND dst_id=?", (mem_id, rel_id))

        if existing:
            new_wt = min(1.0, float(existing["weight"]) + 0.1)
            db.execute("UPDATE waypoints SET weight=?, updated_at=? WHERE src_id=? AND dst_id=?", (new_wt, now, mem_id, rel_id))
        else:
            db.execute("INSERT INTO waypoints(src_id,dst_id,user_id,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                       (mem_id, rel_id, uid, base_wt, now, now))
    db.commit()

async def reinforce_waypoints(trav_path: List[str]):
    now = int(time.time() * 1000)
    for i in range(len(trav_path) - 1):
        src_id = trav_path[i]
        dst_id = trav_path[i+1]

        wp = db.fetchone("SELECT * FROM waypoints WHERE src_id=? AND dst_id=?", (src_id, dst_id))
        if wp:
            new_wt = min(REINFORCEMENT["max_waypoint_weight"], float(wp["weight"]) + REINFORCEMENT["waypoint_boost"])
            db.execute("UPDATE waypoints SET weight=?, updated_at=? WHERE src_id=? AND dst_id=?", (new_wt, now, src_id, dst_id))

    db.commit()

async def prune_weak_waypoints() -> int:
    thresh = REINFORCEMENT["prune_threshold"]
    db.execute("DELETE FROM waypoints WHERE weight < ?", (thresh,))
    db.commit()
    return 0

async def calc_multi_vec_fusion_score(mid: str, qe: Dict[str, List[float]], w: Dict[str, float]) -> float:
    vecs = await store.getVectorsById(mid)
    s = 0.0
    tot = 0.0

    wm = {
         "semantic": w.get("semantic_dimension_weight", 0),
         "emotional": w.get("emotional_dimension_weight", 0),
         "procedural": w.get("procedural_dimension_weight", 0),
         "episodic": w.get("temporal_dimension_weight", 0),
         "reflective": w.get("reflective_dimension_weight", 0),
    }

    for v in vecs:
        qv = qe.get(v.sector)
        if not qv: continue
        sim = cos_sim(v.vector, qv)
        wgt = wm.get(v.sector, 0.5)
        s += sim * wgt
        tot += wgt

    return s / tot if tot > 0 else 0.0

async def add_hsg_memory(content: str, tags: Optional[str] = None, metadata: Any = None, user_id: Optional[str] = None) -> Dict[str, Any]:
    simhash = compute_simhash(content)
    existing = db.fetchone("SELECT * FROM memories WHERE simhash=? ORDER BY salience DESC LIMIT 1", (simhash,))

    if existing and hamming_dist(simhash, existing["simhash"]) <= 3:
        now = int(time.time()*1000)
        boost = min(1.0, (existing["salience"] or 0) + 0.15)
        db.execute("UPDATE memories SET last_seen_at=?, salience=?, updated_at=? WHERE id=?", (now, boost, now, existing["id"]))
        db.commit()
        return {
            "id": existing["id"],
            "primary_sector": existing["primary_sector"],
            "sectors": [existing["primary_sector"]],
            "deduplicated": True
        }

    mid = str(uuid.uuid4())
    now = int(time.time()*1000)
    if user_id:
        u = db.fetchone("SELECT * FROM users WHERE user_id=?", (user_id,))
        if not u:
            db.execute("INSERT OR IGNORE INTO users(user_id,summary,reflection_count,created_at,updated_at) VALUES (?,?,?,?,?)",
                       (user_id, "User profile initializing...", 0, now, now))
            db.commit()

    chunks = chunk_text(content)
    use_chunks = len(chunks) > 1
    cls = classify_content(content, metadata)
    all_secs = [cls["primary"]] + cls["additional"]
    try:
        max_seg_res = db.fetchone("SELECT coalesce(max(segment), 0) as max_seg FROM memories")

        max_seg_res = db.fetchone("SELECT coalesce(max(segment), 0) as max_seg FROM memories")
        cur_seg = max_seg_res["max_seg"]
        cnt_res = db.fetchone("SELECT count(*) as c FROM memories WHERE segment=?", (cur_seg,))
        if cnt_res["c"] >= env.seg_size:
            cur_seg += 1
            print(f"[HSG] Rotated to segment {cur_seg}")

        stored = extract_essence(content, cls["primary"], env.summary_max_length)
        sec_cfg = SECTOR_CONFIGS[cls["primary"]]
        init_sal = max(0.0, min(1.0, 0.4 + 0.1 * len(cls["additional"])))
        q.ins_mem(
            id=mid,
            user_id=user_id or "anonymous",
            segment=cur_seg,
            content=stored,
            simhash=simhash,
            primary_sector=cls["primary"],
            tags=tags,
            meta=json.dumps(metadata or {}),
            created_at=now,
            updated_at=now,
            last_seen_at=now,
            salience=init_sal,
            decay_lambda=sec_cfg["decay_lambda"],
            version=1,
            mean_dim=None,
            mean_vec=None,
            compressed_vec=None,
            feedback_score=0
        )
        emb_res = await embed_multi_sector(mid, content, all_secs, chunks if use_chunks else None)
        for r in emb_res:
             await store.storeVector(mid, r["sector"], r["vector"], r["dim"], user_id or "anonymous")

        mean_vec = calc_mean_vec(emb_res, all_secs)
        mean_buf = vec_to_buf(mean_vec)
        db.execute("UPDATE memories SET mean_dim=?, mean_vec=? WHERE id=?", (len(mean_vec), mean_buf, mid))

        if len(mean_vec) > 128:
            comp = compress_vec_for_storage(mean_vec, 128)
            db.execute("UPDATE memories SET compressed_vec=? WHERE id=?", (vec_to_buf(comp), mid))

        await create_single_waypoint(mid, mean_vec, now, user_id)
        if user_id:
            await update_user_summary(user_id)
        return {
            "id": mid,
            "content": content,
            "primary_sector": cls["primary"],
            "sectors": all_secs,
            "chunks": len(chunks),
            "salience": init_sal
        }
    except Exception as e:
        raise e
cache = {}
TTL = 60000

async def expand_via_waypoints(ids: List[str], max_exp: int = 10):
    exp = []
    vis = set(ids)
    q_arr = [{"id": i, "weight": 1.0, "path": [i]} for i in ids]
    cnt = 0

    while q_arr and cnt < max_exp:
        cur = q_arr.pop(0)
        neighs = db.fetchall("SELECT dst_id, weight FROM waypoints WHERE src_id=? ORDER BY weight DESC", (cur["id"],))
        for n in neighs:
            dst = n["dst_id"]
            if dst in vis: continue
            wt = min(1.0, max(0.0, float(n["weight"])))
            exp_wt = cur["weight"] * wt * 0.8
            if exp_wt < 0.1: continue

            item = {"id": dst, "weight": exp_wt, "path": cur["path"] + [dst]}
            exp.append(item)
            vis.add(dst)
            q_arr.append(item)
            cnt += 1
    return exp

async def hsg_query(qt: str, k: int = 10, f: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    start_q = time.time()
    inc_q()
    try:
        cache_key = f"{qt}:{k}:{json.dumps(f)}"
        if cache_key in cache:
            entry = cache[cache_key]
            if time.time()*1000 - entry["t"] < TTL: return entry["r"]

        qc = classify_content(qt)
        qtk = canonical_token_set(qt)

        ss = f.get("sectors") or list(SECTOR_CONFIGS.keys())
        if not ss: ss = ["semantic"]

        qe = await embed_query_for_all_sectors(qt, ss)

        w = {
            "semantic_dimension_weight": 1.2 if qc["primary"] == "semantic" else 0.8,
            "emotional_dimension_weight": 1.5 if qc["primary"] == "emotional" else 0.6,
            "procedural_dimension_weight": 1.3 if qc["primary"] == "procedural" else 0.7,
            "temporal_dimension_weight": 1.4 if qc["primary"] == "episodic" else 0.7,
            "reflective_dimension_weight": 1.1 if qc["primary"] == "reflective" else 0.5,
        }
        sr = {}
        for s in ss:
            qv = qe[s]
            res = await store.search(qv, s, k*3, {"user_id": f.get("user_id")})
            sr[s] = res

        all_sims = []
        ids = set()
        for s, res in sr.items():
            for r in res:
                all_sims.append(r["similarity"])
                ids.add(r["id"])

        avg_top = sum(all_sims)/len(all_sims) if all_sims else 0
        adapt_exp = math.ceil(0.3 * k * (1 - avg_top))
        eff_k = k + adapt_exp
        high_conf = avg_top >= 0.55

        exp = []
        if not high_conf:
            exp = await expand_via_waypoints(list(ids), k*2)
            for e in exp: ids.add(e["id"])

        res_list = []
        kw_scores = {}
        for mid in ids:
            mem = q.get_mem(mid)
            if mem:
                overlap = compute_keyword_overlap(qt, mem["content"])
                kw_scores[mid] = overlap * 0.15

        for mid in ids:
            m = q.get_mem(mid)
            if not m: continue
            if f and f.get("minSalience") and m["salience"] < f["minSalience"]: continue
            if f and f.get("user_id") and m["user_id"] != f["user_id"]: continue

            mvf = await calc_multi_vec_fusion_score(mid, qe, w)
            csr = await calculateCrossSectorResonanceScore(m["primary_sector"], qc["primary"], mvf)

            best_sim = csr
            for s, rlist in sr.items():
                 for r in rlist:
                     if r["id"] == mid and r["similarity"] > best_sim: best_sim = r["similarity"]
            mem_sec = m["primary_sector"]
            q_sec = qc["primary"]
            penalty = 1.0
            if mem_sec != q_sec:
                penalty = SECTOR_RELATIONSHIPS.get(q_sec, {}).get(mem_sec, 0.3)

            adj = best_sim * penalty

            em = next((e for e in exp if e["id"] == mid), None)
            ww = min(1.0, max(0.0, em["weight"] if em else 0.0))

            days = (time.time()*1000 - m["last_seen_at"]) / 86400000.0
            sal = calc_decay(m["primary_sector"], m["salience"], days)
            mtk = canonical_token_set(m["content"])
            tok_ov = compute_token_overlap(qtk, mtk)
            rec_sc = calc_recency_score_decay(m["last_seen_at"])
            tag_Match = await compute_tag_match_score(mid, qtk)

            fs = compute_hybrid_score(adj, tok_ov, ww, rec_sc, kw_scores.get(mid, 0), tag_Match)

            item = {
                "id": mid,
                "content": m["content"],
                "score": fs,
                "primary_sector": m["primary_sector"],
                "path": em["path"] if em else [mid],
                "salience": sal,
                "salience": sal,
                "last_seen_at": m["last_seen_at"],
                "tags": json.loads(m["tags"] or "[]"),
                "metadata": json.loads(m["meta"] or "{}")
            }

            if f and f.get("debug"):
                item["_debug"] = {
                    "sim_adj": adj,
                    "tok_ov": tok_ov,
                    "recency": rec_sc,
                    "waypoint": ww,
                    "tag": tag_Match,
                    "penalty": penalty
                }

            res_list.append(item)

        res_list.sort(key=lambda x: x["score"], reverse=True)
        top = res_list[:k]
        for r in top:
             rsal = await applyRetrievalTraceReinforcementToMemory(r["id"], r["salience"])
             now = int(time.time()*1000)
             db.execute("UPDATE memories SET salience=?, last_seen_at=? WHERE id=?", (rsal, now, r["id"]))
             if len(r["path"]) > 1:
                 wps_rows = db.fetchall("SELECT dst_id, weight FROM waypoints WHERE src_id=?", (r["id"],))
                 wps = [{"target_id": row["dst_id"], "weight": row["weight"]} for row in wps_rows]

                 pru = await propagateAssociativeReinforcementToLinkedNodes(r["id"], rsal, wps)
                 for u in pru:
                     linked_mem = q.get_mem(u["node_id"])
                     if linked_mem:
                         time_diff = (now - linked_mem["last_seen_at"]) / 86400000.0
                         decay_fact = math.exp(-0.02 * time_diff)
                         ctx_boost = HYBRID_PARAMS["gamma"] * (rsal - (linked_mem["salience"] or 0)) * decay_fact
                         new_sal = max(0.0, min(1.0, (linked_mem["salience"] or 0) + ctx_boost))
                         db.execute("UPDATE memories SET salience=?, last_seen_at=? WHERE id=?", (new_sal, now, u["node_id"]))

             await on_query_hit(r["id"], r["primary_sector"], lambda t: embed_for_sector(t, r["primary_sector"]))

        cache[cache_key] = {"r": top, "t": time.time()*1000}
        return top

    finally:
        dec_q()
