import { all_async, run_async, q, vector_store, memories_table } from "../core/db";
import { now } from "../utils";
import { env } from "../core/cfg";

type mem = {
    id: string;
    content?: string;
    summary?: string;
    vector: number[];
    salience: number;
    last_access: number;
    state?: "hot" | "warm" | "cold";
    coacts?: number;
};

type decay_cfg = {
    threads: number;
    cold_threshold: number;
    reinforce_on_query: boolean;
    regeneration_enabled: boolean;
    max_vec_dim: number;
    min_vec_dim: number;
    summary_layers: number;
    lambda_hot: number;
    lambda_warm: number;
    lambda_cold: number;
    time_unit_ms: number;
};

const parse_int = (x: any, d: number) =>
    Number.isFinite(+x) ? Math.floor(+x) : d;
const parse_f = (x: any, d: number) => (Number.isFinite(+x) ? +x : d);
const parse_bool = (x: any, d: boolean) =>
    x === "true" ? true : x === "false" ? false : d;
const clamp_f = (v: number, a: number, b: number) =>
    Math.min(b, Math.max(a, v));
const clamp_i = (v: number, a: number, b: number) =>
    Math.min(b, Math.max(a, Math.floor(v)));
const tick = () => new Promise<void>((r) => setImmediate(r));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mean = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const l2 = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const normalize = (v: number[]) => {
    const n = l2(v) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= n;
    return v;
};
const chunkz = <t>(arr: t[], k: number) => {
    const n = Math.max(1, k | 0),
        out: t[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < arr.length; i++) out[i % n].push(arr[i]);
    return out;
};

const make_decay_cfg = (): decay_cfg => ({
    threads: parse_int(process.env.OM_DECAY_THREADS, 3),
    cold_threshold: parse_f(process.env.OM_DECAY_COLD_THRESHOLD, 0.25),
    reinforce_on_query: parse_bool(
        process.env.OM_DECAY_REINFORCE_ON_QUERY,
        true,
    ),
    regeneration_enabled: parse_bool(process.env.OM_REGENERATION_ENABLED, true),
    max_vec_dim: parse_int(process.env.OM_MAX_VECTOR_DIM, env.vec_dim || 1536),
    min_vec_dim: parse_int(process.env.OM_MIN_VECTOR_DIM, 64),
    summary_layers: clamp_i(parse_int(process.env.OM_SUMMARY_LAYERS, 3), 1, 3),
    lambda_hot: 0.005,
    lambda_warm: 0.02,
    lambda_cold: 0.05,
    time_unit_ms: 86_400_000,
});

const cfg = make_decay_cfg();

let active_q = 0;
let last_decay = 0;
const cooldown = 60000;
export const inc_q = () => active_q++;
export const dec_q = () => active_q--;

const pick_tier = (m: any, now_ts: number): "hot" | "warm" | "cold" => {
    const dt = Math.max(0, now_ts - (m.last_seen_at || m.updated_at || now_ts));
    const recent = dt < 6 * 86_400_000;
    const high = (m.coactivations || 0) > 5 || (m.salience || 0) > 0.7;
    if (recent && high) return "hot";
    if (recent || (m.salience || 0) > 0.4) return "warm";
    return "cold";
};

const compress_vector = (
    vec: number[],
    f: number,
    min_dim = 64,
    max_dim = 1536,
): number[] => {
    const src = vec.length ? vec : [1];
    const tgt_dim = Math.max(
        min_dim,
        Math.min(max_dim, Math.floor(src.length * clamp_f(f, 0.0, 1.0))),
    );
    const dim = Math.max(min_dim, Math.min(src.length, tgt_dim));
    if (dim >= src.length) return src.slice(0);
    const pooled: number[] = [];
    const bucket = Math.ceil(src.length / dim);
    for (let i = 0; i < src.length; i += bucket)
        pooled.push(mean(src.slice(i, i + bucket)));
    normalize(pooled);
    return pooled;
};

const compress_summary = (txt: string, f: number, layers = 3): string => {
    const t = (txt || "").trim();
    if (!t) return "";
    const lay = clamp_i(layers, 1, 3);
    const trunc = (s: string, n: number) =>
        s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
    const sumz = (s: string) => summarize_quick(s);
    const keys = (s: string, k = 5) => top_keywords(s, k).join(" ");
    if (f > 0.8) return trunc(t, 200);
    if (f > 0.4) return trunc(sumz(t), lay >= 2 ? 80 : 200);
    return keys(t, lay >= 3 ? 5 : 3);
};

