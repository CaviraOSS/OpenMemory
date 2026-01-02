"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_lg_cfg = exports.node_sector_map = void 0;
exports.store_node_mem = store_node_mem;
exports.retrieve_node_mems = retrieve_node_mems;
exports.get_graph_ctx = get_graph_ctx;
exports.create_refl = create_refl;
const cfg_1 = require("../core/cfg");
const hsg_1 = require("../memory/hsg");
const db_1 = require("../core/db");
const utils_1 = require("../utils");
exports.node_sector_map = {
    observe: "episodic",
    plan: "semantic",
    reflect: "reflective",
    act: "procedural",
    emotion: "emotional",
};
const default_sector = "semantic";
const summary_line_limit = 160;
const trunc = (txt, max = 320) => txt.length <= max ? txt : `${txt.slice(0, max).trimEnd()}...`;
const safe_parse = (val, fb) => {
    if (!val)
        return fb;
    try {
        return JSON.parse(val);
    }
    catch {
        return fb;
    }
};
const resolve_sector = (node) => exports.node_sector_map[node.toLowerCase()] ?? default_sector;
const resolve_ns = (ns) => ns || cfg_1.env.lg_namespace;
const build_tags = (tags, node, ns, gid) => {
    const ts = new Set(tags || []);
    ts.add(`lgm:node:${node.toLowerCase()}`);
    ts.add(`lgm:namespace:${ns}`);
    if (gid)
        ts.add(`lgm:graph:${gid}`);
    return Array.from(ts);
};
const build_meta = (p, sec, ns, ext) => {
    const base = { ...(p.metadata || {}) };
    const ex_lgm = typeof base.lgm === "object" && base.lgm !== null
        ? base.lgm
        : {};
    base.lgm = {
        ...ex_lgm,
        node: p.node.toLowerCase(),
        sector: sec,
        namespace: ns,
        graph_id: p.graph_id ?? null,
        stored_at: (0, utils_1.now)(),
        mode: "langgraph",
        ...ext,
    };
    return base;
};
const matches_ns = (meta, ns, gid) => {
    const lgm = meta?.lgm;
    if (!lgm)
        return false;
    if (lgm.namespace !== ns)
        return false;
    if (gid && lgm.graph_id !== gid)
        return false;
    return true;
};
const hydrate_mem_row = async (row, meta, inc_meta, score, path) => {
    const tags = safe_parse(row.tags, []);
    const vecs = await db_1.vector_store.getVectorsById(row.id);
    const secs = vecs.map((v) => v.sector);
    const mem = {
        id: row.id,
        node: meta?.lgm
            ?.node || row.primary_sector,
        content: row.content,
        primary_sector: row.primary_sector,
        sectors: secs,
        tags,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_seen_at: row.last_seen_at,
        salience: row.salience,
        decay_lambda: row.decay_lambda,
        version: row.version,
    };
    if (typeof score === "number")
        mem.score = score;
    if (path)
        mem.path = path;
    if (inc_meta)
        mem.metadata = meta;
    return mem;
};
const build_refl_content = (p, ns) => {
    const parts = [
        `LangGraph reflection for node "${p.node}"`,
        `namespace=${ns}`,
    ];
    if (p.graph_id)
        parts.push(`graph=${p.graph_id}`);
    return `${parts.join(" | ")}\n\n${trunc(p.content, 480)}`;
};
const create_auto_refl = async (p, stored) => {
    const refl_tags = build_tags([`lgm:auto:reflection`, `lgm:source:${stored.id}`], "reflect", stored.namespace, stored.graph_id ?? undefined);
    const refl_meta = {
        lgm: {
            node: "reflect",
            sector: "reflective",
            namespace: stored.namespace,
            graph_id: stored.graph_id,
            stored_at: (0, utils_1.now)(),
            mode: "langgraph",
            source_memory: stored.id,
            source_node: p.node.toLowerCase(),
        },
    };
    const res = await (0, hsg_1.add_hsg_memory)(build_refl_content(p, stored.namespace), (0, utils_1.j)(refl_tags), refl_meta, p.user_id);
    return {
        id: res.id,
        node: "reflect",
        primary_sector: res.primary_sector,
        sectors: res.sectors,
        namespace: stored.namespace,
        graph_id: stored.graph_id,
        tags: refl_tags,
        chunks: res.chunks ?? 1,
        metadata: refl_meta,
    };
};
async function store_node_mem(p) {
    if (!p?.node || !p?.content)
        throw new Error("node and content are required");
    const ns = resolve_ns(p.namespace);
    const node = p.node.toLowerCase();
    const sec = resolve_sector(node);
    const tag_list = build_tags(p.tags, node, ns, p.graph_id);
    const meta = build_meta(p, sec, ns);
    const res = await (0, hsg_1.add_hsg_memory)(p.content, (0, utils_1.j)(tag_list), meta, p.user_id);
    const stored = {
        id: res.id,
        node,
        primary_sector: res.primary_sector,
        sectors: res.sectors,
        namespace: ns,
        graph_id: p.graph_id ?? null,
        tags: tag_list,
        chunks: res.chunks ?? 1,
        metadata: meta,
    };
    const refl_set = p.reflective ?? cfg_1.env.lg_reflective;
    const refl = refl_set && node !== "reflect"
        ? await create_auto_refl(p, stored)
        : null;
    return { memory: stored, reflection: refl };
}
async function retrieve_node_mems(p) {
    if (!p?.node)
        throw new Error("node is required");
    const ns = resolve_ns(p.namespace);
    const node = p.node.toLowerCase();
    const sec = resolve_sector(node);
    const lim = p.limit || cfg_1.env.lg_max_context;
    const inc_meta = p.include_metadata ?? false;
    const gid = p.graph_id;
    const items = [];
    if (p.query) {
        const matches = await (0, hsg_1.hsg_query)(p.query, Math.max(lim * 2, lim), {
            sectors: [sec],
        });
        for (const match of matches) {
            const row = (await db_1.q.get_mem.get(match.id));
            if (!row)
                continue;
            const meta = safe_parse(row.meta, {});
            if (!matches_ns(meta, ns, gid))
                continue;
            const hyd = await hydrate_mem_row(row, meta, inc_meta, match.score, match.path);
            items.push(hyd);
            if (items.length >= lim)
                break;
        }
    }
    else {
        const raw_rows = (await db_1.q.all_mem_by_sector.all(sec, lim * 4, 0));
        for (const row of raw_rows) {
            const meta = safe_parse(row.meta, {});
            if (!matches_ns(meta, ns, gid))
                continue;
            const hyd = await hydrate_mem_row(row, meta, inc_meta);
            items.push(hyd);
            if (items.length >= lim)
                break;
        }
        items.sort((a, b) => b.last_seen_at - a.last_seen_at);
    }
    return {
        node,
        sector: sec,
        namespace: ns,
        graph_id: gid ?? null,
        query: p.query || null,
        count: items.length,
        items,
    };
}
async function get_graph_ctx(p) {
    const ns = resolve_ns(p.namespace);
    const gid = p.graph_id;
    const lim = p.limit || cfg_1.env.lg_max_context;
    const nodes = Object.keys(exports.node_sector_map);
    const per_node_lim = Math.max(1, Math.floor(lim / nodes.length) || 1);
    const node_ctxs = [];
    for (const node of nodes) {
        const res = await retrieve_node_mems({
            node,
            namespace: ns,
            graph_id: gid,
            limit: per_node_lim,
            include_metadata: true,
        });
        node_ctxs.push({ node, sector: res.sector, items: res.items });
    }
    const flat = node_ctxs.flatMap((e) => e.items.map((i) => ({
        node: e.node,
        content: trunc(i.content, summary_line_limit),
    })));
    const summ = flat.length
        ? flat
            .slice(0, lim)
            .map((ln) => `- [${ln.node}] ${ln.content}`)
            .join("\n")
        : "";
    return {
        namespace: ns,
        graph_id: gid ?? null,
        limit: lim,
        nodes: node_ctxs,
        summary: summ,
    };
}
const build_ctx_refl = async (ns, gid) => {
    const ctx = await get_graph_ctx({
        namespace: ns,
        graph_id: gid,
        limit: cfg_1.env.lg_max_context,
    });
    const lns = ctx.nodes.flatMap((e) => e.items.map((i) => ({
        node: e.node,
        content: trunc(i.content, summary_line_limit),
    })));
    if (!lns.length)
        return null;
    const hdr = `Reflection synthesized from LangGraph context (namespace=${ns}${gid ? `, graph=${gid}` : ""})`;
    const body = lns
        .slice(0, cfg_1.env.lg_max_context)
        .map((ln, idx) => `${idx + 1}. [${ln.node}] ${ln.content}`)
        .join("\n");
    return `${hdr}\n\n${body}`;
};
async function create_refl(p) {
    const ns = resolve_ns(p.namespace);
    const node = (p.node || "reflect").toLowerCase();
    const base_content = p.content || (await build_ctx_refl(ns, p.graph_id));
    if (!base_content)
        throw new Error("reflection content could not be derived");
    const tags = [
        `lgm:manual:reflection`,
        ...(p.context_ids?.map((id) => `lgm:context:${id}`) || []),
    ];
    const meta = {
        lgm_context_ids: p.context_ids || [],
    };
    const res = await store_node_mem({
        node,
        content: base_content,
        namespace: ns,
        graph_id: p.graph_id,
        tags,
        metadata: meta,
        reflective: false,
    });
    return res;
}
const get_lg_cfg = () => ({
    mode: cfg_1.env.mode,
    namespace_default: cfg_1.env.lg_namespace,
    max_context: cfg_1.env.lg_max_context,
    reflective: cfg_1.env.lg_reflective,
    node_sector_map: exports.node_sector_map,
});
exports.get_lg_cfg = get_lg_cfg;
