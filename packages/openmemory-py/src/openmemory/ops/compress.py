import re
import time
import hashlib
from typing import Dict, Any, List, Optional

# --- Module-level compiled regex constants ---

_WHITESPACE_RE = re.compile(r"\s+")
_SENTENCE_SPLIT_RE = re.compile(r"[.!?]+\s+")

_FILLER_RES = [
    re.compile(r"\b(just|really|very|quite|rather|somewhat|somehow)\b", re.IGNORECASE),
    re.compile(r"\b(actually|basically|essentially|literally)\b", re.IGNORECASE),
    re.compile(r"\b(I think that|I believe that|It seems that|It appears that)\b", re.IGNORECASE),
    re.compile(r"\b(in order to)\b", re.IGNORECASE),
]

_REPLACEMENT_RES = [
    (re.compile(r"\bat this point in time\b", re.IGNORECASE), "now"),
    (re.compile(r"\bdue to the fact that\b", re.IGNORECASE), "because"),
    (re.compile(r"\bin the event that\b", re.IGNORECASE), "if"),
    (re.compile(r"\bfor the purpose of\b", re.IGNORECASE), "to"),
    (re.compile(r"\bin the near future\b", re.IGNORECASE), "soon"),
    (re.compile(r"\ba number of\b", re.IGNORECASE), "several"),
    (re.compile(r"\bprior to\b", re.IGNORECASE), "before"),
    (re.compile(r"\bsubsequent to\b", re.IGNORECASE), "after"),
]

_CONTRACTION_RES = [
    (re.compile(r"\bdo not\b", re.IGNORECASE), "don't"),
    (re.compile(r"\bcannot\b", re.IGNORECASE), "can't"),
    (re.compile(r"\bwill not\b", re.IGNORECASE), "won't"),
    (re.compile(r"\bshould not\b", re.IGNORECASE), "shouldn't"),
    (re.compile(r"\bwould not\b", re.IGNORECASE), "wouldn't"),
    (re.compile(r"\bit is\b", re.IGNORECASE), "it's"),
    (re.compile(r"\bthat is\b", re.IGNORECASE), "that's"),
    (re.compile(r"\bwhat is\b", re.IGNORECASE), "what's"),
    (re.compile(r"\bwho is\b", re.IGNORECASE), "who's"),
    (re.compile(r"\bthere is\b", re.IGNORECASE), "there's"),
    (re.compile(r"\bhas been\b", re.IGNORECASE), "been"),
    (re.compile(r"\bhave been\b", re.IGNORECASE), "been"),
]

_ARTICLE_STRIP_RE = re.compile(r"\b(the|a|an)\s+(\w+),\s+(the|a|an)\s+", re.IGNORECASE)
_BRACE_OPEN_RE = re.compile(r"\s*{\s*")
_BRACE_CLOSE_RE = re.compile(r"\s*}\s*")
_PAREN_OPEN_RE = re.compile(r"\s*\(\s*")
_PAREN_CLOSE_RE = re.compile(r"\s*\)\s*")
_SEMICOLON_RE = re.compile(r"\s*;\s*")

_MARKDOWN_RE = re.compile(r"[*_~`#]")
_URL_RE = re.compile(r"https?://(www\.)?([^\/\s]+)(/[^\s]*)?", re.IGNORECASE)

_ABBREV_RES = [
    (re.compile(r"\bJavaScript\b", re.IGNORECASE), "JS"),
    (re.compile(r"\bTypeScript\b", re.IGNORECASE), "TS"),
    (re.compile(r"\bPython\b", re.IGNORECASE), "Py"),
    (re.compile(r"\bapplication\b", re.IGNORECASE), "app"),
    (re.compile(r"\bfunction\b", re.IGNORECASE), "fn"),
    (re.compile(r"\bparameter\b", re.IGNORECASE), "param"),
    (re.compile(r"\bargument\b", re.IGNORECASE), "arg"),
    (re.compile(r"\breturn\b", re.IGNORECASE), "ret"),
    (re.compile(r"\bvariable\b", re.IGNORECASE), "var"),
    (re.compile(r"\bconstant\b", re.IGNORECASE), "const"),
    (re.compile(r"\bdatabase\b", re.IGNORECASE), "db"),
    (re.compile(r"\brepository\b", re.IGNORECASE), "repo"),
    (re.compile(r"\benvironment\b", re.IGNORECASE), "env"),
    (re.compile(r"\bconfiguration\b", re.IGNORECASE), "config"),
    (re.compile(r"\bdocumentation\b", re.IGNORECASE), "docs"),
]

_MULTI_NEWLINE_RE = re.compile(r"\n{3,}")
_CODE_DETECT_RE = re.compile(r"\b(function|const|let|var|def|class|import|export)\b")
_URL_DETECT_RE = re.compile(r"https?://")

# --- Engine ---

