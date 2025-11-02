import { compressionEngine, CompressionMetrics } from '../../ops/compress';

export function compression(app: any) {
    app.post('/api/compression/compress', async (req: any, res: any) => {
        try {
            const { text, algorithm } = req.body;
            if (!text) return res.status(400).json({ error: 'text required' });
            let r;
            if (algorithm && ['semantic', 'syntactic', 'aggressive'].includes(algorithm)) {
                r = compressionEngine.compress(text, algorithm);
            } else {
                r = compressionEngine.auto(text);
            }
            res.json({ ok: true, comp: r.comp, m: r.metrics, hash: r.hash });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/compression/batch', async (req: any, res: any) => {
        try {
            const { texts, algorithm = 'semantic' } = req.body;
            if (!Array.isArray(texts)) return res.status(400).json({ error: 'texts must be array' });
            if (!['semantic', 'syntactic', 'aggressive'].includes(algorithm)) return res.status(400).json({ error: 'invalid algo' });
            const r = compressionEngine.batch(texts, algorithm);
            res.json({ ok: true, results: r.map((x: any) => ({ comp: x.comp, m: x.metrics, hash: x.hash })), total: r.reduce((s: any, x: any) => s + x.metrics.saved, 0) });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/compression/analyze', async (req: any, res: any) => {
        try {
            const { text } = req.body;
            if (!text) return res.status(400).json({ error: 'text required' });
            const a = compressionEngine.analyze(text);
            let best = 'semantic';
            let max = 0;
            for (const [algo, m] of Object.entries(a)) {
                const met = m as CompressionMetrics;
                if (met.pct > max) {
                    max = met.pct;
                    best = algo;
                }
            }
            res.json({ ok: true, analysis: a, rec: { algo: best, save: (a as any)[best].pct.toFixed(2) + '%', lat: (a as any)[best].latency.toFixed(2) + 'ms' } });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/compression/stats', async (req: any, res: any) => {
        try {
            const s = compressionEngine.getStats();
            res.json({
                ok: true,
                stats: {
                    ...s,
                    avgRatio: (s.avgRatio * 100).toFixed(2) + '%',
                    totalPct: s.ogTok > 0 ? ((s.saved / s.ogTok) * 100).toFixed(2) + '%' : '0%',
                    lat: s.latency.toFixed(2) + 'ms',
                    avgLat: s.total > 0 ? (s.latency / s.total).toFixed(2) + 'ms' : '0ms'
                }
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/compression/reset', async (req: any, res: any) => {
        try {
            compressionEngine.reset();
            compressionEngine.clear();
            res.json({ ok: true, msg: 'reset done' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });
}
