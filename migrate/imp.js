const fs = require('fs'),
  rl = require('readline'),
  p = require('path');
class I {
  constructor(c) {
    this.c = c;
    const port = process.env.OM_PORT || '8080';
    this.u = c.omu || process.env.OPENMEMORY_URL || `http://localhost:${port}`;
    this.k =
      c.omk || process.env.OPENMEMORY_API_KEY || process.env.OM_API_KEY || '';
    this.h = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.k}`,
    };
  }
  async imp(f) {
    const t0 = Date.now();
    let mc = 0,
      fc = 0;
    const rd = rl.createInterface({
      input: fs.createReadStream(f),
      crlfDelay: Infinity,
    });
    console.log('[IMPORT] Processing export file...');
    console.log(`[IMPORT] Target: ${this.u}`);
    for await (const ln of rd) {
      try {
        const d = JSON.parse(ln);
        await this.pm(d);
        mc++;
        if (mc % 100 === 0)
          console.log(`[IMPORT] Progress: ${mc} memories imported`);
      } catch (e) {
        fc++;
        console.error(`[IMPORT] Warning: Skipped record - ${e.message}`);
      }
    }
    rd.close();
    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    return { m: mc, f: fc, d: dur };
  }
  async pm(d) {
    const payload = {
      content: d.c,
      tags: d.t || [],
      metadata: {
        ...d.meta,
        migrated: true,
        orig_id: d.id,
        orig_created_at: d.ca,
        orig_last_seen: d.ls,
      },
    };
    if (d.uid && d.uid !== 'default') payload.user_id = d.uid;
    const r = await fetch(`${this.u}/memory/add`, {
      method: 'POST',
      headers: this.h,
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => 'No response');
      throw new Error(`API ${r.status}: ${txt}`);
    }
    return await r.json();
  }
}
module.exports = I;