const fingerprint_mem = (m: any): { vector: number[]; summary: string } => {
    const base = (m.id + "|" + (m.summary || m.content || "")).trim();
    const vec = hash_to_vec(base, 32);
    normalize(vec);
    const summary = top_keywords(m.summary || m.content || "", 3).join(" ");
    return { vector: vec, summary };
};

const hash_to_vec = (s: string, d = 32): number[] => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    const out: number[] = new Array(Math.max(2, d | 0)).fill(0);
    let x = h || 1;
    for (let i = 0; i < out.length; i++) {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        out[i] = ((x >>> 0) / 0xffffffff) * 2 - 1;
    }
    normalize(out);
    return out;
};

const summarize_quick = (t: string): string => {
    const sents = t.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (!sents.length) return t;
    const score = (s: string) =>
        top_keywords(s, 6).length + Math.min(3, s.match(/[,;:]/g)?.length || 0);
    const top = sents
        .map((s, i) => ({ s, i, sc: score(s) }))
        .sort((a, b) => b.sc - a.sc || a.i - b.i)
        .slice(0, Math.min(3, Math.ceil(sents.length / 3)))
        .sort((a, b) => a.i - b.i)
        .map((x) => x.s)
        .join(" ");
    return top || sents[0];
};

const stop = new Set([
    "the",
    "a",
    "an",
    "to",
    "of",
    "and",
    "or",
    "in",
    "on",
    "for",
    "with",
    "at",
    "by",
    "is",
    "it",
    "be",
    "as",
    "are",
    "was",
    "were",
    "from",
    "that",
    "this",
    "these",
    "those",
    "but",
    "if",
    "then",
    "so",
    "than",
    "into",
    "over",
    "under",
    "about",
    "via",
    "vs",
    "not",
]);

const top_keywords = (t: string, k = 5): string[] => {
    const words = (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
        (w) => !stop.has(w),
    );
    if (!words.length) return [];
    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
    return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .slice(0, k)
        .map(([w]) => w);
};

