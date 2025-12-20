# OpenMemory Architecture

## System Overview

OpenMemory is a self-hosted AI memory engine implementing **Hierarchical Memory Decomposition (HMD) v2** architecture. It provides persistent, structured, and semantic memory for LLM applications through multi-sector embeddings and single-waypoint graph linking.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  HTTP Clients  │  JavaScript SDK  │  Python SDK  │  LangGraph Apps  │
└────────────┬────────────────┬────────────────┬────────────────┬──────┘
             │                │                │                │
             └────────────────┴────────────────┴────────────────┘
                                     │
                         ┌───────────▼───────────┐
                         │   REST API SERVER     │
                         │   (TypeScript/Node)   │
                         │   Port: 8080          │
                         └───────────┬───────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐         ┌──────────────────┐        ┌──────────────────┐
│  HSG MEMORY   │         │   EMBEDDING      │        │   INGESTION      │
│   ENGINE      │◄────────┤   PROCESSOR      │◄───────┤   PIPELINE       │
│               │         │                  │        │                  │
│ • Classify    │         │ • OpenAI         │        │ • PDF Parser     │
│ • Encode      │         │ • Gemini         │        │ • DOCX Parser    │
│ • Store       │         │ • AWS            │        │ • URL Scraper    │
│ • Query       │         │ • Ollama         │        │ • Text Chunking  │
│ • Decay       │         │ • Local/Synth    │        │                  │
│ • Reinforce   │         | • Batch API      |        └──────────────────┘
└───────┬───────┘         └──────────────────┘
        │
        ├────────────────┐
        │                │
        ▼                ▼
┌───────────────┐  ┌──────────────────┐
│   DATABASE    │  │  WAYPOINT GRAPH  │
│   (SQLite)    │  │                  │
│               │  │ • Single-way     │
│ • memories    │  │ • Auto-link      │
│ • vectors     │  │ • Reinforcement  │
│ • waypoints   │  │ • Pruning        │
│ • embed_logs  │  │                  │
└───────────────┘  └──────────────────┘
```

---

## Core Components

### 1. REST API Server (`packages/openmemory-js/src/server/`)

**Purpose:** HTTP endpoint layer for all memory operations

**Key Endpoints:**

| Method   | Endpoint             | Description                      |
| -------- | -------------------- | -------------------------------- |
| `GET`    | `/health`            | Health check and version info    |
| `GET`    | `/sectors`           | List available sectors and stats |
| `POST`   | `/memory/add`        | Add a new memory                 |
| `POST`   | `/memory/query`      | Query memories by similarity     |
| `POST`   | `/memory/ingest`     | Ingest document (PDF/DOCX/TXT)   |
| `POST`   | `/memory/ingest/url` | Ingest URL content               |
| `POST`   | `/memory/reinforce`  | Boost memory salience            |
| `GET`    | `/memory/all`        | List all memories (paginated)    |
| `GET`    | `/memory/:id`        | Get specific memory details      |
| `DELETE` | `/memory/:id`        | Delete a memory                  |

**LangGraph Mode Endpoints** (when `OM_MODE=langgraph`):

| Method | Endpoint          | Description                         |
| ------ | ----------------- | ----------------------------------- |
| `POST` | `/lgm/store`      | Store LangGraph node output         |
| `POST` | `/lgm/retrieve`   | Retrieve memories for graph session |
| `POST` | `/lgm/context`    | Get summarized multi-sector context |
| `POST` | `/lgm/reflection` | Generate and store reflections      |
| `GET`  | `/lgm/config`     | Inspect LangGraph configuration     |

**Features:**

- CORS support for cross-origin requests
- Bearer token authentication (optional)
- Scheduled decay process (every 24 hours)
- Scheduled waypoint pruning (every 7 days)

---

### 2. HSG Memory Engine (`packages/openmemory-js/src/memory/`)

**Purpose:** Core memory logic implementing Hierarchical Sectored Graph architecture

#### 2.1 Memory Sectors

Five cognitive memory types, each with specific patterns and decay rates:

```typescript
SECTORS = {
  episodic: {      // Events and experiences
    decay_lambda: 0.015,
    weight: 1.2,
    patterns: [/today|yesterday|remember when/i, ...]
  },
  semantic: {      // Facts and knowledge
    decay_lambda: 0.005,
    weight: 1.0,
    patterns: [/define|meaning|concept/i, ...]
  },
  procedural: {    // How-to and processes
    decay_lambda: 0.008,
    weight: 1.1,
    patterns: [/how to|step by step/i, ...]
  },
  emotional: {     // Feelings and sentiments
    decay_lambda: 0.020,
    weight: 1.3,
    patterns: [/feel|happy|sad|angry/i, ...]
  },
  reflective: {    // Meta-cognition and insights
    decay_lambda: 0.001,
    weight: 0.8,
    patterns: [/think|realize|insight/i, ...]
  }
}
```

#### 2.2 Memory Operations

**Add Memory Flow:**

```
1. Content → classifyContent() → {primary, additional}
2. For each sector → embedMultiSector() → vectors[]
3. Calculate mean vector from all sector vectors
4. Store memory node + vectors in database
5. createSingleWaypoint() → find best match (similarity ≥ 0.75)
6. Return {id, primary_sector, sectors, chunks}
```

**Query Memory Flow:**

```
1. Query text → classifyContent() → candidate sectors
2. For each sector → embedForSector() → query vector
3. Search vectors by sector → cosine similarity
4. Get top-K per sector → merge results
5. expandViaWaypoints() → 1-hop graph traversal
6. Score each memory: composite score
   = 0.6×similarity + 0.2×salience + 0.1×recency + 0.1×waypoint
