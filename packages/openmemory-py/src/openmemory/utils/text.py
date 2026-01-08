import re
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

TOK_PAT = re.compile(r"[a-z0-9]+")

def tokenize(text: str) -> List[str]:
    return [m.lower() for m in TOK_PAT.findall(text)]

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
