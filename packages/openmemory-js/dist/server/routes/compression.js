"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compression = compression;
const compress_1 = require("../../ops/compress");
function compression(app) {
    app.post("/api/compression/compress", async (req, res) => {
        try {
            const { text, algorithm } = req.body;
            if (!text)
                return res.status(400).json({ error: "text required" });
            let r;
            if (algorithm &&
                ["semantic", "syntactic", "aggressive"].includes(algorithm)) {
                r = compress_1.compressionEngine.compress(text, algorithm);
            }
            else {
                r = compress_1.compressionEngine.auto(text);
            }
            res.json({ ok: true, comp: r.comp, m: r.metrics, hash: r.hash });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post("/api/compression/batch", async (req, res) => {
        try {
            const { texts, algorithm = "semantic" } = req.body;
            if (!Array.isArray(texts))
                return res.status(400).json({ error: "texts must be array" });
            if (!["semantic", "syntactic", "aggressive"].includes(algorithm))
                return res.status(400).json({ error: "invalid algo" });
            const r = compress_1.compressionEngine.batch(texts, algorithm);
            res.json({
                ok: true,
                results: r.map((x) => ({
                    comp: x.comp,
                    m: x.metrics,
                    hash: x.hash,
                })),
                total: r.reduce((s, x) => s + x.metrics.saved, 0),
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post("/api/compression/analyze", async (req, res) => {
        try {
            const { text } = req.body;
            if (!text)
                return res.status(400).json({ error: "text required" });
            const a = compress_1.compressionEngine.analyze(text);
            let best = "semantic";
            let max = 0;
            for (const [algo, m] of Object.entries(a)) {
                const met = m;
                if (met.pct > max) {
                    max = met.pct;
                    best = algo;
                }
            }
            res.json({
                ok: true,
                analysis: a,
                rec: {
                    algo: best,
                    save: a[best].pct.toFixed(2) + "%",
                    lat: a[best].latency.toFixed(2) + "ms",
                },
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get("/api/compression/stats", async (req, res) => {
        try {
            const s = compress_1.compressionEngine.getStats();
            res.json({
                ok: true,
                stats: {
                    ...s,
                    avgRatio: (s.avgRatio * 100).toFixed(2) + "%",
                    totalPct: s.ogTok > 0
                        ? ((s.saved / s.ogTok) * 100).toFixed(2) + "%"
                        : "0%",
                    lat: s.latency.toFixed(2) + "ms",
                    avgLat: s.total > 0
                        ? (s.latency / s.total).toFixed(2) + "ms"
                        : "0ms",
                },
            });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post("/api/compression/reset", async (req, res) => {
        try {
            compress_1.compressionEngine.reset();
            compress_1.compressionEngine.clear();
            res.json({ ok: true, msg: "reset done" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