7. Sort and return top-K
8. Reinforce: boost salience + strengthen waypoints
```

#### 2.3 Decay System

**Purpose:** Simulate memory fading over time

```typescript
calculateDecay(sector, initialSalience, daysSinceLastSeen) {
  return initialSalience × e^(-decay_lambda × days)
}
```

- Runs every 24 hours
- Sector-specific decay rates
- Episodic memories decay fastest (0.020)
- Reflective memories decay slowest (0.001)

#### 2.4 Waypoint Graph

**Purpose:** Single-waypoint associative linking

```
Memory A ──0.85──> Memory B
          (strongest link only)
```

**Creation:**

- During add: find single best match (cosine > 0.75)
- Bidirectional if cross-sector

**Reinforcement:**

- On query: boost weight by 0.05 per traversal
- Max weight: 1.0

**Pruning:**

- Every 7 days: remove weights < 0.05

---

### 3. Embedding Processor (`packages/openmemory-js/src/core/`)

**Purpose:** Multi-provider embedding generation with batch support

#### 3.1 Supported Providers

| Provider      | Models                                             | Batch Support | Cost             |
| ------------- | -------------------------------------------------- | ------------- | ---------------- |
| **OpenAI**    | `text-embedding-3-small`, `text-embedding-3-large` | ✅            | ~$0.02/1M tokens |
| **Gemini**    | `embedding-001`                                    | ✅            | ~$0.01/1M tokens |
| **AWS**       | `amazon.titan-embed-text-v2:0`                     | ❌            | ~$0.02/1M tokens |
| **Ollama**    | `nomic-embed-text`, `bge-small`, `bge-large`       | ❌            | Free (local)     |
| **Local**     | Custom models                                      | ❌            | Free (local)     |
| **Synthetic** | Hash-based                                         | ❌            | Free             |

#### 3.2 Embedding Modes

**Simple Mode** (`OM_EMBED_MODE=simple`):

- One batch call per memory (all sectors at once)
- Faster for OpenAI/Gemini
- Lower API overhead

**Advanced Mode** (`OM_EMBED_MODE=advanced`):

- Sector-specific model selection
- Optional parallel embedding
- Chunking support for long texts
- Better for specialized use cases

#### 3.3 Chunking Strategy

For texts > 512 tokens:

```
1. Split text into overlapping chunks (512 tokens, 50 overlap)
2. Embed each chunk separately
3. Aggregate via mean pooling
4. Store aggregated vector
```

---

### 4. Database Layer (`packages/openmemory-js/src/core/db.ts`)

**Purpose:** SQLite persistence with transactions

#### 4.1 Schema

**memories table:**

```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,           -- UUID
  content TEXT NOT NULL,         -- Raw text
  primary_sector TEXT NOT NULL,  -- Main sector
  tags TEXT,                     -- JSON array
  meta TEXT,                     -- JSON metadata
  created_at INTEGER,
  updated_at INTEGER,
  last_seen_at INTEGER,          -- For decay calculation
  salience REAL,                 -- 0-1 importance score
  decay_lambda REAL,             -- Sector-specific rate
  version INTEGER DEFAULT 1,
  mean_dim INTEGER,              -- Mean vector dimension
  mean_vec BLOB                  -- Mean vector (for waypoint)
)
```

**vectors table:**

```sql
CREATE TABLE vectors (
  id TEXT NOT NULL,              -- Memory ID
  sector TEXT NOT NULL,          -- Sector name
  v BLOB NOT NULL,               -- Float32 vector
  dim INTEGER NOT NULL,
  PRIMARY KEY (id, sector)
)
```

**waypoints table:**

```sql
CREATE TABLE waypoints (
  src_id TEXT PRIMARY KEY,       -- Source memory
  dst_id TEXT NOT NULL,          -- Destination memory
  weight REAL NOT NULL,          -- Link strength (0-1)
  created_at INTEGER,
  updated_at INTEGER
)
```

**embed_logs table:**

```sql
CREATE TABLE embed_logs (
  id TEXT PRIMARY KEY,
  model TEXT,
  status TEXT,                   -- pending/completed/failed
  ts INTEGER,
  err TEXT
)
```

#### 4.2 Transaction Support

```typescript
transaction.begin();
try {
  // Insert memory
  // Insert vectors
  // Create waypoints
  transaction.commit();
} catch (e) {
  transaction.rollback();
  throw e;
}
```

---

### 5. Ingestion Pipeline (`packages/openmemory-js/src/ops/`)

**Purpose:** Document processing and content extraction

#### 5.1 Supported Formats

| Format    | Parser                     | Features                                    |
| --------- | -------------------------- | ------------------------------------------- |
| **PDF**   | `pdf-parse`                | Text extraction, metadata                   |
| **DOCX**  | `mammoth`                  | Convert to markdown                         |
| **TXT**   | Native                     | Direct read                                 |
| **MD**    | Native                     | Markdown passthrough                        |
| **HTML**  | `turndown`                 | HTML → Markdown                             |
| **URL**   | `fetch` + `turndown`       | HTML → Markdown                             |
| **Audio** | OpenAI Whisper API         | Transcription (mp3, wav, m4a, webm, ogg)    |
| **Video** | `fluent-ffmpeg` + Whisper  | Audio extraction → Transcription (mp4, etc) |

**Audio/Video Notes:**
- **File size limit**: 25MB (Whisper API limit)
- **Cost**: ~$0.006 per minute of audio
- **Supported audio formats**: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg
- **Supported video formats**: mp4, webm, avi, mov (extracts audio track)
- **Requirements**: `OPENAI_API_KEY` for transcription, FFmpeg installed for video processing

#### 5.2 Processing Flow

```
Document → Extract text → Chunk if needed →
  For each chunk:
    1. Classify sector
    2. Generate embeddings
    3. Store as separate memory
  Return: {memories: [{id, sector}...], chunks: N}
