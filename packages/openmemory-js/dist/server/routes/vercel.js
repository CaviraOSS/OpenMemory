"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vercel = vercel;
const hsg_1 = require("../../memory/hsg");
const utils_1 = require("../../utils");
function vercel(app) {
    // Simple memory query endpoint for Vercel AI SDK adapters
    app.post("/query", async (req, res) => {
        try {
            const b = req.body || {};
            const query = String(b.query || "").slice(0, 4000);
            const user_id = b.user_id || req.query.user_id;
            const k = Math.max(1, Math.min(32, Number(b.k) || 8));
            if (!query)
                return res.status(400).json({ err: "query" });
            const startTime = b.startTime ? Number(b.startTime) : undefined;
            const endTime = b.endTime ? Number(b.endTime) : undefined;
            const matches = await (0, hsg_1.hsg_query)(query, k, { user_id, startTime, endTime });
            const lines = matches.map((m) => `- (${(m.score ?? 0).toFixed(2)}) ${m.content}`);
            const result = lines.join("\n");
            res.json({
                query,
                user_id: user_id || null,
                k,
                result,
                matches: matches.map((m) => ({
                    id: m.id,
                    content: m.content,
                    score: m.score,
                    sectors: m.sectors,
                    primary_sector: m.primary_sector,
                    last_seen_at: m.last_seen_at,
                })),
            });
        }
        catch (e) {
            res.status(500).json({ err: "internal", msg: e?.message || String(e) });
        }
    });
    // Simple memory store endpoint for chat transcripts or summaries
    app.post("/memories", async (req, res) => {
        try {
            const b = req.body || {};
            const content = String(b.content || "").trim();
            const user_id = b.user_id || req.query.user_id;
            const tags = Array.isArray(b.tags) ? b.tags : [];
            const metadata = b.metadata || undefined;
            if (!content)
                return res.status(400).json({ err: "content" });
            const r = await (0, hsg_1.add_hsg_memory)(content, (0, utils_1.j)(tags), metadata, user_id);
            res.json(r);
        }
        catch (e) {
            res.status(500).json({ err: "internal", msg: e?.message || String(e) });
        }
    });
}
