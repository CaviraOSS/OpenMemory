"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mem = mem;
const db_1 = require("../../core/db");
const utils_1 = require("../../utils");
const hsg_1 = require("../../memory/hsg");
const ingest_1 = require("../../ops/ingest");
const user_summary_1 = require("../../memory/user_summary");
const tenant_1 = require("../../core/tenant");
function mem(app) {
    app.post("/memory/add", async (req, res) => {
        const b = req.body;
        if (!b?.content)
            return res.status(400).json({ err: "content" });
        const tenant_id = (0, tenant_1.getTenantId)(req);
        try {
            const m = await (0, hsg_1.add_hsg_memory)(b.content, (0, utils_1.j)(b.tags || []), b.metadata, b.user_id, tenant_id);
            res.json(m);
            if (b.user_id) {
                (0, user_summary_1.update_user_summary)(b.user_id).catch((e) => console.error("[mem] user summary update failed:", e));
            }
        }
        catch (e) {
            res.status(500).json({ err: e.message });
        }
    });
    app.post("/memory/ingest", async (req, res) => {
        const b = req.body;
        if (!b?.content_type || !b?.data)
            return res.status(400).json({ err: "missing" });
        try {
            const r = await (0, ingest_1.ingestDocument)(b.content_type, b.data, b.metadata, b.config, b.user_id);
            res.json(r);
        }
        catch (e) {
            res.status(500).json({ err: "ingest_fail", msg: e.message });
        }
    });
    app.post("/memory/ingest/url", async (req, res) => {
        const b = req.body;
        if (!b?.url)
            return res.status(400).json({ err: "no_url" });
        try {
            const r = await (0, ingest_1.ingestURL)(b.url, b.metadata, b.config, b.user_id);
            res.json(r);
        }
        catch (e) {
            res.status(500).json({ err: "url_fail", msg: e.message });
        }
    });
    app.post("/memory/query", async (req, res) => {
        const b = req.body;
        const k = b.k || 8;
        const tenant_id = (0, tenant_1.getTenantId)(req);
        try {
            const f = {
                sectors: b.filters?.sector ? [b.filters.sector] : undefined,
                minSalience: b.filters?.min_score,
                user_id: b.filters?.user_id || b.user_id,
                tenant_id: tenant_id,
                startTime: b.filters?.startTime,
                endTime: b.filters?.endTime,
            };
            const m = await (0, hsg_1.hsg_query)(b.query, k, f);
            res.json({
                query: b.query,
                matches: m.map((x) => ({
                    id: x.id,
                    content: x.content,
                    score: x.score,
                    sectors: x.sectors,
                    primary_sector: x.primary_sector,
                    path: x.path,
                    salience: x.salience,
                    last_seen_at: x.last_seen_at,
                })),
            });
        }
        catch (e) {
            res.json({ query: b.query, matches: [] });
        }
    });
    app.post("/memory/reinforce", async (req, res) => {
        const b = req.body;
        if (!b?.id)
            return res.status(400).json({ err: "id" });
        try {
            await (0, hsg_1.reinforce_memory)(b.id, b.boost);
            res.json({ ok: true });
        }
        catch (e) {
            res.status(404).json({ err: "nf" });
        }
    });
    app.patch("/memory/:id", async (req, res) => {
        const id = req.params.id;
        const b = req.body;
        if (!id)
            return res.status(400).json({ err: "id" });
        const tenant_id = (0, tenant_1.getTenantId)(req);
        try {
            // Check if memory exists and user has permission
            const m = await db_1.q.get_mem.get(id);
            if (!m)
                return res.status(404).json({ err: "nf" });
            // Check user ownership if user_id is provided
            if (b.user_id && m.user_id !== b.user_id) {
                return res.status(403).json({ err: "forbidden" });
            }
            const r = await (0, hsg_1.update_memory)(id, b.content, b.tags, b.metadata, tenant_id);
            res.json(r);
        }
        catch (e) {
            if (e.message.includes("not found")) {
                res.status(404).json({ err: "nf" });
            }
            else {
                res.status(500).json({ err: "internal" });
            }
        }
    });
    app.get("/memory/all", async (req, res) => {
        try {
            const u = req.query.u ? parseInt(req.query.u) : 0;
            const l = req.query.l ? parseInt(req.query.l) : 100;
            const s = req.query.sector;
            const user_id = req.query.user_id;
            let r;
            if (user_id) {
                // Filter by user_id
                r = await db_1.q.all_mem_by_user.all(user_id, l, u);
            }
            else if (s) {
                // Filter by sector
                r = await db_1.q.all_mem_by_sector.all(s, l, u);
            }
            else {
                // No filter
                r = await db_1.q.all_mem.all(l, u);
            }
            const i = r.map((x) => ({
                id: x.id,
                content: x.content,
                tags: (0, utils_1.p)(x.tags),
                metadata: (0, utils_1.p)(x.meta),
                created_at: x.created_at,
                updated_at: x.updated_at,
                last_seen_at: x.last_seen_at,
                salience: x.salience,
                decay_lambda: x.decay_lambda,
                primary_sector: x.primary_sector,
                version: x.version,
                user_id: x.user_id,
            }));
            res.json({ items: i });
        }
        catch (e) {
            res.status(500).json({ err: "internal" });
        }
    });
    app.get("/memory/:id", async (req, res) => {
        try {
            const id = req.params.id;
            const user_id = req.query.user_id;
            const tenant_id = (0, tenant_1.getTenantId)(req);
            const m = await db_1.q.get_mem.get(id);
            if (!m)
                return res.status(404).json({ err: "nf" });
            // Check user ownership if user_id is provided
            if (user_id && m.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }
            const v = await db_1.vector_store.getVectorsById(id, tenant_id);
            const sec = v.map((x) => x.sector);
            res.json({
                id: m.id,
                content: m.content,
                primary_sector: m.primary_sector,
                sectors: sec,
                tags: (0, utils_1.p)(m.tags),
                metadata: (0, utils_1.p)(m.meta),
                created_at: m.created_at,
                updated_at: m.updated_at,
                last_seen_at: m.last_seen_at,
                salience: m.salience,
                decay_lambda: m.decay_lambda,
                version: m.version,
                user_id: m.user_id,
            });
        }
        catch (e) {
            res.status(500).json({ err: "internal" });
        }
    });
    app.delete("/memory/:id", async (req, res) => {
        try {
            const id = req.params.id;
            const user_id = req.query.user_id || req.body?.user_id;
            const tenant_id = (0, tenant_1.getTenantId)(req);
            const m = await db_1.q.get_mem.get(id);
            if (!m)
                return res.status(404).json({ err: "nf" });
            // Check user ownership if user_id is provided
            if (user_id && m.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }
            await db_1.q.del_mem.run(id);
            await db_1.vector_store.deleteVectors(id, tenant_id);
            await db_1.q.del_waypoints.run(id, id);
            res.json({ ok: true });
        }
        catch (e) {
            res.status(500).json({ err: "internal" });
        }
    });
}
