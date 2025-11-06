class V {
  constructor(c) {
    const port = process.env.OM_PORT || '8080';
    this.u = c.omu || `http://localhost:${port}`;
    this.k = c.omk || process.env.OM_API_KEY || '';
    this.h = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.k}`,
    };
  }
  async ver(st) {
    const w = [];
    try {
      console.log('[VERIFY] Checking memory count via API...');
      const r = await fetch(`${this.u}/memory/search`, {
        method: 'POST',
        headers: this.h,
        body: JSON.stringify({ query: '', limit: 10000 }),
      });
      if (!r.ok) {
        return {
          ok: false,
          w: [`API verification unavailable: ${r.status}`],
        };
      }
      const d = await r.json();
      const mc = d.memories?.length || 0;
      console.log(`[VERIFY] Found ${mc} memories in OpenMemory`);
      if (Math.abs(mc - st.m) > st.m * 0.05)
        w.push(`Memory count mismatch: expected ${st.m}, got ${mc}`);
      console.log('[VERIFY] Checking for duplicates...');
      const dups = await this.chkdup(d.memories || []);
      if (dups > mc * 0.01)
        w.push(`High duplicate rate: ${((dups / mc) * 100).toFixed(1)}%`);
      return { ok: w.length === 0, w };
    } catch (e) {
      return { ok: false, w: [`Verification failed: ${e.message}`] };
    }
  }
  async chkdup(mm) {
    const h = new Set();
    let d = 0;
    for (const m of mm) {
      const hh = this.hash(m.content);
      if (h.has(hh)) d++;
      else h.add(hh);
    }
    return d;
  }
  hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  }
}
module.exports = V;
