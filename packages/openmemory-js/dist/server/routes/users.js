"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usr = void 0;
const db_1 = require("../../core/db");
const utils_1 = require("../../utils");
const user_summary_1 = require("../../memory/user_summary");
const usr = (app) => {
    app.get("/users/:user_id/summary", async (req, res) => {
        try {
            const { user_id } = req.params;
            if (!user_id)
                return res.status(400).json({ error: "user_id required" });
            const user = await db_1.q.get_user.get(user_id);
            if (!user)
                return res.status(404).json({ error: "user not found" });
            res.json({
                user_id: user.user_id,
                summary: user.summary,
                reflection_count: user.reflection_count,
                updated_at: user.updated_at,
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    app.post("/users/:user_id/summary/regenerate", async (req, res) => {
        try {
            const { user_id } = req.params;
            if (!user_id)
                return res.status(400).json({ err: "user_id required" });
            await (0, user_summary_1.update_user_summary)(user_id);
            const user = await db_1.q.get_user.get(user_id);
            res.json({
                ok: true,
                user_id,
                summary: user?.summary,
                reflection_count: user?.reflection_count,
            });
        }
        catch (err) {
            res.status(500).json({ err: err.message });
        }
    });
    app.post("/users/summaries/regenerate-all", async (req, res) => {
        try {
            const result = await (0, user_summary_1.auto_update_user_summaries)();
            res.json({ ok: true, updated: result.updated });
        }
        catch (err) {
            res.status(500).json({ err: err.message });
        }
    });
    app.get("/users/:user_id/memories", async (req, res) => {
        try {
            const { user_id } = req.params;
            if (!user_id)
                return res.status(400).json({ err: "user_id required" });
            const l = req.query.l ? parseInt(req.query.l) : 100;
            const u = req.query.u ? parseInt(req.query.u) : 0;
            const r = await db_1.q.all_mem_by_user.all(user_id, l, u);
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
            }));
            res.json({ user_id, items: i });
        }
        catch (err) {
            res.status(500).json({ err: err.message });
        }
    });
    app.delete("/users/:user_id/memories", async (req, res) => {
        try {
            const { user_id } = req.params;
            if (!user_id)
                return res.status(400).json({ err: "user_id required" });
            const mems = await db_1.q.all_mem_by_user.all(user_id, 10000, 0);
            let deleted = 0;
            for (const m of mems) {
                await db_1.q.del_mem.run(m.id);
                await db_1.vector_store.deleteVectors(m.id);
                await db_1.q.del_waypoints.run(m.id, m.id);
                deleted++;
            }
            res.json({ ok: true, deleted });
        }
        catch (err) {
            res.status(500).json({ err: err.message });
        }
    });
};
exports.usr = usr;