export const apply_decay = async () => {
    if (active_q > 0) {
        console.log(`[decay] skipped - ${active_q} active queries`);
        return;
    }
    const now_ts = Date.now();
    if (now_ts - last_decay < cooldown) {
        console.log(
            `[decay] skipped - cooldown active (${((cooldown - (now_ts - last_decay)) / 1000).toFixed(0)}s remaining)`,
        );
        return;
    }
    last_decay = now_ts;
    const t0 = performance.now();

    const segments = await q.get_segments.all();
    let tot_proc = 0,
        tot_chg = 0,
        tot_comp = 0,
        tot_fp = 0;
    const tier_counts = { hot: 0, warm: 0, cold: 0 };

    for (const seg of segments) {
        const segment = seg.segment;
        const rows = await all_async(
            "select id,content,summary,salience,decay_lambda,last_seen_at,updated_at,primary_sector,coactivations from memories where segment=?",
            [segment],
        );

        const decay_ratio = env.decay_ratio;
        const batch_sz = Math.max(1, Math.floor(rows.length * decay_ratio));
        const start_idx = Math.floor(
            Math.random() * Math.max(1, rows.length - batch_sz + 1),
        );
        const batch = rows.slice(start_idx, start_idx + batch_sz);

        const parts = chunkz(batch, cfg.threads);

        await Promise.all(
            parts.map(async (part) => {
                for (const m of part) {
                    const tier = pick_tier(m, now_ts);
                    tier_counts[tier]++;

                    const lam =
                        tier === "hot"
                            ? cfg.lambda_hot
                            : tier === "warm"
                                ? cfg.lambda_warm
                                : cfg.lambda_cold;
                    const dt = Math.max(
                        0,
                        (now_ts - (m.last_seen_at || m.updated_at)) /
                        cfg.time_unit_ms,
                    );
                    const act = Math.max(0, m.coactivations || 0);
                    const sal = clamp_f(
                        (m.salience || 0.5) * (1 + Math.log1p(act)),
                        0,
                        1,
                    );
                    const f = Math.exp(-lam * (dt / (sal + 0.1)));

                    let new_sal = clamp_f(sal * f, 0, 1);
                    let changed = Math.abs(new_sal - m.salience) > 0.001;
                    let compressed = false;
                    let fingerprinted = false;

                    if (f < 0.7) {
                        const sector = m.primary_sector || "semantic";
                        const vec_row = await vector_store.getVector(m.id, sector);

                        if (vec_row && vec_row.vector) {
                            const vec =
                                typeof vec_row.vector === "string"
                                    ? JSON.parse(vec_row.vector)
                                    : vec_row.vector;
                            const before_len = Array.isArray(vec)
                                ? vec.length
                                : 0;

                            if (before_len > 0) {
                                const new_vec = compress_vector(
                                    vec,
                                    f,
                                    cfg.min_vec_dim,
                                    cfg.max_vec_dim,
                                );
                                const new_summary = compress_summary(
                                    m.summary || m.content || "",
                                    f,
                                    cfg.summary_layers,
                                );

                                if (new_vec.length < before_len) {
                                    await vector_store.storeVector(
                                        m.id,
                                        sector,
                                        new_vec,
                                        new_vec.length,
                                    );
                                    compressed = true;
                                    tot_comp++;
                                }

                                if (new_summary !== (m.summary || "")) {
                                    await run_async(
                                        "update memories set summary=? where id=?",
                                        [new_summary, m.id],
                                    );
                                }
                            }
                        }
                        changed = true;
                    }

                    if (f < Math.max(0.3, cfg.cold_threshold)) {
                        const sector = m.primary_sector || "semantic";
                        const fp = fingerprint_mem(m);
                        await vector_store.storeVector(
                            m.id,
                            sector,
                            fp.vector,
                            fp.vector.length,
                        );
                        await run_async(
                            "update memories set summary=? where id=?",
                            [fp.summary, m.id],
                        );
                        fingerprinted = true;
                        tot_fp++;
                        changed = true;
                    }

                    if (changed) {
                        await run_async(
                            `update ${memories_table} set salience=?,updated_at=? where id=?`,
                            [new_sal, now(), m.id],
                        );
                        tot_chg++;
                    }

                    tot_proc++;
                    await tick();
                }
            }),
        );

        if (seg !== segments[segments.length - 1]) {
            await sleep(env.decay_sleep_ms);
        }
    }

    const tot = performance.now() - t0;

    console.error(
        `[decay-2.0] ${tot_chg}/${tot_proc} | tiers: hot=${tier_counts.hot} warm=${tier_counts.warm} cold=${tier_counts.cold} | compressed=${tot_comp} fingerprinted=${tot_fp} | ${tot.toFixed(1)}ms across ${segments.length} segments`,
    );
};

export const on_query_hit = async (
    mem_id: string,
    sector: string,
    reembed?: (text: string) => Promise<number[]>,
) => {
    if (!cfg.regeneration_enabled && !cfg.reinforce_on_query) return;

    const m = await q.get_mem.get(mem_id);
    if (!m) return;

    let updated = false;

    if (cfg.regeneration_enabled && reembed) {
        const vec_row = await vector_store.getVector(mem_id, sector);
        if (vec_row && vec_row.vector) {
            const vec =
                typeof vec_row.vector === "string"
                    ? JSON.parse(vec_row.vector)
                    : vec_row.vector;
            if (Array.isArray(vec) && vec.length <= 64) {
                try {
                    const base = m.summary || m.content || "";
                    const new_vec = await reembed(base);
                    await vector_store.storeVector(
                        mem_id,
                        sector,
                        new_vec,
                        new_vec.length,
                    );
                    updated = true;
                } catch (e) { }
            }
        }
    }

    if (cfg.reinforce_on_query) {
        const new_sal = clamp_f((m.salience || 0.5) + 0.5, 0, 1);
        await run_async(
            `update ${memories_table} set salience=?,last_seen_at=? where id=?`,
            [new_sal, now(), mem_id],
        );
        updated = true;
    }

    if (updated) {

        console.error(`[decay-2.0] regenerated/reinforced memory ${mem_id}`);
    }
};
