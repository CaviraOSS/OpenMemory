import { q } from '../../database';
import { now, rid, j, p } from '../../utils';
import { addHSGMemory, hsgQuery, reinforceMemory, updateMemory } from '../../hsg';
import { ingestDocument, ingestURL } from '../../ingestion';
import { env } from '../../config';
import type { add_req, q_req, ingest_req, ingest_url_req } from '../../types';

export function mem(app: any) {
    app.post('/memory/add', async (req: any, res: any) => {
        const b = req.body as add_req;
        if (!b?.content) return res.status(400).json({ err: 'content' });
        try {
            const m = await addHSGMemory(b.content, j(b.tags || []), b.metadata);
            res.json(m);
        } catch (e: any) {
            res.status(500).json({ err: e.message });
        }
    });

    app.post('/memory/ingest', async (req: any, res: any) => {
        const b = req.body as ingest_req;
        if (!b?.content_type || !b?.data) return res.status(400).json({ err: 'missing' });
        try {
            const r = await ingestDocument(b.content_type, b.data, b.metadata, b.config);
            res.json(r);
        } catch (e: any) {
            res.status(500).json({ err: 'ingest_fail', msg: e.message });
        }
    });

    app.post('/memory/ingest/url', async (req: any, res: any) => {
        const b = req.body as ingest_url_req;
        if (!b?.url) return res.status(400).json({ err: 'no_url' });
        try {
            const r = await ingestURL(b.url, b.metadata, b.config);
            res.json(r);
        } catch (e: any) {
            res.status(500).json({ err: 'url_fail', msg: e.message });
        }
    });

    app.post('/memory/query', async (req: any, res: any) => {
        const b = req.body as q_req;
        const k = b.k || 8;
        try {
            const f = {
                sectors: b.filters?.sector ? [b.filters.sector] : undefined,
                minSalience: b.filters?.min_score
            };
            const m = await hsgQuery(b.query, k, f);
            res.json({
                query: b.query,
                matches: m.map(x => ({
                    id: x.id,
                    content: x.content,
                    score: x.score,
                    sectors: x.sectors,
                    primary_sector: x.primary_sector,
                    path: x.path,
                    salience: x.salience,
                    last_seen_at: x.last_seen_at
                }))
            });
        } catch (e: any) {
            res.json({ query: b.query, matches: [] });
        }
    });

    app.post('/memory/reinforce', async (req: any, res: any) => {
        const b = req.body as { id: string; boost?: number };
        if (!b?.id) return res.status(400).json({ err: 'id' });
        try {
            await reinforceMemory(b.id, b.boost);
            res.json({ ok: true });
        } catch (e: any) {
            res.status(404).json({ err: 'nf' });
        }
    });

    app.patch('/memory/:id', async (req: any, res: any) => {
        const id = req.params.id;
        const b = req.body as { content?: string; tags?: string[]; metadata?: any };
        if (!id) return res.status(400).json({ err: 'id' });
        try {
            const r = await updateMemory(id, b.content, b.tags, b.metadata);
            res.json(r);
        } catch (e: any) {
            if (e.message.includes('not found')) {
                res.status(404).json({ err: 'nf' });
            } else {
                res.status(500).json({ err: 'internal' });
            }
        }
    });

    app.get('/memory/all', async (req: any, res: any) => {
        try {
            const u = req.query.u ? parseInt(req.query.u) : 0;
            const l = req.query.l ? parseInt(req.query.l) : 100;
            const s = req.query.sector;
            const r = s
                ? await q.all_mem_by_sector.all(s, l, u)
                : await q.all_mem.all(l, u);
            const i = r.map((x: any) => ({
                id: x.id,
                content: x.content,
                tags: p(x.tags),
                metadata: p(x.meta),
                created_at: x.created_at,
                updated_at: x.updated_at,
                last_seen_at: x.last_seen_at,
                salience: x.salience,
                decay_lambda: x.decay_lambda,
                primary_sector: x.primary_sector,
                version: x.version
            }));
            res.json({ items: i });
        } catch (e: any) {
            res.status(500).json({ err: 'internal' });
        }
    });

    app.get('/memory/:id', async (req: any, res: any) => {
        try {
            const id = req.params.id;
            const m = await q.get_mem.get(id);
            if (!m) return res.status(404).json({ err: 'nf' });
            const v = await q.get_vecs_by_id.all(id);
            const sec = v.map((x: any) => x.sector);
            res.json({
                id: m.id,
                content: m.content,
                primary_sector: m.primary_sector,
                sectors: sec,
                tags: p(m.tags),
                metadata: p(m.meta),
                created_at: m.created_at,
                updated_at: m.updated_at,
                last_seen_at: m.last_seen_at,
                salience: m.salience,
                decay_lambda: m.decay_lambda,
                version: m.version
            });
        } catch (e: any) {
            res.status(500).json({ err: 'internal' });
        }
    });

    app.delete('/memory/:id', async (req: any, res: any) => {
        try {
            const id = req.params.id;
            const m = await q.get_mem.get(id);
            if (!m) return res.status(404).json({ err: 'nf' });
            await q.del_mem.run(id);
            await q.del_vec.run(id);
            await q.del_waypoints.run(id, id);
            res.json({ ok: true });
        } catch (e: any) {
            res.status(500).json({ err: 'internal' });
        }
    });
}
