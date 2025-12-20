const fs = require('fs'),
  p = require('path');
class Z {
  constructor(c) {
    this.c = c;
    this.k = c.k;
    this.u = c.u || 'https://api.getzep.com';
    this.rl = c.rl || 1;
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
      const r = await this.f('/api/v2/sessions?limit=1');
      return { ok: true, ses: r.total || 0 };
    } catch (e) {
      throw new Error(`Zep conn fail: ${e.message}`);
    }
  }
  async exp() {
    const o = p.join(this.c.o, 'zep_export.jsonl'),
      w = fs.createWriteStream(o);
    console.log('[ZEP] Listing sessions...');
    const ss = await this.fss();
    console.log(`[ZEP] Found ${ss.length} sessions`);
    let tm = 0,
      tc = 0;
    for (let i = 0; i < ss.length; i++) {
      const s = ss[i];
      tc++;
      if (tc % 100 === 0)
        console.log(`[ZEP] Progress: ${tc}/${ss.length} sessions`);
      const mm = await this.fsm(s.session_id);
      for (const m of mm) {
        w.write(JSON.stringify(this.n(m, s)) + '\n');
        tm++;
      }
    }
    w.end();
    console.log(`[ZEP] Exported ${tm} memories from ${tc} sessions`);
    return o;
  }
  async fss() {
    const ss = [];
    let pg = 1,
      l = 100;
    while (true) {
      await this.w();
      const r = await this.f(`/api/v2/sessions?page=${pg}&limit=${l}`),
        b = r.sessions || [];
      if (!b.length) break;
      ss.push(...b);
      pg++;
      if (b.length < l) break;
    }
    return ss;
  }
  async fsm(sid) {
    try {
      await this.w();
      const r = await this.f(`/api/v2/sessions/${sid}/memory`);
      return r.messages || r.memories || [];
    } catch (e) {
      console.warn(`[ZEP] Warn: session ${sid.slice(0, 8)} no memories`);
      return [];
    }
  }
  n(m, s) {
    return {
      id: m.uuid || m.id || `${s.session_id}_${Date.now()}`,
      uid: s.user_id || s.session_id || 'default',
      c: m.content || m.text || '',
      t: m.metadata?.tags || [],
      meta: {
        p: 'zep',
        sid: s.session_id,
        r: m.role,
        tc: m.token_count,
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
        const rt = r.headers.get('retry-after') || 60;
        console.warn(`[ZEP] Rate limit, waiting ${rt}s...`);
        await new Promise((x) => setTimeout(x, rt * 1000));
        return this.f(ep);
      }
      throw new Error(`HTTP ${r.status}`);
    }
    return await r.json();
  }
}
module.exports = Z;
