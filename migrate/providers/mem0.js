const fs = require('fs'),
  p = require('path');
class M {
  constructor(c) {
    this.c = c;
    this.k = c.k;
    this.u = c.u || 'https://api.mem0.ai';
    this.rl = c.rl || 20;
    this.h = {
      Authorization: `Token ${this.k}`,
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
      console.log('[MEM0] Fetching users/entities...');
      const uu = await this.fau();
      console.log(`[MEM0] Found ${uu.length} users`);
      let tm = 0;
      for (const u of uu.slice(0, 3)) {
        const mm = await this.fum(u.user_id);
        tm += mm.length;
      }
      return { ok: true, u: uu.length, m: tm };
    } catch (e) {
      throw new Error(`Mem0 conn fail: ${e.message}`);
    }
  }
  async exp() {
    const o = p.join(this.c.o, 'mem0_export.jsonl'),
      w = fs.createWriteStream(o);
    console.log('[MEM0] Fetching users/entities...');
    const uu = await this.fau();
    console.log(`[MEM0] Found ${uu.length} users`);
    let tm = 0,
      tu = 0;
    for (const u of uu) {
      tu++;
      if (tu % 10 === 0)
        console.log(`[MEM0] Processing user ${tu}/${uu.length}...`);
      const mm = await this.fum(u.user_id);
      for (const m of mm) {
        w.write(JSON.stringify(this.n(m)) + '\n');
        tm++;
      }
    }
    w.end();
    console.log(`[MEM0] Exported ${tm} memories from ${tu} users`);
    return o;
  }
  async fau() {
    const uu = [];
    let pg = 1,
      l = 100;
    while (true) {
      await this.w();
      try {
        const r = await this.f(`/v1/entities/users?page=${pg}&limit=${l}`),
          b = r.users || r.results || [];
        if (!b.length) break;
        uu.push(...b);
        pg++;
        if (b.length < l) break;
      } catch (e) {
        console.warn(`[MEM0] Could not fetch users: ${e.message}`);
        break;
      }
    }
    return uu.length > 0 ? uu : [{ user_id: 'default' }];
  }
  async fum(uid) {
    const mm = [];
    let pg = 1,
      l = 100;
    while (true) {
      await this.w();
      try {
        const r = await this.f(
            `/v1/memories?user_id=${uid}&page=${pg}&limit=${l}`,
          ),
          b = r.memories || r.results || [];
        if (!b.length) break;
        mm.push(...b);
        pg++;
        if (b.length < l) break;
      } catch (e) {
        console.warn(
          `[MEM0] Failed fetching memories for user ${uid}: ${e.message}`,
        );
        break;
      }
    }
    return mm;
  }
  n(m) {
    return {
      id: m.id || m.memory_id || `mem0_${Date.now()}`,
      uid: m.user_id || 'default',
      c: m.text || m.content || m.data?.text || '',
      t: m.tags || m.categories || [],
      meta: {
        p: 'mem0',
        cat: m.category,
        om: m.metadata || {},
      },
      ca: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
      ls: m.updated_at ? new Date(m.updated_at).getTime() : Date.now(),
      e: m.embedding || null,
    };
  }
  async f(ep) {
    const u = `${this.u}${ep}`,
      r = await fetch(u, { method: 'GET', headers: this.h });
    if (!r.ok) {
      if (r.status === 429) {
        const rt = r.headers.get('retry-after') || 3;
        console.warn(`[MEM0] Rate limit, waiting ${rt}s...`);
        await new Promise((x) => setTimeout(x, rt * 1000));
        return this.f(ep);
      }
      const txt = await r.text().catch(() => 'No response body');
      throw new Error(`HTTP ${r.status}: ${txt}`);
    }
    return await r.json();
  }
}
module.exports = M;
