import math
import re
from typing import List, Dict, TypedDict

class Chunk(TypedDict):
    text: str
    start: int
    end: int
    tokens: int

CPT = 4
def est(t: str) -> int:
    return math.ceil(len(t) / CPT)

def chunk_text(txt: str, tgt: int = 768, ovr: float = 0.1) -> List[Chunk]:
    tot = est(txt)
    if tot <= tgt:
        return [{"text": txt, "start": 0, "end": len(txt), "tokens": tot}]

    tch = tgt * CPT
    och = math.floor(tch * ovr)
    paras = re.split(r"\n\n+", txt)

    chks: List[Chunk] = []
    cur = ""
    cs = 0

    for p in paras:
        sents = re.split(r"(?<=[.!?])\s+", p)
        for s in sents:
            pot = cur + (" " if cur else "") + s
            if len(pot) > tch and len(cur) > 0:
                chks.append({
                    "text": cur,
                    "start": cs,
                    "end": cs + len(cur),
                    "tokens": est(cur)
                })
                ovt = cur[-och:] if och < len(cur) else cur
                cur = ovt + " " + s
                cs = cs + len(cur) - len(ovt) - 1
            else:
                cur = pot

    if len(cur) > 0:
        chks.append({
            "text": cur,
            "start": cs,
            "end": cs + len(cur),
            "tokens": est(cur)
        })
    return chks

def agg_vec(vecs: List[List[float]]) -> List[float]:
    n = len(vecs)
    if not n: raise ValueError("no vecs")
    if n == 1: return vecs[0].copy()

    d = len(vecs[0])
    r = [0.0] * d
    for v in vecs:
        for i in range(d):
            r[i] += v[i]

    rc = 1.0 / n
    for i in range(d):
        r[i] *= rc
    return r

def join_chunks(cks: List[Chunk]) -> str:
    return " ".join(c["text"] for c in cks) if cks else ""
