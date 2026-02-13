import { createHash } from "crypto";

export interface CompressionMetrics {
    ogTok: number;
    compTok: number;
    ratio: number;
    saved: number;
    pct: number;
    latency: number;
    algo: string;
    ts: number;
}

export interface CompressionResult {
    og: string;
    comp: string;
    metrics: CompressionMetrics;
    hash: string;
}

export interface CompressionStats {
    total: number;
    ogTok: number;
    compTok: number;
    saved: number;
    avgRatio: number;
    latency: number;
    algos: Record<string, number>;
    updated: number;
}

class MemoryCompressionEngine {
    private stats: CompressionStats = {
        total: 0,
        ogTok: 0,
        compTok: 0,
        saved: 0,
        avgRatio: 0,
        latency: 0,
        algos: {},
        updated: Date.now(),
    };

    private cache = new Map<string, CompressionResult>();
    private readonly MAX = 500;
    private readonly MS = 0.05;

    // Hoist regex patterns to avoid recompilation
    private readonly SEM_FILTERS = [
        /\b(just|really|very|quite|rather|somewhat|somehow)\b/gi,
        /\b(actually|basically|essentially|literally)\b/gi,
        /\b(I think that|I believe that|It seems that|It appears that)\b/gi,
        /\b(in order to)\b/gi,
    ];

    private readonly SEM_REPLACEMENTS: [RegExp, string][] = [
        [/\bat this point in time\b/gi, "now"],
        [/\bdue to the fact that\b/gi, "because"],
        [/\bin the event that\b/gi, "if"],
        [/\bfor the purpose of\b/gi, "to"],
        [/\bin the near future\b/gi, "soon"],
        [/\ba number of\b/gi, "several"],
        [/\bprior to\b/gi, "before"],
        [/\bsubsequent to\b/gi, "after"],
    ];

