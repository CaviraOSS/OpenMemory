import re
import hashlib
from typing import List, Set, Dict

SYN_GRPS = [
    ["prefer", "like", "love", "enjoy", "favor"],
    ["theme", "mode", "style", "layout"],
    ["meeting", "meet", "session", "call", "sync"],
    ["dark", "night", "black"],
    ["light", "bright", "day"],
    ["user", "person", "people", "customer"],
    ["task", "todo", "job"],
    ["note", "memo", "reminder"],
    ["time", "schedule", "when", "date"],
    ["project", "initiative", "plan"],
    ["issue", "problem", "bug"],
    ["document", "doc", "file"],
    ["question", "query", "ask"],
]

CMAP: Dict[str, str] = {}
SLOOK: Dict[str, Set[str]] = {}

for grp in SYN_GRPS:
    can = grp[0]
    sset = set(grp)
    for w in grp:
        CMAP[w] = can
        SLOOK[can] = sset

STEM_RULES = [
    (r"ies$", "y"),
    (r"ing$", ""),
    (r"ers?$", "er"),
    (r"ed$", ""),
    (r"s$", ""),
]

CJK_PAT = r"\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af"
TOK_PAT = re.compile(rf"[a-z0-9]+|[{CJK_PAT}]+", re.I)


def _expand_cjk_token(tok: str) -> List[str]:
    if len(tok) <= 1:
        return [tok]
    return [tok[i : i + 2] for i in range(len(tok) - 1)]

def tokenize(text: str) -> List[str]:
    res: List[str] = []
    for tok in TOK_PAT.findall(text):
        low = tok.lower()
        if re.fullmatch(rf"[{CJK_PAT}]+", tok):
            res.extend(_expand_cjk_token(tok))
        else:
            res.append(low)
    return res

def stem(tok: str) -> str:
    if len(tok) <= 3: return tok
    for pat, rep in STEM_RULES:
        if re.search(pat, tok):
            st = re.sub(pat, rep, tok)
            if len(st) >= 3: return st
    return tok

def canonicalize_token(tok: str) -> str:
    if not tok: return ""
    low = tok.lower()
    if low in CMAP: return CMAP[low]
    st = stem(low)
    return CMAP.get(st, st)

def canonical_tokens_from_text(text: str) -> List[str]:
    res = []
    for tok in tokenize(text):
        can = canonicalize_token(tok)
        if can and len(can) > 1:
            res.append(can)
    return res

def synonyms_for(tok: str) -> Set[str]:
    can = canonicalize_token(tok)
    return SLOOK.get(can, {can})

def build_search_doc(text: str) -> str:
    can = canonical_tokens_from_text(text)
    exp = set()
    for tok in can:
        exp.add(tok)
        syns = SLOOK.get(tok)
        if syns:
            exp.update(syns)
    return " ".join(exp)

def build_fts_query(text: str) -> str:
    can = canonical_tokens_from_text(text)
    if not can: return ""
    uniq = sorted(list(set(t for t in can if len(t) > 1)))
    return " OR ".join(f'"{t}"' for t in uniq)

def canonical_token_set(text: str) -> Set[str]:
    return set(canonical_tokens_from_text(text))


def stable_text_fallback_hash(text: str) -> str:
    return hashlib.blake2b(text.encode("utf-8"), digest_size=8).hexdigest()