class MemoryCompressionEngine:
    def __init__(self):
        self.stats = {
            "total": 0,
            "ogTok": 0,
            "compTok": 0,
            "saved": 0,
            "avgRatio": 0,
            "latency": 0,
            "algos": {},
            "updated": int(time.time() * 1000)
        }
        self.cache = {}
        self.MAX = 500
        self.MS = 0.05

    def tok(self, t: str) -> int:
        if not t: return 0
        w = len(_WHITESPACE_RE.split(t.strip()))
        c = len(t)
        return int(c / 4 + w / 2) + 1

    def sem(self, t: str) -> str:
        if not t or len(t) < 50: return t
        c = t
        s = _SENTENCE_SPLIT_RE.split(c)
        u = []
        for i, x in enumerate(s):
            if i == 0:
                u.append(x)
                continue
            n = x.lower().strip()
            p = s[i-1].lower().strip()
            if n != p: u.append(x)

        c = ". ".join(u).strip()
        for pat in _FILLER_RES:
            c = pat.sub("", c)

        c = _WHITESPACE_RE.sub(" ", c).strip()

        for pat, repl in _REPLACEMENT_RES:
            c = pat.sub(repl, c)

        return c

    def syn(self, t: str) -> str:
        if not t or len(t) < 30: return t
        c = t
        for pat, repl in _CONTRACTION_RES:
            c = pat.sub(repl, c)

        c = _ARTICLE_STRIP_RE.sub(r"\2, ", c)
        c = _BRACE_OPEN_RE.sub("{", c)
        c = _BRACE_CLOSE_RE.sub("}", c)
        c = _PAREN_OPEN_RE.sub("(", c)
        c = _PAREN_CLOSE_RE.sub(")", c)
        c = _SEMICOLON_RE.sub(";", c)
        return c

    def agg(self, t: str) -> str:
        if not t: return t
        c = self.sem(t)
        c = self.syn(c)
        c = _MARKDOWN_RE.sub("", c)
        c = _URL_RE.sub(r"\2", c)

        for pat, repl in _ABBREV_RES:
            c = pat.sub(repl, c)

        c = _MULTI_NEWLINE_RE.sub("\n\n", c)
        c = "\n".join([l.strip() for l in c.split("\n")])
        return c.strip()

    def compress(self, t: str, a: str = "semantic") -> Dict[str, Any]:
        if not t:
            return {
                "og": t, "comp": t,
                "metrics": self.empty(a),
                "hash": self.hash(t)
            }

        k = f"{a}:{self.hash(t)}"
        if k in self.cache: return self.cache[k]

        ot = self.tok(t)
        if a == "semantic": c = self.sem(t)
        elif a == "syntactic": c = self.syn(t)
        elif a == "aggressive": c = self.agg(t)
        else: c = t

        ct = self.tok(c)
        sv = ot - ct
        r = ct / ot if ot > 0 else 1
        p = (sv / ot) * 100 if ot > 0 else 0
        l = sv * self.MS

        m = {
            "ogTok": ot, "compTok": ct, "ratio": r, "saved": sv,
            "pct": p, "latency": l, "algo": a, "ts": int(time.time()*1000)
        }
        res = {
            "og": t, "comp": c, "metrics": m, "hash": self.hash(t)
        }
        self.up(m)
        self.store(k, res)
        return res

    def batch(self, ts: List[str], a: str = "semantic") -> List[Dict[str, Any]]:
        return [self.compress(t, a) for t in ts]

    def auto(self, t: str) -> Dict[str, Any]:
        if not t or len(t) < 50: return self.compress(t, "semantic")
        code = bool(_CODE_DETECT_RE.search(t))
        urls = bool(_URL_DETECT_RE.search(t))
        verb = len(t.split()) > 100

        if code or urls: a = "aggressive"
        elif verb: a = "semantic"
        else: a = "syntactic"
        return self.compress(t, a)

    def empty(self, a: str):
        return {
            "ogTok": 0, "compTok": 0, "ratio": 1, "saved": 0,
            "pct": 0, "latency": 0, "algo": a, "ts": int(time.time()*1000)
        }

    def hash(self, t: str) -> str:
        return hashlib.md5(t.encode("utf-8")).hexdigest()[:16]

    def up(self, m):
        self.stats["total"] += 1
        self.stats["ogTok"] += m["ogTok"]
        self.stats["compTok"] += m["compTok"]
        self.stats["saved"] += m["saved"]
        self.stats["latency"] += m["latency"]
        if self.stats["ogTok"] > 0:
            self.stats["avgRatio"] = self.stats["compTok"] / self.stats["ogTok"]

        algo = m["algo"]
        self.stats["algos"][algo] = self.stats["algos"].get(algo, 0) + 1
        self.stats["updated"] = int(time.time()*1000)

    def store(self, k, r):
        if len(self.cache) >= self.MAX:
            first = next(iter(self.cache))
            del self.cache[first]
        self.cache[k] = r

compression_engine = MemoryCompressionEngine()