    private readonly SYN_CONTRACTIONS: [RegExp, string][] = [
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

    private readonly SENTENCE_SPLIT = /[.!?]+\s+/;
    private readonly WHITESPACE_NORM = /\s+/g;
    private readonly ARTICLE_REDUCTION = /\b(the|a|an)\s+(\w+),\s+(the|a|an)\s+/gi;
    private readonly BRACE_COMPRESS = [/\s*{\s*/g, /\s*}\s*/g];
    private readonly PAREN_COMPRESS = [/\s*\(\s*/g, /\s*\)\s*/g];
    private readonly SEMICOLON_COMPRESS = /\s*;\s*/g;

    private readonly AGG_MARKDOWN_CHARS = /[*_~`#]/g;
    private readonly AGG_URL_COMPRESS = /https?:\/\/(www\.)?([^\/\s]+)(\/[^\s]*)?/gi;
    private readonly AGG_ABBREVIATIONS: [RegExp, string][] = [
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
    private readonly AGG_NEWLINE_COMPRESS = /\n{3,}/g;

    private tok(t: string): number {
        if (!t) return 0;
        const w = t.split(/\s+/).length;
        const c = t.length;
        return Math.ceil(c / 4 + w / 2);
    }

    private sem(t: string): string {
        if (!t || t.length < 50) return t;
        let c = t;
        const s = c.split(this.SENTENCE_SPLIT);
        const u = s.filter((x, i, a) => {
            if (i === 0) return true;
            const n = x.toLowerCase().trim();
            const p = a[i - 1].toLowerCase().trim();
            return n !== p;
        });
        c = u.join(". ").trim();
        for (const p of this.SEM_FILTERS) c = c.replace(p, "");
        c = c.replace(this.WHITESPACE_NORM, " ").trim();
        for (const [p, x] of this.SEM_REPLACEMENTS) c = c.replace(p, x);
        return c;
    }

    private syn(t: string): string {
        if (!t || t.length < 30) return t;
        let c = t;
        for (const [p, x] of this.SYN_CONTRACTIONS) c = c.replace(p, x);
        c = c.replace(this.ARTICLE_REDUCTION, "$2, ");
        c = c.replace(this.BRACE_COMPRESS[0], "{").replace(this.BRACE_COMPRESS[1], "}");
        c = c.replace(this.PAREN_COMPRESS[0], "(").replace(this.PAREN_COMPRESS[1], ")");
        c = c.replace(this.SEMICOLON_COMPRESS, ";");
        return c;
    }

    private agg(t: string): string {
        if (!t) return t;
        let c = this.sem(t);
        c = this.syn(c);
        c = c.replace(this.AGG_MARKDOWN_CHARS, "");
        c = c.replace(this.AGG_URL_COMPRESS, "$2");
        for (const [p, x] of this.AGG_ABBREVIATIONS) c = c.replace(p, x);
        c = c.replace(this.AGG_NEWLINE_COMPRESS, "\n\n");
        c = c
            .split("\n")
            .map((l) => l.trim())
            .join("\n");
        return c.trim();
    }

    compress(
        t: string,
        a: "semantic" | "syntactic" | "aggressive" = "semantic",
    ): CompressionResult {
        if (!t) {
            return {
                og: t,
                comp: t,
                metrics: this.empty(a),
                hash: this.hash(t),
            };
        }

        const k = `${a}:${this.hash(t)}`;
        if (this.cache.has(k)) return this.cache.get(k)!;

        const ot = this.tok(t);
        let c: string;

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

        const m: CompressionMetrics = {
            ogTok: ot,
            compTok: ct,
            ratio: r,
            saved: sv,
            pct: p,
            latency: l,
            algo: a,
            ts: Date.now(),
        };

        const res: CompressionResult = {
            og: t,
            comp: c,
            metrics: m,
            hash: this.hash(t),
        };
        this.up(m);
        this.store(k, res);
        return res;
    }

    batch(
        ts: string[],
        a: "semantic" | "syntactic" | "aggressive" = "semantic",
    ): CompressionResult[] {
        return ts.map((t) => this.compress(t, a));
    }

    auto(t: string): CompressionResult {
        if (!t || t.length < 50) return this.compress(t, "semantic");
        const code =
            /\b(function|const|let|var|def|class|import|export)\b/.test(t);
        const urls = /https?:\/\//.test(t);
        const verb = t.split(/\s+/).length > 100;
        let a: "semantic" | "syntactic" | "aggressive";
        if (code || urls) a = "aggressive";
        else if (verb) a = "semantic";
        else a = "syntactic";
        return this.compress(t, a);
    }

    getStats(): CompressionStats {
        return { ...this.stats };
    }

    analyze(t: string): Record<string, CompressionMetrics> {
        const r: Record<string, CompressionMetrics> = {};
        for (const a of ["semantic", "syntactic", "aggressive"] as const) {
            const x = this.compress(t, a);
            r[a] = x.metrics;
        }
        return r;
    }

    reset(): void {
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

    clear(): void {
        this.cache.clear();
    }

    private empty(a: string): CompressionMetrics {
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

    private hash(t: string): string {
        return createHash("md5").update(t).digest("hex").substring(0, 16);
    }

    private up(m: CompressionMetrics): void {
        this.stats.total++;
        this.stats.ogTok += m.ogTok;
        this.stats.compTok += m.compTok;
        this.stats.saved += m.saved;
        this.stats.latency += m.latency;
        if (this.stats.ogTok > 0)
            this.stats.avgRatio = this.stats.compTok / this.stats.ogTok;
        if (!this.stats.algos[m.algo]) this.stats.algos[m.algo] = 0;
        this.stats.algos[m.algo]++;
        this.stats.updated = Date.now();
    }

    private store(k: string, r: CompressionResult): void {
        if (this.cache.size >= this.MAX) {
            const f = this.cache.keys().next().value;
            if (f) this.cache.delete(f);
        }
        this.cache.set(k, r);
    }
}

export const compressionEngine = new MemoryCompressionEngine();
export { MemoryCompressionEngine };
