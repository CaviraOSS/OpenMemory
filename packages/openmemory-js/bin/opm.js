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
  stats                 show stats
  users                 list users
  user <id>             get user summary
  health                ping server
  mcp                   start mcp server (stdio)
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
  opm user u123
  opm stats
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
  if (opts.tags) body.tags = opts.tags.split(',');
  const r = await req('/memory/add', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  console.log('[ok] memory added');
  console.log(`id: ${r.id}`);
  console.log(`sector: ${r.primary_sector}`);
  console.log(`salience: ${r.salience?.toFixed(3) || 'n/a'}`);
};

const querymem = async (txt, opts) => {
  const body = { query: txt, k: opts.lim || 10 };
  if (opts.usr) body.filters = { user_id: opts.usr };
  const r = await req('/memory/query', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  console.log(`[results] ${r.memories.length} found\n`);
  r.memories.forEach((m, i) => {
    console.log(`${i + 1}. [${m.primary_sector}] ${m.content}`);
    console.log(`   id: ${m.id}`);
    console.log(
      `   score: ${m.score?.toFixed(3) || 'n/a'} | sal: ${m.salience.toFixed(
        3,
      )}`,
    );
    if (m.tags) console.log(`   tags: ${m.tags}`);
    console.log();
  });
};

const listmem = async (opts) => {
  const lim = opts.lim || 10;
  const off = 0;
  let r;
  if (opts.usr) {
    r = await req(`/users/${opts.usr}/memories?l=${lim}&u=${off}`);
  } else {
    r = await req(`/memory/all?limit=${lim}&offset=${off}`);
  }
  const items = r.items || r.memories || [];
  console.log(`[memories] showing ${items.length}\n`);
  items.forEach((m, i) => {
    console.log(`${i + 1}. [${m.primary_sector}] ${m.content}`);
    console.log(`   id: ${m.id} | user: ${opts.usr || 'system'}`);
    console.log(`   sal: ${m.salience.toFixed(3)}`);
    if (m.tags) console.log(`   tags: ${m.tags}`);
    console.log();
  });
};

const delmem = async (id) => {
  await req(`/memory/${id}`, { method: 'DELETE' });
  console.log(`[ok] memory ${id} deleted`);
};

const getstats = async () => {
  const r = await req('/dashboard/stats');
  console.log('[stats]\n');
  console.log(`total memories: ${r.totalMemories || 0}`);
  console.log(`recent memories (24h): ${r.recentMemories || 0}`);
  console.log(`avg salience: ${r.avgSalience || 'n/a'}`);
  console.log(`\nmemories by sector:`);
  Object.entries(r.sectorCounts || {}).forEach(([sec, cnt]) => {
    console.log(`  ${sec}: ${cnt}`);
  });
  if (r.decayStats) {
    console.log(`\ndecay stats:`);
    console.log(`  avg lambda: ${r.decayStats.avgLambda}`);
    console.log(`  min salience: ${r.decayStats.minSalience}`);
    console.log(`  max salience: ${r.decayStats.maxSalience}`);
  }
};

const listusers = async () => {
  const r = await req('/users');
  console.log(`[users] ${r.users.length} found\n`);
  r.users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.user_id}`);
    console.log(`   memories: ${u.memory_count || 0}`);
    console.log(`   reflections: ${u.reflection_count || 0}`);
    if (u.summary) console.log(`   summary: ${u.summary.substring(0, 100)}...`);
    console.log();
  });
};

const getuser = async (uid) => {
  const r = await req(`/users/${uid}/summary`);
  console.log(`[user] ${uid}\n`);
  console.log(`summary:\n${r.summary || 'no summary'}\n`);
  console.log(`memories: ${r.memory_count || 0}`);
  console.log(`reflections: ${r.reflection_count || 0}`);
};

const health = async () => {
  const r = await req('/health');
  console.log(`[health] ${r.status}`);
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

// run command
(async () => {
  try {
    switch (cmd) {
      case 'add':
        if (!argv[1]) throw new Error('content required: opm add "text"');
        await addmem(
          argv.slice(1, argv.indexOf('--')).join(' ') || argv[1],
          opts,
        );
        break;
      case 'query':
        if (!argv[1]) throw new Error('query text required: opm query "text"');
        await querymem(
          argv.slice(1, argv.indexOf('--')).join(' ') || argv[1],
          opts,
        );
        break;
      case 'list':
        await listmem(opts);
        break;
      case 'delete':
        if (!argv[1]) throw new Error('id required: opm delete <id>');
        await delmem(argv[1]);
        break;
      case 'stats':
        await getstats();
        break;
      case 'users':
        await listusers();
        break;
      case 'user':
        if (!argv[1]) throw new Error('user id required: opm user <id>');
        await getuser(argv[1]);
        break;
      case 'health':
        await health();
        break;
      case 'mcp':
        // Start MCP server (requires build)
        try {
            const mcp = require('../dist/ai/mcp.js');
            if (mcp && mcp.start_mcp_stdio) {
                await mcp.start_mcp_stdio();
            } else {
                console.error('[error] mcp module missing start_mcp_stdio export');
                process.exit(1);
            }
        } catch (e) {
            console.error('[error] failed to start mcp server. ensure project is built (npm run build).');
            console.error(e.message);
            process.exit(1);
        }
        break;
      case 'serve':
        try {
            console.log('[opm] passing control to server...');
            require('../dist/server/index.js');
        } catch (e) {
            console.error('[error] failed to start server. ensure project is built (npm run build).');
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
