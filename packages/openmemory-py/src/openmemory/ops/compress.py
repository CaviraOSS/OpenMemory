import re
import time
import hashlib
from typing import Dict, Any, List, Optional

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
        w = len(re.split(r"\s+", t.strip()))
        c = len(t)
        return int(c / 4 + w / 2) + 1

    def sem(self, t: str) -> str:
        if not t or len(t) < 50: return t
        c = t
        s = re.split(r"[.!?]+\s+", c)
        u = []
        for i, x in enumerate(s):
            if i == 0:
                u.append(x)
                continue
            n = x.lower().strip()
            p = s[i-1].lower().strip()
            if n != p: u.append(x)

        c = ". ".join(u).strip()
        fillers = [
            r"\b(just|really|very|quite|rather|somewhat|somehow)\b",
            r"\b(actually|basically|essentially|literally)\b",
            r"\b(I think that|I believe that|It seems that|It appears that)\b",
            r"\b(in order to)\b"
        ]
        for p in fillers:
            c = re.sub(p, "", c, flags=re.IGNORECASE)

        c = re.sub(r"\s+", " ", c).strip()

        replacements = [
            (r"\bat this point in time\b", "now"),
            (r"\bdue to the fact that\b", "because"),
            (r"\bin the event that\b", "if"),
            (r"\bfor the purpose of\b", "to"),
            (r"\bin the near future\b", "soon"),
            (r"\ba number of\b", "several"),
            (r"\bprior to\b", "before"),
            (r"\bsubsequent to\b", "after")
        ]
        for p, x in replacements:
            c = re.sub(p, x, c, flags=re.IGNORECASE)

        return c

    def syn(self, t: str) -> str:
        if not t or len(t) < 30: return t
        c = t
        ct = [
            (r"\bdo not\b", "don't"),
            (r"\bcannot\b", "can't"),
            (r"\bwill not\b", "won't"),
            (r"\bshould not\b", "shouldn't"),
            (r"\bwould not\b", "wouldn't"),
            (r"\bit is\b", "it's"),
            (r"\bthat is\b", "that's"),
            (r"\bwhat is\b", "what's"),
            (r"\bwho is\b", "who's"),
            (r"\bthere is\b", "there's"),
            (r"\bhas been\b", "been"),
            (r"\bhave been\b", "been")
        ]
        for p, x in ct:
            c = re.sub(p, x, c, flags=re.IGNORECASE)

        c = re.sub(r"\b(the|a|an)\s+(\w+),\s+(the|a|an)\s+", r"\2, ", c, flags=re.IGNORECASE)
        c = re.sub(r"\s*{\s*", "{", c)
        c = re.sub(r"\s*}\s*", "}", c)
        c = re.sub(r"\s*\(\s*", "(", c)
        c = re.sub(r"\s*\)\s*", ")", c)
        c = re.sub(r"\s*;\s*", ";", c)
        return c

    def agg(self, t: str) -> str:
        if not t: return t
        c = self.sem(t)
        c = self.syn(c)
        c = re.sub(r"[*_~`
        c = re.sub(r"https?://(www\.)?([^\/\s]+)(/[^\s]*)?", r"\2", c, flags=re.IGNORECASE)

        abbr = [
            (r"\bJavaScript\b", "JS"),
            (r"\bTypeScript\b", "TS"),
            (r"\bPython\b", "Py"),
            (r"\bapplication\b", "app"),
            (r"\bfunction\b", "fn"),
            (r"\bparameter\b", "param"),
            (r"\bargument\b", "arg"),
            (r"\breturn\b", "ret"),
            (r"\bvariable\b", "var"),
            (r"\bconstant\b", "const"),
            (r"\bdatabase\b", "db"),
            (r"\brepository\b", "repo"),
            (r"\benvironment\b", "env"),
            (r"\bconfiguration\b", "config"),
            (r"\bdocumentation\b", "docs")
        ]
        for p, x in abbr:
             c = re.sub(p, x, c, flags=re.IGNORECASE)

        c = re.sub(r"\n{3,}", "\n\n", c)
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
        code = bool(re.search(r"\b(function|const|let|var|def|class|import|export)\b", t))
        urls = bool(re.search(r"https?://", t))
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
