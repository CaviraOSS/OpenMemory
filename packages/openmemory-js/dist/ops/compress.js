"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryCompressionEngine = exports.compressionEngine = void 0;
const crypto_1 = require("crypto");
class MemoryCompressionEngine {
    stats = {
        total: 0,
        ogTok: 0,
        compTok: 0,
        saved: 0,
        avgRatio: 0,
        latency: 0,
        algos: {},
        updated: Date.now(),
    };
    cache = new Map();
    MAX = 500;
    MS = 0.05;
    tok(t) {
        if (!t)
            return 0;
        const w = t.split(/\s+/).length;
        const c = t.length;
        return Math.ceil(c / 4 + w / 2);
    }
    sem(t) {
        if (!t || t.length < 50)
            return t;
        let c = t;
        const s = c.split(/[.!?]+\s+/);
        const u = s.filter((x, i, a) => {
            if (i === 0)
                return true;
            const n = x.toLowerCase().trim();
            const p = a[i - 1].toLowerCase().trim();
            return n !== p;
        });
        c = u.join(". ").trim();
        const f = [
            /\b(just|really|very|quite|rather|somewhat|somehow)\b/gi,
            /\b(actually|basically|essentially|literally)\b/gi,
            /\b(I think that|I believe that|It seems that|It appears that)\b/gi,
            /\b(in order to)\b/gi,
        ];
        for (const p of f)
            c = c.replace(p, "");
        c = c.replace(/\s+/g, " ").trim();
        const r = [
            [/\bat this point in time\b/gi, "now"],
            [/\bdue to the fact that\b/gi, "because"],
            [/\bin the event that\b/gi, "if"],
            [/\bfor the purpose of\b/gi, "to"],
            [/\bin the near future\b/gi, "soon"],
            [/\ba number of\b/gi, "several"],
            [/\bprior to\b/gi, "before"],
            [/\bsubsequent to\b/gi, "after"],
        ];
        for (const [p, x] of r)
            c = c.replace(p, x);
        return c;
    }
    syn(t) {
        if (!t || t.length < 30)
            return t;
        let c = t;
        const ct = [
            [/\bdo not\b/gi, "don't"],
            [/\bcannot\b/gi, "can't"],
            [/\bwill not\b/gi, "won't"],
            [/\bshould not\b/gi, "shouldn't"],
            [/\bwould not\b/gi, "wouldn't"],
            [/\bit is\b/gi, "it's"],
            [/\bthat is\b/gi, "that's"],
            [/\bwhat is\b/gi, "what's"],
            [/\bwho is\b/gi, "who's"],
            [/\bthere is\b/gi, "there's"],
            [/\bhas been\b/gi, "been"],
            [/\bhave been\b/gi, "been"],
        ];
        for (const [p, x] of ct)
            c = c.replace(p, x);
        c = c.replace(/\b(the|a|an)\s+(\w+),\s+(the|a|an)\s+/gi, "$2, ");
        c = c.replace(/\s*{\s*/g, "{").replace(/\s*}\s*/g, "}");
        c = c.replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")");
        c = c.replace(/\s*;\s*/g, ";");
        return c;
    }
    agg(t) {
        if (!t)
            return t;
        let c = this.sem(t);
        c = this.syn(c);
        c = c.replace(/[*_~`#]/g, "");
        c = c.replace(/https?:\/\/(www\.)?([^\/\s]+)(\/[^\s]*)?/gi, "$2");
        const a = [
            [/\bJavaScript\b/gi, "JS"],
            [/\bTypeScript\b/gi, "TS"],
            [/\bPython\b/gi, "Py"],
            [/\bapplication\b/gi, "app"],
            [/\bfunction\b/gi, "fn"],
            [/\bparameter\b/gi, "param"],
            [/\bargument\b/gi, "arg"],
            [/\breturn\b/gi, "ret"],
            [/\bvariable\b/gi, "var"],
            [/\bconstant\b/gi, "const"],
            [/\bdatabase\b/gi, "db"],
            [/\brepository\b/gi, "repo"],
            [/\benvironment\b/gi, "env"],
            [/\bconfiguration\b/gi, "config"],
            [/\bdocumentation\b/gi, "docs"],
        ];
        for (const [p, x] of a)
            c = c.replace(p, x);
        c = c.replace(/\n{3,}/g, "\n\n");
        c = c
            .split("\n")
            .map((l) => l.trim())
            .join("\n");
        return c.trim();
    }
    compress(t, a = "semantic") {
        if (!t) {
            return {
                og: t,
                comp: t,
                metrics: this.empty(a),
                hash: this.hash(t),
            };
        }
        const k = `${a}:${this.hash(t)}`;
        if (this.cache.has(k))
            return this.cache.get(k);
        const ot = this.tok(t);
        let c;
        switch (a) {
            case "semantic":
                c = this.sem(t);
                break;
            case "syntactic":
                c = this.syn(t);
                break;
            case "aggressive":
                c = this.agg(t);
                break;
            default:
                c = t;
        }
        const ct = this.tok(c);
        const sv = ot - ct;
        const r = ct / ot;
        const p = (sv / ot) * 100;
        const l = sv * this.MS;
        const m = {
            ogTok: ot,
            compTok: ct,
            ratio: r,
            saved: sv,
            pct: p,
            latency: l,
            algo: a,
            ts: Date.now(),
        };
        const res = {
            og: t,
            comp: c,
            metrics: m,
            hash: this.hash(t),
        };
        this.up(m);
        this.store(k, res);
        return res;
    }
    batch(ts, a = "semantic") {
        return ts.map((t) => this.compress(t, a));
    }
    auto(t) {
        if (!t || t.length < 50)
            return this.compress(t, "semantic");
        const code = /\b(function|const|let|var|def|class|import|export)\b/.test(t);
        const urls = /https?:\/\//.test(t);
        const verb = t.split(/\s+/).length > 100;
        let a;
        if (code || urls)
            a = "aggressive";
        else if (verb)
            a = "semantic";
        else
            a = "syntactic";
        return this.compress(t, a);
    }
    getStats() {
        return { ...this.stats };
    }
    analyze(t) {
        const r = {};
        for (const a of ["semantic", "syntactic", "aggressive"]) {
            const x = this.compress(t, a);
            r[a] = x.metrics;
        }
        return r;
    }
    reset() {
        this.stats = {
            total: 0,
            ogTok: 0,
            compTok: 0,
            saved: 0,
            avgRatio: 0,
            latency: 0,
            algos: {},
            updated: Date.now(),
        };
    }
    clear() {
        this.cache.clear();
    }
    empty(a) {
        return {
            ogTok: 0,
            compTok: 0,
            ratio: 1,
            saved: 0,
            pct: 0,
            latency: 0,
            algo: a,
            ts: Date.now(),
        };
    }
    hash(t) {
        return (0, crypto_1.createHash)("md5").update(t).digest("hex").substring(0, 16);
    }
    up(m) {
        this.stats.total++;
        this.stats.ogTok += m.ogTok;
        this.stats.compTok += m.compTok;
        this.stats.saved += m.saved;
        this.stats.latency += m.latency;
        if (this.stats.ogTok > 0)
            this.stats.avgRatio = this.stats.compTok / this.stats.ogTok;
        if (!this.stats.algos[m.algo])
            this.stats.algos[m.algo] = 0;
        this.stats.algos[m.algo]++;
        this.stats.updated = Date.now();
    }
    store(k, r) {
        if (this.cache.size >= this.MAX) {
            const f = this.cache.keys().next().value;
            if (f)
                this.cache.delete(f);
        }
        this.cache.set(k, r);
    }
}
exports.MemoryCompressionEngine = MemoryCompressionEngine;
exports.compressionEngine = new MemoryCompressionEngine();
