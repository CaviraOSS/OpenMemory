#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// load .env from root
const loadenv = () => {
  const envp = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envp)) return;
  const lns = fs.readFileSync(envp, 'utf8').split('\n');
  for (const ln of lns) {
    const trim = ln.trim();
    if (!trim || trim.startsWith('#')) continue;
    const m = trim.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
};
loadenv();

const port = process.env.OM_PORT || '8080';
const url = process.env.OPENMEMORY_URL || `http://localhost:${port}`;
const key = process.env.OPENMEMORY_API_KEY || process.env.OM_API_KEY || '';

const helptext = `
openmemory cli (opm)

usage: opm <command> [options]

commands:
  add <text>            add memory
  query <text>          search memories
  list                  show all memories
  delete <id>           delete memory
  health                ping server
  serve                 start api server

options:
  --user <id>           user id
  --tags <t1,t2>        comma tags
  --limit <n>           result limit (default: 10)
  -h, --help            show help

env vars:
  OPENMEMORY_URL        api url (default: http://localhost:8080)
  OPENMEMORY_API_KEY    auth key
  OM_API_KEY            alt auth key

examples:
  opm add "user likes dark mode" --user u123 --tags prefs
  opm query "preferences" --user u123
  opm list --limit 5
`;

const hdrs = {
  'content-type': 'application/json',
  ...(key && { authorization: `Bearer ${key}` }),
};

const req = async (pth, opts = {}) => {
  const target = `${url}${pth}`;
  try {
    const res = await fetch(target, {
      ...opts,
      headers: { ...hdrs, ...opts.headers },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => 'no response');
      throw new Error(`http ${res.status}: ${txt}`);
    }
    return await res.json();
  } catch (e) {
    console.error(`[error] ${e.message}`);
    process.exit(1);
  }
};

const addmem = async (txt, opts) => {
  const body = { content: txt };
  if (opts.usr) body.user_id = opts.usr;
  if (opts.tags) body.facets = { tags: opts.tags.split(',') };
  const r = await req('/v1/memories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  console.log('[ok] memory added');
  console.log(`id: ${r.id || r.memory_id}`);
  if (r.status) console.log(`status: ${r.status}`);
};

const querymem = async (txt, opts) => {
  const body = { query: txt, limit: opts.lim || 10 };
  if (opts.usr) body.user_id = opts.usr;
  const r = await req('/v1/recall', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const memories = r.results || [];
  console.log(`[results] ${memories.length} found\n`);
  memories.forEach((m, i) => {
    console.log(`${i + 1}. ${m.content}`);
    console.log(`   id: ${m.id || m.memory_id}`);
    if (typeof m.score === 'number') console.log(`   score: ${m.score.toFixed(3)}`);
    if (m.facets?.tags) console.log(`   tags: ${m.facets.tags.join(',')}`);
    console.log();
  });
};

const listmem = async (opts) => {
  const lim = opts.lim || 10;
  const params = new URLSearchParams({ limit: String(lim), offset: '0' });
  if (opts.usr) params.set('user_id', opts.usr);
  const r = await req(`/v1/memories?${params.toString()}`);
  const items = r.items || [];
  console.log(`[memories] showing ${items.length}\n`);
  items.forEach((m, i) => {
    console.log(`${i + 1}. ${m.content}`);
    console.log(`   id: ${m.id} | user: ${m.user_id || opts.usr || 'system'}`);
    if (typeof m.salience === 'number') console.log(`   salience: ${m.salience.toFixed(3)}`);
    if (m.facets?.tags) console.log(`   tags: ${m.facets.tags.join(',')}`);
    console.log();
  });
};

const delmem = async (id, opts) => {
  const params = new URLSearchParams();
  if (opts.usr) params.set('user_id', opts.usr);
  const suffix = params.size ? `?${params.toString()}` : '';
  await req(`/v1/memories/${id}${suffix}`, { method: 'DELETE' });
  console.log(`[ok] memory ${id} deleted`);
};

const health = async () => {
  const r = await req('/health');
  console.log(`[health] ${r.ok ? 'ok' : r.status || 'unknown'}`);
  if (r.version) console.log(`version: ${r.version}`);
  if (r.uptime) console.log(`uptime: ${Math.floor(r.uptime / 1000)}s`);
};

// parse args
const argv = process.argv.slice(2);
const cmd = argv[0];

if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(helptext);
  process.exit(0);
}

const opts = {};
for (let i = 1; i < argv.length; i++) {
  if (argv[i] === '--user') opts.usr = argv[++i];
  else if (argv[i] === '--tags') opts.tags = argv[++i];
  else if (argv[i] === '--limit') opts.lim = parseInt(argv[++i]);
}

const commandText = () => {
  const optionStart = argv.findIndex((arg, index) => index > 0 && arg.startsWith('--'));
  const end = optionStart === -1 ? argv.length : optionStart;
  return argv.slice(1, end).join(' ');
};
const text = commandText();

// run command
(async () => {
  try {
    switch (cmd) {
      case 'add':
        if (!text) throw new Error('content required: opm add "text"');
        await addmem(text, opts);
        break;
      case 'query':
        if (!text) throw new Error('query text required: opm query "text"');
        await querymem(text, opts);
        break;
      case 'list':
        await listmem(opts);
        break;
      case 'delete':
        if (!argv[1]) throw new Error('id required: opm delete <id>');
        await delmem(argv[1], opts);
        break;
      case 'health':
        await health();
        break;
      case 'serve':
        try {
          console.log('[opm] passing control to server...');
          require('../dist/server.js');
        } catch (e) {
          console.error(
            '[error] failed to start server. ensure project is built (npm run build).',
          );
          console.error(e.message);
          process.exit(1);
        }
        break;
      default:
        console.error(`[error] unknown command: ${cmd}`);
        console.log(helptext);
        process.exit(1);
    }
  } catch (e) {
    console.error(`[error] ${e.message}`);
    process.exit(1);
  }
})();