```

**Configuration:**

```typescript
{
  chunk_size: 2048,        // Max tokens per chunk
  chunk_overlap: 256,      // Overlap between chunks
  preserve_metadata: true  // Keep document metadata
}
```

---

### 6. LangGraph Integration (`packages/openmemory-js/src/ai/graph.ts`)

**Purpose:** Seamless integration with LangGraph workflows

#### 6.1 Node-to-Sector Mapping

```typescript
NODE_SECTOR_MAP = {
  observe: 'episodic', // Observations
  plan: 'semantic', // Plans and strategies
  reflect: 'reflective', // Reflections
  act: 'procedural', // Actions taken
  emotion: 'emotional', // Emotional state
};
```

#### 6.2 Context Assembly

```
/lgm/context → Returns:
{
  episodic: [...],    // Recent observations
  semantic: [...],    // Relevant facts
  procedural: [...],  // How-to knowledge
  emotional: [...],   // Sentiment context
  reflective: [...]   // Meta-insights
}
```

**Max context:** 50 memories per sector (configurable)

---

## Data Flow Diagrams

### Add Memory Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ POST /memory/add
     │ {content, tags, metadata}
     ▼
┌────────────────┐
│  API Server    │
└────┬───────────┘
     │
     ▼
┌────────────────────────────────┐
│  HSG: classifyContent()         │
│  → {primary, additional, conf}  │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Embedding: embedMultiSector() │
│  → [{sector, vector}...]        │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  HSG: calculateMeanVector()     │
│  → mean vector for waypoint     │
└────┬───────────────────────────┘
     │
     ▼  START TRANSACTION
┌────────────────────────────────┐
│  Database:                      │
│  1. INSERT into memories        │
│  2. INSERT into vectors (×N)    │
│  3. UPDATE mean_vec             │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  HSG: createSingleWaypoint()    │
│  → Find best match (sim≥0.75)   │
│  → INSERT into waypoints        │
└────┬───────────────────────────┘
     │
     ▼  COMMIT
┌────────────────────────────────┐
│  Return {id, sector, sectors}   │
└────────────────────────────────┘
```

