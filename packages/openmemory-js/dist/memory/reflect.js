"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stop_reflection = exports.start_reflection = exports.run_reflection = void 0;
const db_1 = require("../core/db");
const hsg_1 = require("./hsg");
const cfg_1 = require("../core/cfg");
const utils_1 = require("../utils");
const sim = (t1, t2) => {
    // Robust Jaccard overlap
    const s1 = new Set(t1.toLowerCase().split(/\s+/).filter(x => x.length > 0));
    const s2 = new Set(t2.toLowerCase().split(/\s+/).filter(x => x.length > 0));
    if (s1.size === 0 || s2.size === 0)
        return 0;
    let inter = 0;
    for (const token of s1) {
        if (s2.has(token))
            inter++;
    }
    const union = new Set([...s1, ...s2]).size;
    return union > 0 ? inter / union : 0;
};
const cluster = (mems) => {
    const cls = [];
    const used = new Set();
    for (const m of mems) {
        if (used.has(m.id) ||
            m.primary_sector === "reflective" ||
            m.metadata?.consolidated)
            continue;
        const c = { mem: [m], n: 1 };
        used.add(m.id);
        for (const o of mems) {
            if (used.has(o.id) || m.primary_sector !== o.primary_sector)
                continue;
            if (sim(m.content, o.content) > 0.8) {
                c.mem.push(o);
                c.n++;
                used.add(o.id);
            }
        }
        if (c.n >= 2)
            cls.push(c);
    }
    return cls;
};
const sal = (c) => {
    const now = Date.now();
    const p = c.n / 10;
    const r = c.mem.reduce((s, m) => s +
        Math.exp(-(now - new Date(m.created_at).getTime()) / 43200000), 0) / c.n;
    const e = c.mem.some((m) => m.sectors &&
        Array.isArray(m.sectors) &&
        m.sectors.includes("emotional"))
        ? 1
        : 0;
    return Math.min(1, 0.6 * p + 0.3 * r + 0.1 * e);
};
const summ = (c) => {
    const sec = c.mem[0].primary_sector;
    const n = c.n;
    const txt = c.mem.map((m) => m.content.substring(0, 60)).join("; ");
    return `${n} ${sec} pattern: ${txt.substring(0, 200)}`;
};
const mark = async (ids) => {
    for (const id of ids) {
        const m = await db_1.q.get_mem.get(id);
        if (m) {
            const meta = JSON.parse(m.meta || "{}");
            meta.consolidated = true;
            await db_1.q.upd_mem.run(m.content, m.tags, JSON.stringify(meta), Date.now(), id);
        }
    }
};
const boost = async (ids) => {
    for (const id of ids) {
        const m = await db_1.q.get_mem.get(id);
        if (m)
            await db_1.q.upd_mem.run(m.content, m.tags, m.meta, Date.now(), id);
        await db_1.q.upd_seen.run(id, m.last_seen_at, Math.min(1, m.salience * 1.1), Date.now());
    }
};
const run_reflection = async () => {
    console.error("[REFLECT] Starting reflection job...");
    const min = cfg_1.env.reflect_min || 20;
    const mems = await db_1.q.all_mem.all(100, 0);
    console.error(`[REFLECT] Fetched ${mems.length} memories (min required: ${min})`);
    if (mems.length < min) {
        console.error("[REFLECT] Not enough memories, skipping");
        return { created: 0, reason: "low" };
    }
    const cls = cluster(mems);
    console.error(`[REFLECT] Clustered into ${cls.length} groups`);
    let n = 0;
    for (const c of cls) {
        const txt = summ(c);
        const s = sal(c);
        const src = c.mem.map((m) => m.id);
        const meta = {
            type: "auto_reflect",
            sources: src,
            freq: c.n,
            at: new Date().toISOString(),
        };
        console.error(`[REFLECT] Creating reflection: ${c.n} memories, salience=${s.toFixed(3)}, sector=${c.mem[0].primary_sector}`);
        await (0, hsg_1.add_hsg_memory)(txt, (0, utils_1.j)(["reflect:auto"]), meta);
        await mark(src);
        await boost(src);
        n++;
    }
    if (n > 0)
        await (0, db_1.log_maint_op)("reflect", n);
    console.error(`[REFLECT] Job complete: created ${n} reflections`);
    return { created: n, clusters: cls.length };
};
exports.run_reflection = run_reflection;
let timer = null;
const start_reflection = () => {
    if (!cfg_1.env.auto_reflect || timer)
        return;
    const int = (cfg_1.env.reflect_interval || 10) * 60000;
    timer = setInterval(() => (0, exports.run_reflection)().catch((e) => console.error("[REFLECT]", e)), int);
    console.error(`[REFLECT] Started: every ${cfg_1.env.reflect_interval || 10}m`);
};
exports.start_reflection = start_reflection;
const stop_reflection = () => {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
};
exports.stop_reflection = stop_reflection;
