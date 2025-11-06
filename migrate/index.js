#!/usr/bin/env node
const fs = require('fs'),
  p = require('path');
const ASC = `   ____                   __  __                                 
  / __ \\                 |  \\/  |                                
 | |  | |_ __   ___ _ __ | \\  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \\ / _ \\ '_ \\| |\\/| |/ _ \\ '_ \` _ \\ / _ \\| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \\____/| .__/ \\___|_| |_|_|  |_|\\___|_| |_| |_|\\___/|_|   \\__, |
        | |                                                 __/ |
        |_|                                                |___/ `;
const loadEnv = () => {
  const envPath = p.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
};
loadEnv();
const prg = () => {
  const a = process.argv.slice(2),
    c = {
      f: null,
      k: null,
      u: null,
      o: p.join(__dirname, 'exports'),
      b: 1000,
      rl: null,
      omu: null,
      omk: null,
      v: false,
      r: false,
    };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--from') c.f = a[++i];
    else if (a[i] === '--api-key') c.k = a[++i];
    else if (a[i] === '--url') c.u = a[++i];
    else if (a[i] === '--output') c.o = a[++i];
    else if (a[i] === '--batch-size') c.b = parseInt(a[++i]);
    else if (a[i] === '--rate-limit') c.rl = parseFloat(a[++i]);
    else if (a[i] === '--openmemory-url') c.omu = a[++i];
    else if (a[i] === '--openmemory-key') c.omk = a[++i];
    else if (a[i] === '--verify') c.v = true;
    else if (a[i] === '--resume') c.r = true;
    else if (a[i] === '--help') {
      console.log(
        `Usage: node migrate.js --from <zep|mem0|supermemory> --api-key <key> [options]
        
Options:
  --api-key <key>          API key for source provider (required)
  --from <provider>        Source provider: zep, mem0, or supermemory (required)
  --url <url>              Custom API base URL for source provider (optional)
  --output <dir>           Output directory for exports (default: ./exports)
  --batch-size <n>         Batch size for processing (default: 1000)
  --rate-limit <rps>       Requests per second for source (default: provider-specific)
                           - Zep: 1 req/s (default)
                           - Mem0: 20 req/s (default)
                           - Supermemory: 5 req/s (default)
  --openmemory-url <url>   OpenMemory API URL (default: http://localhost:8080)
  --openmemory-key <key>   OpenMemory API key for authentication (optional)
  --verify                 Run verification after import
  --resume                 Resume from previous export
  --help                   Show this help message

Environment Variables:
  OPENMEMORY_URL          Default OpenMemory API URL
  OPENMEMORY_API_KEY      Default OpenMemory API key

Examples:
  node migrate.js --from zep --api-key sk_xxx --rate-limit 0.5
  node migrate.js --from mem0 --api-key mem0_xxx --verify
  node migrate.js --from supermemory --api-key sm_xxx --openmemory-key my_key`,
      );
      process.exit(0);
    }
  }
  if (!c.rl) {
    if (c.f === 'zep') c.rl = 1;
    else if (c.f === 'mem0') c.rl = 20;
    else if (c.f === 'supermemory') c.rl = 5;
  }
  return c;
};
async function run() {
  console.log(ASC);
  console.log('\n=== Migration Tool ===\n');
  const c = prg();
  if (!c.f || !c.k) {
    console.error('[ERROR] Required: --from and --api-key');
    process.exit(1);
  }
  if (!['zep', 'mem0', 'supermemory'].includes(c.f)) {
    console.error('[ERROR] Invalid provider. Use: zep, mem0, or supermemory');
    process.exit(1);
  }
  if (!fs.existsSync(c.o)) fs.mkdirSync(c.o, { recursive: true });
  console.log(`[CONFIG] Provider: ${c.f.toUpperCase()}`);
  console.log(`[CONFIG] Batch Size: ${c.b}`);
  console.log(`[CONFIG] Rate Limit: ${c.rl} req/s`);
  console.log(`[CONFIG] Output: ${c.o}`);
  const omUrl =
    c.omu || process.env.OPENMEMORY_URL || process.env.OM_PORT
      ? `http://localhost:${process.env.OM_PORT}`
      : 'http://localhost:8080';
  const omKey =
    c.omk || process.env.OPENMEMORY_API_KEY || process.env.OM_API_KEY || '';
  console.log(`[CONFIG] OpenMemory API: ${omUrl}`);
  console.log(`[CONFIG] OpenMemory Auth: ${omKey ? 'Configured' : 'None'}\n`);

  // Pass resolved values to components
  if (!c.omu) c.omu = omUrl;
  if (!c.omk) c.omk = omKey;

  try {
    const A = require(`./providers/${c.f}`),
      a = new A(c);
    console.log('[PHASE 1/4] Connecting to provider...');
    const s = await a.conn();
    console.log(`[SUCCESS] Connected to ${c.f.toUpperCase()}`);
    if (s.ses !== undefined) console.log(`[STATS] Sessions: ${s.ses}`);
    if (s.m !== undefined) console.log(`[STATS] Memories: ${s.m}`);
    if (s.d !== undefined) console.log(`[STATS] Documents: ${s.d}\n`);
    console.log('[PHASE 2/4] Fetching data from provider...');
    const e = await a.exp();
    console.log(`[SUCCESS] Data exported to: ${e}\n`);
    console.log('[PHASE 3/4] Importing to OpenMemory HSG...');
    const I = require('./imp'),
      im = new I(c),
      st = await im.imp(e);
    console.log('\n[SUCCESS] Import completed');
    console.log(`[RESULT] Memories imported: ${st.m}`);
    if (st.f > 0) console.log(`[RESULT] Failed records: ${st.f}`);
    console.log(`[RESULT] Duration: ${st.d}s\n`);
    if (c.v) {
      console.log('[PHASE 4/4] Running verification...');
      const V = require('./ver'),
        vr = new V(c),
        vf = await vr.ver(st);
      if (vf.ok) {
        console.log('[SUCCESS] Verification passed');
      } else {
        console.log('[WARNING] Verification issues:');
        vf.w.forEach((w) => console.log(`  - ${w}`));
      }
    }
    console.log('\n[COMPLETE] Migration finished successfully\n');
    process.exit(0);
  } catch (e) {
    console.error('\n[FATAL] Migration failed:', e.message);
    console.error('[TRACE]', e.stack);
    process.exit(1);
  }
}
if (require.main === module) run();
module.exports = { prg, run };