### Query Memory Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ POST /memory/query
     │ {query, k, filters}
     ▼
┌────────────────┐
│  API Server    │
└────┬───────────┘
     │
     ▼
┌────────────────────────────────┐
│  HSG: classifyContent(query)    │
│  → candidate sectors            │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Embedding: embedForSector()    │
│  (for each candidate sector)    │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Database: get vectors by       │
│  sector → calculate cosine      │
│  similarity → top-K per sector  │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  HSG: expandViaWaypoints()      │
│  → 1-hop graph traversal        │
│  → Add linked memories          │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  HSG: computeRetrievalScore()   │
│  For each memory:               │
│  score = 0.6×sim + 0.2×sal +    │
│          0.1×rec + 0.1×way      │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Sort by score → top K          │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Reinforcement:                 │
│  1. Boost salience (+0.1)       │
│  2. Strengthen waypoints (+0.05)│
│  3. Update last_seen_at         │
└────┬───────────────────────────┘
     │
     ▼
┌────────────────────────────────┐
│  Return {matches: [...]}        │
└────────────────────────────────┘
```

---

## Configuration

### Environment Variables

```bash
# Server
OM_PORT=8080
OM_DB_PATH=./data/openmemory.sqlite
OM_API_KEY=                      # Optional bearer token

# Embeddings
OM_EMBEDDINGS=openai             # openai|gemini|aws|ollama|local|synthetic
OM_EMBED_MODE=simple             # simple|advanced
OM_ADV_EMBED_PARALLEL=false      # Parallel in advanced mode
OM_EMBED_DELAY_MS=200            # Delay between calls
OM_VEC_DIM=768                   # Vector dimension

# OpenAI
OPENAI_API_KEY=sk-...

# Gemini
GEMINI_API_KEY=...

# AWS
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION="us-east-1"
# Ollama
OLLAMA_URL=http://localhost:11434

# Local
LOCAL_MODEL_PATH=/path/to/model

# Memory
OM_MIN_SCORE=0.3                 # Minimum similarity threshold
OM_DECAY_LAMBDA=0.02             # Default decay rate

# LangGraph Mode
OM_MODE=standard                 # standard|langgraph
OM_LG_NAMESPACE=default
OM_LG_MAX_CONTEXT=50
OM_LG_REFLECTIVE=true
```

---

## Performance Characteristics

### Latency (100k memories)

| Operation            | Latency    | Notes                         |
| -------------------- | ---------- | ----------------------------- |
| Add memory           | 80-120 ms  | Depends on embedding provider |
| Query (simple)       | 110-130 ms | Single-sector search          |
| Query (multi-sector) | 150-200 ms | 2-3 sector fusion             |
| Waypoint expansion   | +30-50 ms  | Per hop                       |
| Decay process        | ~10 sec    | Background, every 24h         |

### Storage (SQLite)

| Item                 | Size       | Notes              |
| -------------------- | ---------- | ------------------ |
| Memory metadata      | ~500 bytes | Per memory         |
| Vector (768d)        | ~3 KB      | Per sector         |
| Waypoint             | ~100 bytes | Per link           |
| **Total per memory** | ~4-6 KB    | Depends on sectors |
| **100k memories**    | ~500 MB    | Typical            |
| **1M memories**      | ~5 GB      | With indexing      |

### Throughput

| Operation       | Rate         | Notes             |
| --------------- | ------------ | ----------------- |
| Add (synthetic) | ~40 ops/s    | No external API   |
| Add (OpenAI)    | ~10-15 ops/s | Rate limited      |
| Add (Ollama)    | ~8-12 ops/s  | CPU bound         |
| Query           | ~30-50 ops/s | In-memory vectors |

---

## Scalability Considerations

### Horizontal Scaling

**Strategy:** Shard by sector

```
┌─────────────────┐
│  Load Balancer  │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┬─────────┐
    ▼         ▼        ▼        ▼         ▼
  episodic  semantic  proc.  emotional  reflect.
  instance  instance  inst.  instance   instance
