# openmemory javascript sdk

> **real long-term memory for ai agents. not rag. not a vector db. self-hosted.**

[![npm version](https://img.shields.io/npm/v/openmemory-js.svg)](https://www.npmjs.com/package/openmemory-js)
[![license](https://img.shields.io/github/license/CaviraOSS/OpenMemory)](https://github.com/CaviraOSS/OpenMemory/blob/main/LICENSE)
[![discord](https://img.shields.io/discord/1300368230320697404?label=Discord)](https://discord.gg/P7HaRayqTh)

openmemory is a **cognitive memory engine** for llms and agents.

- 🧠 real long-term memory (not just embeddings in a table)
- 💾 self-hosted: sqlite (local) or postgresql + pgvector (cloud/saas)
- 🚀 serverless-ready: cloud run, lambda, vercel edge functions
- 🏢 multi-tenant: isolate memories by tenant_id (50M+ memories)
- 🧩 integrations: mcp, claude desktop, cursor, windsurf
- 📥 sources: github, notion, google drive, onedrive, web crawler
- 🔍 explainable traces (see *why* something was recalled)

your model stays stateless. **your app stops being amnesiac.**

---

## 📦 installation

### from npm (public release)

```bash
npm install openmemory-js
```

### from private github repo

**Option 1: Git Install (Recommended)**

In your `package.json`:
```json
{
  "dependencies": {
    "@BUW91/openmemory-js": "git+ssh://git@github.com:BUW91/OpenMemoryWithDb.git#claude/postgres-pgvector-integration-X9PUe"
  }
}
```

Then:
```bash
npm install
```

**Option 2: npm link (Development)**

```bash
# In OpenMemoryWithDb repo
cd packages/openmemory-js
npm link

# In your project
npm link @BUW91/openmemory-js
```

---

## 🚀 quick start

### option a: postgresql / supabase (multi-tenant saas) ⭐ new!

**perfect for cloud run, lambda, vercel edge functions, multi-tenant saas**

```typescript
import { OpenMemory } from '@BUW91/openmemory-js';

// initialize with database connection
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,  // supabase or postgresql
  tenant_id: 'customer_123',
  pgvector_enabled: true,  // native vector search (hnsw)
  autoMigrate: true        // auto-run migrations on first use
});

// add memories
await memory.add("User prefers dark mode");
await memory.add({
  content: "Customer upgraded to Enterprise plan",
  tags: ["billing", "upgrade"],
  metadata: { plan: "enterprise", date: "2024-01-15" }
});

// query memories
const results = await memory.query("user preferences");
console.log(results[0].content);  // "User prefers dark mode"

// sector-specific queries
const billing = await memory.query({
  query: "billing information",
  sectors: ["semantic"],
  k: 5
});

// update memory
await memory.update({
  id: results[0].id,
  content: "User prefers dark mode and compact layout"
});

// delete memory
await memory.delete(results[0].id);
```

**see:** [CLIENT_USAGE.md](../../CLIENT_USAGE.md) for full documentation

---

### option b: local sqlite (embedded)

**perfect for local tools, clis, desktop apps**

```typescript
import { Memory } from '@BUW91/openmemory-js';

const mem = new Memory();
await mem.add("user likes spicy food", { user_id: "u1" });
const results = await mem.search("food?", { user_id: "u1" });
```

---

## ☁️ serverless deployment

### google cloud run

```typescript
import { OpenMemory } from '@BUW91/openmemory-js';

// initialize once (outside request handler for connection reuse)
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL
});

export async function handler(req, res) {
  const { query } = req.query;
  const results = await memory.query(query);
  res.json(results);
}
```

**see:** [examples/cloud-run-example.ts](../../examples/cloud-run-example.ts)

### aws lambda / vercel edge

Same pattern - initialize once, reuse across invocations.

**see:** [examples/](../../examples/) for more deployment examples

---

## 🏢 multi-tenant usage

```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  multi_tenant: true
});

// add memory for tenant A
await memory.add({
  content: "Customer A prefers email notifications",
  tenant_id: "customer_a"
});

// add memory for tenant B
await memory.add({
  content: "Customer B prefers SMS notifications",
  tenant_id: "customer_b"
});

// query per tenant (data isolation)
const resultsA = await memory.query({
  query: "notification preferences",
  tenant_id: "customer_a"
});
// only returns customer_a memories
```

**see:** [examples/multi-tenant-usage.ts](../../examples/multi-tenant-usage.ts)

---

## 🧠 cognitive sectors

openmemory automatically classifies content into 5 cognitive sectors:

| sector | description | examples | decay rate |
|--------|-------------|----------|------------|
| **episodic** | time-bound events & experiences | "yesterday i attended a conference" | medium |
| **semantic** | timeless facts & knowledge | "paris is the capital of france" | very low |
| **procedural** | skills, procedures, how-tos | "to deploy: build, test, push" | low |
| **emotional** | feelings, sentiment, mood | "i'm excited about this project!" | high |
| **reflective** | meta-cognition, insights | "i learn best through practice" | very low |

---

## ⚙️ configuration

### postgresql / supabase client

```typescript
import { OpenMemory } from '@BUW91/openmemory-js';

const memory = new OpenMemory({
  // connection (choose one)
  connectionString: "postgresql://user:pass@host:5432/db",
  // or separate fields:
  host: "db.example.com",
  port: 5432,
  database: "openmemory",
  user: "postgres",
  password: "your_password",
  ssl: true,

  // multi-tenancy
  tenant_id: "customer_123",      // default tenant
  multi_tenant: true,             // enable multi-tenant mode

  // pgvector settings
  pgvector_enabled: true,         // use native pgvector (recommended)
  vec_dim: 1536,                  // vector dimensions (openai default)

  // behavior
  autoMigrate: true,              // auto-run migrations on first use
  schema: "public",               // postgresql schema

  // defaults
  user_id: "user_456"             // default user_id
});
```

### environment variables (sqlite mode)

```bash
# database
OM_DB_PATH=./data/om.db              # sqlite file path (default: ./data/openmemory.sqlite)
OM_DB_URL=sqlite://:memory:          # or use in-memory db

# embeddings
OM_EMBEDDINGS=ollama                 # synthetic | openai | gemini | ollama
OM_OLLAMA_URL=http://localhost:11434
OM_OLLAMA_MODEL=embeddinggemma       # or nomic-embed-text, mxbai-embed-large

# openai
OPENAI_API_KEY=sk-...
OM_OPENAI_MODEL=text-embedding-3-small

# gemini
GEMINI_API_KEY=AIza...

# performance tier
OM_TIER=deep                         # fast | smart | deep | hybrid
OM_VEC_DIM=768                       # vector dimension (must match model)

# postgresql backend (optional for Memory class)
OM_METADATA_BACKEND=postgres         # sqlite (default) | postgres
OM_PG_HOST=localhost
OM_PG_PORT=5432
OM_PG_DB=openmemory
OM_PG_USER=postgres
OM_PG_PASSWORD=...

# pgvector settings
OM_PGVECTOR_ENABLED=true
OM_MULTI_TENANT=true
OM_DEFAULT_TENANT_ID=default

# vector backend (optional)
OM_VECTOR_BACKEND=valkey             # default uses metadata backend
OM_VALKEY_URL=redis://localhost:6379
```

---

## 📚 api reference

### openmemory client (postgresql / supabase)

#### `new OpenMemory(config)`

create a new openmemory client.

```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  tenant_id: 'customer_123'
});
```

#### `async add(options): Promise<{ id: string }>`

add a memory.

```typescript
// simple string
await memory.add("some content");

// with options
await memory.add({
  content: "detailed content",
  tags: ["tag1", "tag2"],
  metadata: { custom: "data" },
  user_id: "user_456",
  tenant_id: "customer_123"
});
```

#### `async query(options): Promise<hsg_q_result[]>`

query memories.

```typescript
// simple query
const results = await memory.query("search term");

// advanced query
const results = await memory.query({
  query: "search term",
  k: 10,                          // number of results
  sectors: ["semantic"],          // filter by sector
  minSalience: 0.5,              // minimum salience threshold
  user_id: "user_456",
  tenant_id: "customer_123",
  startTime: Date.now() - 86400000,  // last 24 hours
  endTime: Date.now()
});
```

#### `async update(options): Promise<{ id: string; updated: boolean }>`

update a memory.

```typescript
await memory.update({
  id: "memory-id",
  content: "updated content",
  tags: ["new", "tags"],
  metadata: { updated: true }
});
```

#### `async delete(id, tenant_id?): Promise<void>`

delete a memory.

```typescript
await memory.delete("memory-id");
```

#### `async list(limit, offset, user_id?): Promise<any[]>`

list memories with pagination.

```typescript
const memories = await memory.list(50, 0);  // limit: 50, offset: 0
```

#### `async get(id): Promise<any>`

get a specific memory by id.

```typescript
const mem = await memory.get("memory-id");
```

#### `async close(): Promise<void>`

close database connection.

```typescript
await memory.close();
```

---

### memory class (sqlite local-first)

#### `new Memory(user_id?: string)`

create a new memory instance with optional default user_id.

#### `async add(content: string, metadata?: object): Promise<hsg_mem>`

store a new memory.

**parameters:**
- `content` - text content to store
- `metadata` - optional metadata object:
  - `user_id` - user identifier
  - `tags` - array of tag strings
  - `created_at` - timestamp
  - any other custom fields

**returns:** memory object with `id`, `primary_sector`, `sectors`

#### `async search(query: string, options?: object): Promise<hsg_q_result[]>`

search for relevant memories.

**parameters:**
- `query` - search text
- `options`:
  - `user_id` - filter by user
  - `limit` - max results (default: 10)
  - `sectors` - array of sectors to search
  - `startTime` - filter memories after this timestamp
  - `endTime` - filter memories before this timestamp

**returns:** array of memory results with `id`, `content`, `score`, `sectors`, `salience`, `tags`, `meta`

#### `async get(id: string): Promise<memory | null>`

retrieve a memory by id.

#### `async wipe(): Promise<void>`

**⚠️ danger**: delete all memories, vectors, and waypoints. useful for testing.

---

## 📥 sources (connectors)

ingest data from external sources directly into memory:

```typescript
const github = await mem.source("github");
await github.connect({ token: "ghp_..." });
await github.ingest_all({ repo: "owner/repo" });
```

available sources: `github`, `notion`, `google_drive`, `google_sheets`, `google_slides`, `onedrive`, `web_crawler`

---

## 🔧 features

✅ **serverless-ready** - cloud run, lambda, vercel edge functions
✅ **multi-tenant** - 50m+ memories with tenant isolation
✅ **pgvector hnsw** - sub-100ms queries at scale
✅ **local-first** - runs entirely on your machine (sqlite mode)
✅ **multi-sector memory** - episodic, semantic, procedural, emotional, reflective
✅ **temporal knowledge graph** - time-aware facts with validity periods
✅ **memory decay** - adaptive forgetting with sector-specific rates
✅ **waypoint graph** - associative recall paths for better retrieval
✅ **explainable traces** - see exactly why memories were recalled
✅ **zero config** - works out of the box with sensible defaults
✅ **auto-migrations** - database schema updates run automatically

---

## 📖 examples

- [basic-usage.ts](../../examples/basic-usage.ts) - basic operations
- [multi-tenant-usage.ts](../../examples/multi-tenant-usage.ts) - multi-tenant saas
- [cloud-run-example.ts](../../examples/cloud-run-example.ts) - serverless api

---

## 📄 documentation

- [CLIENT_USAGE.md](../../CLIENT_USAGE.md) - full client api documentation
- [PGVECTOR_SETUP.md](../../PGVECTOR_SETUP.md) - production deployment guide
- [examples/README.md](../../examples/README.md) - example documentation

---

## 🔐 mcp server

openmemory-js includes an mcp server for integration with claude desktop, cursor, windsurf, and other mcp clients:

```bash
npx openmemory-js serve --port 3000
```

### claude desktop / cursor / windsurf

```json
{
  "mcpServers": {
    "openmemory": {
      "command": "npx",
      "args": ["openmemory-js", "serve"]
    }
  }
}
```

available mcp tools:

- `openmemory_query` - search memories
- `openmemory_store` - add new memories
- `openmemory_list` - list all memories
- `openmemory_get` - get memory by id
- `openmemory_reinforce` - reinforce a memory

---

## 🎯 performance tips

### 1. connection reuse (critical for serverless)

```typescript
// ✅ good - initialize once, reuse across requests
const memory = new OpenMemory({ connectionString: process.env.DATABASE_URL });

export async function handler(req) {
  await memory.query("...");
}
```

```typescript
// ❌ bad - creates new connection per request
export async function handler(req) {
  const memory = new OpenMemory({ connectionString: process.env.DATABASE_URL });
  await memory.query("...");
}
```

### 2. enable pgvector for scale

for 100k+ memories, use native pgvector:

```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  pgvector_enabled: true  // o(log n) vs o(n) search
});
```

### 3. use appropriate k

don't over-fetch:

```typescript
// ✅ good
await memory.query({ query: "...", k: 5 });

// ❌ bad
await memory.query({ query: "...", k: 1000 });
```

---

## 🐛 troubleshooting

### "cannot find module '@BUW91/openmemory-js'"

make sure you've installed from git:

```json
{
  "dependencies": {
    "@BUW91/openmemory-js": "git+ssh://git@github.com:BUW91/OpenMemoryWithDb.git#claude/postgres-pgvector-integration-X9PUe"
  }
}
```

or used npm link:

```bash
npm link @BUW91/openmemory-js
```

### "column tenant_id does not exist"

run migrations:

```bash
# automatic (default)
const memory = new OpenMemory({ autoMigrate: true });

# or manual
npm run migrate
```

### slow queries on large datasets

enable pgvector:

```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  pgvector_enabled: true
});
```

---

## 📜 license

apache 2.0

---

## 🔗 links

- [main repository](https://github.com/CaviraOSS/OpenMemory)
- [python sdk](https://pypi.org/project/openmemory-py/)
- [vs code extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode)
- [documentation](https://openmemory.cavira.app/docs/sdks/javascript)
- [discord](https://discord.gg/P7HaRayqTh)
