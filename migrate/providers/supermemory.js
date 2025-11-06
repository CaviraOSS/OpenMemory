const fs = require('fs'),
  p = require('path');
class S {
  constructor(c) {
    this.c = c;
    this.k = c.k;
    this.u = c.u || 'https://api.supermemory.ai';
    this.rl = c.rl || 5;
    this.h = {
      Authorization: `Bearer ${this.k}`,
      'Content-Type': 'application/json',
    };
    this.d = 1000 / this.rl;
    this.l = 0;
  }
  async w() {
    const n = Date.now(),
      e = this.l + this.d - n;
    if (e > 0) await new Promise((r) => setTimeout(r, e));
    this.l = Date.now();
  }
  async conn() {
    try {
      await this.w();
      const r = await this.f('/v3/documents?limit=1');
      return { ok: true, d: r.total || 0 };
    } catch (e) {
      throw new Error(`SM conn fail: ${e.message}`);
    }
  }
  async exp() {
    const o = p.join(this.c.o, 'supermemory_export.jsonl'),
      w = fs.createWriteStream(o);
    console.log('[SUPERMEMORY] Fetching all documents...');
    const dd = await this.fad();
    console.log(`[SUPERMEMORY] Found ${dd.length} documents`);
    let tc = 0;
    for (const d of dd) {
      w.write(JSON.stringify(this.n(d)) + '\n');
      tc++;
      if (tc % 500 === 0)
        console.log(`[SUPERMEMORY] Progress: ${tc}/${dd.length} documents`);
    }
    w.end();
    console.log(`[SUPERMEMORY] Exported ${tc} documents`);
    return o;
  }
  async fad() {
    const dd = [];
    let pg = 1,
      l = 100;
    while (true) {
      await this.w();
      const r = await this.f(`/v3/documents?page=${pg}&limit=${l}`),
        b = r.documents || r.data || [];
      if (!b.length) break;
      dd.push(...b);
      pg++;
      if (pg % 5 === 0)
        console.log(
          `[SUPERMEMORY] Fetched ${dd.length} documents (page ${pg})...`,
        );
      if (b.length < l) break;
    }
    return dd;
  }
  n(d) {
    return {
      id: d.id || d.document_id || `sm_${Date.now()}`,
      uid: d.user_id || d.owner_id || 'default',
      c: d.content || d.text || d.body || '',
      t: d.tags || d.labels || [],
      meta: {
        p: 'supermemory',
        src: d.source,
        url: d.url,
        om: d.metadata || {},
      },
      ca: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
      ls: d.updated_at ? new Date(d.updated_at).getTime() : Date.now(),
      e: d.embedding || null,
    };
  }
  async f(ep) {
    const u = `${this.u}${ep}`,
      r = await fetch(u, { method: 'GET', headers: this.h });
    if (!r.ok) {
      if (r.status === 429) {
        const rt = r.headers.get('retry-after') || 5;
        console.warn(`[SUPERMEMORY] Rate limit, waiting ${rt}s...`);
        await new Promise((x) => setTimeout(x, rt * 1000));
        return this.f(ep);
      }
      throw new Error(`HTTP ${r.status}`);
    }
    return await r.json();
  }
}
module.exports = S;
