# openmemory javascript sdk

> **real long-term memory for ai agents. not rag. not a vector db. self-hosted.**

[![npm version](https://img.shields.io/npm/v/openmemory-js.svg)](https://www.npmjs.com/package/openmemory-js)
[![license](https://img.shields.io/github/license/CaviraOSS/OpenMemory)](https://github.com/CaviraOSS/OpenMemory/blob/main/LICENSE)
[![discord](https://img.shields.io/discord/1300368230320697404?label=Discord)](https://discord.gg/P7HaRayqTh)

openmemory is a **cognitive memory engine** for llms and agents.

- 🧠 real long-term memory (not just embeddings in a table)
- 💾 self-hosted, local-first (sqlite / postgres)
- 🧩 integrations: mcp, claude desktop, cursor, windsurf
- 📥 sources: github, notion, google drive, onedrive, web crawler
- 🔍 explainable traces (see *why* something was recalled)

your model stays stateless. **your app stops being amnesiac.**

---

## quick start

```bash
npm install openmemory-js
```

```typescript
import { Memory } from "openmemory-js"

const mem = new Memory()
await mem.add("user likes spicy food", { user_id: "u1" })
const results = await mem.search("food?", { user_id: "u1" })
```

drop this into:

- node backends
- clis
- local tools
- anything that needs durable memory without running a separate service

**that's it.** you're now running a fully local cognitive memory engine 🎉

---

## 📥 sources (connectors)

ingest data from external sources directly into memory:

```typescript
const github = await mem.source("github")
await github.connect({ token: "ghp_..." })
await github.ingest_all({ repo: "owner/repo" })
```

available sources: `github`, `notion`, `google_drive`, `google_sheets`, `google_slides`, `onedrive`, `web_crawler`

---

## features

✅ **local-first** - runs entirely on your machine, zero external dependencies  
✅ **multi-sector memory** - episodic, semantic, procedural, emotional, reflective  
✅ **temporal knowledge graph** - time-aware facts with validity periods  
✅ **memory decay** - adaptive forgetting with sector-specific rates  
✅ **waypoint graph** - associative recall paths for better retrieval  
✅ **explainable traces** - see exactly why memories were recalled  
✅ **zero config** - works out of the box with sensible defaults  

---

## cognitive sectors

openmemory automatically classifies content into 5 cognitive sectors:

| sector | description | examples | decay rate |
|--------|-------------|----------|------------|
| **episodic** | time-bound events & experiences | "yesterday i attended a conference" | medium |
| **semantic** | timeless facts & knowledge | "paris is the capital of france" | very low |
| **procedural** | skills, procedures, how-tos | "to deploy: build, test, push" | low |
| **emotional** | feelings, sentiment, mood | "i'm excited about this project!" | high |
| **reflective** | meta-cognition, insights | "i learn best through practice" | very low |

---

## configuration

### environment variables

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

# metadata backend (optional)
OM_METADATA_BACKEND=postgres         # sqlite (default) | postgres
OM_PG_HOST=localhost
OM_PG_PORT=5432
OM_PG_DB=openmemory
OM_PG_USER=postgres
OM_PG_PASSWORD=...

# vector backend (optional)
OM_VECTOR_BACKEND=valkey             # default uses metadata backend
OM_VALKEY_URL=redis://localhost:6379
```

### programmatic usage

```typescript
import { Memory } from 'openmemory-js';

const mem = new Memory('user-123');  // optional user_id

// add memories
await mem.add(
    "user prefers dark mode",
    {
        tags: ["preference", "ui"],
        created_at: Date.now()
    }
);

// search
const results = await mem.search("user settings", {
    user_id: "user-123",
    limit: 10,
    sectors: ["semantic", "procedural"]
});

// get by id
const memory = await mem.get("uuid-here");

// wipe all data (useful for testing)
await mem.wipe();
```

---

## performance tiers

- `fast` - synthetic embeddings (no api calls), instant
- `smart` - hybrid semantic + synthetic for balanced speed/accuracy
- `deep` - pure semantic embeddings for maximum accuracy
- `hybrid` - adaptive based on query complexity

---

## mcp server

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

## examples

```typescript
// multi-user support
const mem = new Memory();
await mem.add("alice likes python", { user_id: "alice" });
await mem.add("bob likes rust", { user_id: "bob" });

const alicePrefs = await mem.search("what does alice like?", { user_id: "alice" });
// returns python results only

// temporal filtering
const recent = await mem.search("user activity", {
    startTime: Date.now() - 86400000,  // last 24 hours
    endTime: Date.now()
});

// sector-specific queries
const facts = await mem.search("company info", { sectors: ["semantic"] });
const howtos = await mem.search("deployment", { sectors: ["procedural"] });
```

---

## api reference

### `new Memory(user_id?: string)`

create a new memory instance with optional default user_id.

### `async add(content: string, metadata?: object): Promise<hsg_mem>`

store a new memory.

**parameters:**
- `content` - text content to store
- `metadata` - optional metadata object:
  - `user_id` - user identifier
  - `tags` - array of tag strings
  - `created_at` - timestamp
  - any other custom fields

**returns:** memory object with `id`, `primary_sector`, `sectors`

### `async search(query: string, options?: object): Promise<hsg_q_result[]>`

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

### `async get(id: string): Promise<memory | null>`

retrieve a memory by id.

### `async wipe(): Promise<void>`

**⚠️ danger**: delete all memories, vectors, and waypoints. useful for testing.

---

## license

apache 2.0

---

## links

- [main repository](https://github.com/CaviraOSS/OpenMemory)
- [python sdk](https://pypi.org/project/openmemory-py/)
- [vs code extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode)
- [documentation](https://openmemory.cavira.app/docs/sdks/javascript)
- [discord](https://discord.gg/P7HaRayqTh)