```

**Benefits:**

- Sector-specific optimization
- Independent scaling per sector
- Reduced contention

**Trade-offs:**

- Cross-sector queries need aggregation
- Waypoints may span instances

### Vertical Scaling

**Bottlenecks:**

1. Embedding API rate limits → Use batch mode
2. SQLite write contention → Use WAL mode
3. Vector similarity computation → Use SIMD

**Optimizations:**

- Enable WAL mode (write-ahead logging)
- Use connection pooling
- Cache mean vectors in memory
- Pre-compute sector statistics

---

## Security

### Authentication

- Optional bearer token (`OM_API_KEY`)
- All write endpoints check auth
- Read endpoints can be public

### Data Privacy

- 100% local storage (no vendor lock-in)
- Optional content encryption at rest
- PII scrubbing hooks available
- Tenant isolation support

### Best Practices

1. Use HTTPS in production
2. Set `OM_API_KEY` for write protection
3. Run behind reverse proxy (nginx/caddy)
4. Regular SQLite backups
5. Monitor embedding logs for failures

---

## Deployment

### Docker (Recommended)

```bash
docker compose up -d
```

Ports:

- `8080` → API server
- Data persisted in `/data/openmemory.sqlite`

### Manual

```bash
cd packages/openmemory-js
npm install
npm run dev
```

### Production

```bash
npm run build
npm start
```

**Systemd service:**

```ini
[Unit]
Description=OpenMemory Service
After=network.target

[Service]
Type=simple
User=openmemory
WorkingDirectory=/opt/openmemory/packages/openmemory-js
ExecStart=/usr/bin/node dist/server/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Monitoring

### Health Check

```bash
GET /health

Response:
{
  "ok": true,
  "version": "2.0-hsg",
  "embedding": {
    "provider": "openai",
    "dimensions": 768,
    "configured": true
  }
}
```

### Sector Stats

```bash
GET /sectors

Response:
{
  "sectors": ["episodic", "semantic", ...],
  "configs": {...},
  "stats": [
    {"sector": "semantic", "count": 1523, "avg_salience": 0.65},
    ...
  ]
}
```

### Embedding Logs

Query `embed_logs` table for:

- Failed embedding attempts
- Rate limit issues
- Provider errors

---

## Future Architecture Enhancements

### v1.3: Learned Sector Classifier

- Replace regex patterns with Tiny Transformer
- Train on user data for better classification
- Adaptive sector weighting

### v1.4: Federated Multi-Node

- Distributed waypoint graph
- Consensus protocol for salience
- Cross-node query federation

### v1.5: Pluggable Vector Backends

- Support pgvector (PostgreSQL)
- Support Weaviate/Qdrant
- Abstraction layer for vector ops

---

## Glossary

| Term                | Definition                                                          |
| ------------------- | ------------------------------------------------------------------- |
| **HMD**             | Hierarchical Memory Decomposition - the core architecture           |
| **Sector**          | Memory type (episodic, semantic, procedural, emotional, reflective) |
| **Salience**        | Importance score (0-1) that decays over time                        |
| **Waypoint**        | Associative link between memories (single strongest only)           |
| **Decay**           | Time-based reduction in salience (sector-specific)                  |
| **Reinforcement**   | Boosting salience/waypoint strength on recall                       |
| **Mean Vector**     | Weighted average of all sector vectors (for waypoint matching)      |
| **Composite Score** | 0.6×similarity + 0.2×salience + 0.1×recency + 0.1×waypoint          |

---

## References

- [README.md](./README.md) - Getting started
- [Why.md](./Why.md) - Architectural rationale
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guide
- [SECURITY.md](./SECURITY.md) - Security policy
- [API Documentation](./docs/api.md) - Endpoint details
