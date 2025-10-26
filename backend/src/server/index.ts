const server = require('./server.js');
import { env } from '../config';
import { q } from '../database';
import { now, rid, j, p } from '../utils';
import { addHSGMemory, hsgQuery, reinforceMemory, updateMemory, runDecayProcess, pruneWeakWaypoints, SECTORS, SECTOR_CONFIGS } from '../hsg';
import { getEmbeddingInfo } from '../embedding';
import { ingestDocument, ingestURL } from '../ingestion';
import { registerLangGraphEndpoints } from '../langgraph';
import { registerMcpEndpoints } from '../mcp';
import type { add_req, q_req, ingest_req, ingest_url_req } from '../types';

const app = server();

app.use((req: any, res: any, next: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use((req: any, res: any, next: any) => {
  if (!env.api_key) return next();
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ') || h.slice(7) !== env.api_key) {
    return res.status(401).json({ err: 'auth' });
  }
  next();
});
app.get('/health', async (req: any, res: any) => {
  res.json({
    ok: true,
    version: '2.0-hsg',
    embedding: getEmbeddingInfo(),
  });
});

app.get('/sectors', async (req: any, res: any) => {
  try {
    const { allAsync } = await import('../database');
    const stats = await allAsync(`
            select primary_sector as sector, count(*) as count, avg(salience) as avg_salience
            from memories
            group by primary_sector
        `);
    res.json({
      sectors: Object.keys(SECTOR_CONFIGS),
      configs: SECTOR_CONFIGS,
      stats,
    });
  } catch (error) {
    res.status(500).json({ err: 'internal' });
  }
});
app.post('/memory/add', async (req: any, res: any) => {
  const b = req.body as add_req;
  if (!b?.content) return res.status(400).json({ err: 'content' });
  try {
    const result = await addHSGMemory(b.content, j(b.tags || []), b.metadata);
    res.json(result);
  } catch (error) {
    console.error('Error adding HSG memory:', error);
    res.status(500).json({ err: 'internal' });
  }
});
app.post('/memory/ingest', async (req: any, res: any) => {
  const b = req.body as ingest_req;
  if (!b?.content_type || !b?.data) {
    return res.status(400).json({ err: 'missing_params' });
  }
  try {
    const result = await ingestDocument(b.content_type, b.data, b.metadata, b.config);
    res.json(result);
  } catch (error) {
    console.error('Error ingesting document:', error);
    res.status(500).json({
      err: 'ingestion_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
app.post('/memory/ingest/url', async (req: any, res: any) => {
  const b = req.body as ingest_url_req;
  if (!b?.url) {
    return res.status(400).json({ err: 'missing_url' });
  }
  try {
    const result = await ingestURL(b.url, b.metadata, b.config);
    res.json(result);
  } catch (error) {
    console.error('Error ingesting URL:', error);
    res.status(500).json({
      err: 'url_ingestion_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
app.post('/memory/query', async (req: any, res: any) => {
  const b = req.body as q_req;
  const k = b.k || 8;
  try {
    const filters = {
      sectors: b.filters?.sector ? [b.filters.sector] : undefined,
      minSalience: b.filters?.min_score,
    };
    const matches = await hsgQuery(b.query, k, filters);
    res.json({
      query: b.query,
      matches: matches.map((m) => ({
        id: m.id,
        content: m.content,
        score: m.score,
        sectors: m.sectors,
        primary_sector: m.primary_sector,
        path: m.path,
        salience: m.salience,
        last_seen_at: m.last_seen_at,
      })),
    });
  } catch (error) {
    console.error('Error in HSG query:', error);
    res.json({ query: b.query, matches: [] });
  }
});
app.post('/memory/reinforce', async (req: any, res: any) => {
  const b = req.body as { id: string; boost?: number };
  if (!b?.id) return res.status(400).json({ err: 'id' });
  try {
    await reinforceMemory(b.id, b.boost);
    res.json({ ok: true });
  } catch (error) {
    res.status(404).json({ err: 'nf' });
  }
});
app.patch('/memory/:id', async (req: any, res: any) => {
  const id = (req.params as any).id;
  const b = req.body as { content?: string; tags?: string[]; metadata?: any };
  if (!id) return res.status(400).json({ err: 'id' });
  try {
    const result = await updateMemory(id, b.content, b.tags, b.metadata);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ err: 'nf' });
    } else {
      console.error('Error updating memory:', error);
      res.status(500).json({ err: 'internal' });
    }
  }
});
app.get('/memory/all', async (req: any, res: any) => {
  try {
    const u = (req.query as any).u ? parseInt((req.query as any).u) : 0;
    const l = (req.query as any).l ? parseInt((req.query as any).l) : 100;
    const sector = (req.query as any).sector;
    const rawRows = sector ? await q.all_mem_by_sector.all(sector, l, u) : await q.all_mem.all(l, u);
    const rows = rawRows.map((r: any) => ({
      id: r.id,
      content: r.content,
      tags: p(r.tags),
      metadata: p(r.meta),
      created_at: r.created_at,
      updated_at: r.updated_at,
      last_seen_at: r.last_seen_at,
      salience: r.salience,
      decay_lambda: r.decay_lambda,
      primary_sector: r.primary_sector,
      version: r.version,
    }));
    res.json({ items: rows });
  } catch (error) {
    res.status(500).json({ err: 'internal' });
  }
});
app.get('/memory/:id', async (req: any, res: any) => {
  try {
    const id = (req.params as any).id;
    const memory = await q.get_mem.get(id);
    if (!memory) return res.status(404).json({ err: 'nf' });

    const vectors = await q.get_vecs_by_id.all(id);
    const sectors = vectors.map((v) => v.sector);

    res.json({
      id: memory.id,
      content: memory.content,
      primary_sector: memory.primary_sector,
      sectors,
      tags: p(memory.tags),
      metadata: p(memory.meta),
      created_at: memory.created_at,
      updated_at: memory.updated_at,
      last_seen_at: memory.last_seen_at,
      salience: memory.salience,
      decay_lambda: memory.decay_lambda,
      version: memory.version,
    });
  } catch (error) {
    res.status(500).json({ err: 'internal' });
  }
});
app.delete('/memory/:id', async (req: any, res: any) => {
  try {
    const id = (req.params as any).id;
    const r = await q.get_mem.get(id);
    if (!r) return res.status(404).json({ err: 'nf' });
    await q.del_mem.run(id);
    await q.del_vec.run(id);
    await q.del_fts.run(id);
    await q.del_waypoints.run(id, id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ err: 'internal' });
  }
});
registerMcpEndpoints(app);
if (env.mode === 'langgraph') {
  console.log('[LGM] LangGraph integration mode enabled');
  registerLangGraphEndpoints(app);
}
const DECAY_INTERVAL = 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL = 7 * 24 * 60 * 60 * 1000;
setInterval(async () => {
  console.log('🧠 Running HSG decay process...');
  try {
    const result = await runDecayProcess();
    console.log(`✅ Decay completed: ${result.decayed}/${result.processed} memories updated`);
  } catch (error) {
    console.error('❌ Decay process failed:', error);
  }
}, DECAY_INTERVAL);
setInterval(async () => {
  console.log('🔗 Pruning weak waypoints...');
  try {
    const pruned = await pruneWeakWaypoints();
    console.log(`✅ Pruned ${pruned} weak waypoints`);
  } catch (error) {
    console.error('❌ Waypoint pruning failed:', error);
  }
}, PRUNE_INTERVAL);
runDecayProcess()
  .then((result) => {
    console.log(`🚀 Initial decay: ${result.decayed}/${result.processed} memories updated`);
  })
  .catch(console.error);
console.log(`?? OpenMemory server starting on port ${env.port}`);
const httpServer = app.listen(env.port, () => {
  console.log(`? Server running on http://localhost:${env.port}`);
});

// Allow long-running ingestion requests without Node's default 5 minute timeout
httpServer.requestTimeout = 0;
httpServer.headersTimeout = 0;
