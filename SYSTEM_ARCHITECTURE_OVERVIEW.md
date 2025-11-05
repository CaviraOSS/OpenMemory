# OpenMemory: Comprehensive System Architecture Overview

## Executive Summary

OpenMemory is a **self-hosted, open-source long-term memory system** for AI agents and LLM applications. It implements **Hierarchical Memory Decomposition (HMD) v3**, a cognitive architecture inspired by how human brains organize and retrieve memories across multiple sectors (episodic, semantic, procedural, emotional, reflective).

**Key Differentiators:**
- 2-3x faster than competing solutions (avg 115ms query time vs 250-400ms)
- 6-10x cheaper than cloud alternatives (self-hosted, no vendor fees)
- 95% recall accuracy with multi-sector embeddings
- Framework-agnostic (works with any LLM: OpenAI, Gemini, Ollama, Claude)
- 100% data ownership and control
- Full transparency in memory formation, storage, decay, and retrieval

---

## 1. Overall Architecture and Purpose

### 1.1 What OpenMemory Solves

**The Problem:** Traditional AI systems have:
- Limited context windows (4k-128k tokens)
- No persistent long-term memory
- Vector databases that treat all data equally (no semantic structure)
- Black-box memory systems (Supermemory, Mem0, OpenAI Memory)
- High operational costs and vendor lock-in

**The Solution:** OpenMemory provides:
- Structured, **cognitive** memory organized by type
- **Persistent** memory across unlimited sessions
- **Explainable** recall paths (not just similarity scores)
- **Decay** mechanics (memories fade naturally)
- **Reinforcement** (memories strengthen with use)
- **Waypoint graphs** (associative linking between memories)

### 1.2 Core Philosophy

> "Memory is not a database. It's a dynamic system that evolves, decays, and recalls—contextually and semantically."

Every memory is a **living object** with:
- Time-based decay rates (sector-specific)
- Salience scores (importance)
- Recency tracking
- Reinforcement through coactivation
- Associative links to related memories

---

## 2. Core Components and Their Responsibilities

### 2.1 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                               │
│  HTTP | JavaScript SDK | Python SDK | LangGraph | VS Code Ext   │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                   REST API SERVER                               │
│              (TypeScript/Node.js Port 8080)                     │
├──────────────────────────────────────────────────────────────────┤
│  • Authentication & Rate Limiting                               │
│  • Request routing (9 route modules)                            │
│  • Health checks & metrics                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ HSG Memory   │ │  Embedding   │ │ Ingestion    │
│ Engine       │ │  Processor   │ │ Pipeline     │
│              │ │              │ │              │
│ • Classify   │ │ • OpenAI     │ │ • PDF        │
│ • Encode     │ │ • Gemini     │ │ • DOCX       │
│ • Store      │ │ • Ollama     │ │ • URL        │
│ • Query      │ │ • Local      │ │ • Chunking   │
│ • Decay      │ │ • Synthetic  │ │              │
│ • Reinforce  │ │ • Batch API  │ │              │
└──────┬───────┘ └──────────────┘ └──────────────┘
       │
    ┌──┴──┐
    │     │
    ▼     ▼
┌──────┐┌──────────────────┐
│ DB   ││  Waypoint Graph  │
│      ││  (Associative)   │
│SQLite││                  │
│or    ││  • Single-way    │
│PG    ││  • Auto-link     │
│      ││  • Reinforce     │
└──────┘│  • Prune         │
        └──────────────────┘
```

### 2.2 REST API Server (`backend/src/server/`)

**Purpose:** HTTP endpoint layer for all memory operations

**Key Servers:**
- **Express.js** for HTTP routing
- CORS middleware for cross-origin requests
- Bearer token authentication (optional)
- Request tracking and dashboard metrics
- Scheduled tasks (decay, waypoint pruning, reflection, user summaries)

**Initialization Flow:**
1. Load configuration from environment
2. Initialize database connection
3. Set up authentication middleware
4. Mount 9 route handlers
5. Start decay process (every 24 hours)
6. Start reflection process (auto-consolidation)
7. Start user summary process
8. Listen on configured port

---

## 3. Memory Management System

### 3.1 Five Memory Sectors

OpenMemory organizes memories into **five cognitive sectors**, each with distinct characteristics:

| Sector | Purpose | Decay Rate | Weight | Pattern Keywords |
|--------|---------|------------|--------|-------------------|
| **Episodic** | Event memories, temporal data | 0.015 | 1.2 | "today", "yesterday", "happened", "experience" |
| **Semantic** | Facts, knowledge, preferences | 0.005 | 1.0 | "define", "meaning", "fact", "concept" |
| **Procedural** | How-to, processes, patterns | 0.008 | 1.1 | "how to", "step by step", "process", "configure" |
| **Emotional** | Feelings, sentiment, tone | 0.020 | 1.3 | "feel", "happy", "love", "amazing", "!!" |
| **Reflective** | Meta-cognition, insights, logs | 0.001 | 0.8 | "think", "realize", "insight", "lesson", "should have" |

**How Memory Gets Classified:**

```typescript
// Pattern matching on content + regex scoring
classify_content(text) {
  1. Check metadata.sector (explicit routing)
  2. For each sector, count pattern matches
  3. Weight patterns by sector weight
  4. Pick primary (highest score)
  5. Pick additional (≥30% of primary)
  6. Return {primary, additional[], confidence}
}
```

### 3.2 Memory Data Model

**Core Memory Structure:**

```typescript
type mem_row = {
  id: string                // UUID
  content: string           // Full text
  primary_sector: string    // "episodic" | "semantic" | etc.
  tags: string | null       // JSON array as string
  meta: string | null       // Custom JSON metadata
  user_id: string | null    // For multi-user isolation
  
  // Timestamps (milliseconds)
  created_at: number        // When added
  updated_at: number        // Last modification
  last_seen_at: number      // Last query hit
  
  // Memory strength
  salience: number          // Importance (0.0-1.0)
  decay_lambda: number      // Custom decay rate
  version: number           // Edit count
  
  // Vector storage
  mean_dim: integer         // Mean vector dimensions
  mean_vec: bytea           // Mean vector (binary)
  compressed_vec: bytea     // Compressed vector
  feedback_score: number    // Learning score
}
```

**Multi-Sector Embeddings:**

Each memory stores **one vector per sector** it belongs to:

```
Memory "I feel excited about coding at night"
├─ Semantic vector: [0.1, 0.2, 0.3, ...]  (dim: 1536)
├─ Episodic vector: [0.4, 0.5, 0.6, ...]  (dim: 1536)
├─ Emotional vector: [0.7, 0.8, 0.9, ...]  (dim: 1536)
├─ Procedural vector: [... coding patterns ...]
├─ Reflective vector: [... meta-insights ...]
└─ Mean vector: [weighted average]        (dim: 1536)
```

### 3.3 Hierarchical Memory Decomposition (HMD) Engine

**Location:** `backend/src/memory/hsg.ts` (824 lines)

**Core Operations:**

#### A. Adding Memory

```
Input: "User prefers dark mode"
    ↓
1. Classify sector: {primary: 'semantic', additional: [], confidence: 0.95}
    ↓
2. Embed for all sectors:
   - semantic: embed(text) → [0.1, 0.2, ...]
   - emotional: embed(text) → [0.3, 0.4, ...]
    ↓
3. Calculate mean vector:
   - Weight by sector confidence
   - Normalize to unit length
    ↓
4. Store memory + vectors:
   - INSERT memory row
   - INSERT vector rows (one per sector)
    ↓
5. Create waypoint:
   - Find most similar existing memory (cosine > 0.75)
   - Create single-way link: new_id → best_match_id
    ↓
Output: {id, primary_sector, sectors[]}
```

#### B. Querying Memory

```
Input: "What does user prefer visually?"
    ↓
1. Classify query: {primary: 'semantic', additional: []}
    ↓
2. Generate embeddings:
   - For each sector: embed(query)
    ↓
3. Vector similarity search:
   - For each sector, search vectors by cosine similarity
   - Get top-K×3 candidates per sector
    ↓
4. Adaptive expansion via waypoints:
   - If confidence < 0.55, traverse waypoint graph
   - 1-hop expansion, max 20 new items
    ↓
5. Composite scoring for each candidate:
   score = 
     0.6 × boosted_similarity +
     0.2 × token_overlap +
     0.1 × waypoint_weight +
     0.05 × recency_score +
     (hybrid tier) 0.05 × keyword_score
    ↓
6. Reinforce on query hit:
   - Boost salience: +0.1
   - Strengthen waypoints: +0.05
   - Update last_seen_at
    ↓
Output: [{id, content, score, sectors, path}]
```

#### C. Decay Mechanics

**Purpose:** Memories fade naturally over time (like human memory)

```typescript
calculateDecay(sector, initialSalience, daysSinceLastSeen) {
  const lambda = sector_configs[sector].decay_lambda
  const decayed = initialSalience × e^(-lambda × days)
  
  // Add reinforcement factor
  const reinf = alpha_reinforce × (1 - e^(-lambda × days))
  
  return Math.max(0, Math.min(1, decayed + reinf))
}
```

**Sector-Specific Decay Rates:**
- **Reflective (slowest):** 0.001 → takes ~700 days to 50%
- **Semantic:** 0.005 → takes ~140 days to 50%
- **Procedural:** 0.008 → takes ~87 days to 50%
- **Episodic:** 0.015 → takes ~46 days to 50%
- **Emotional (fastest):** 0.020 → takes ~35 days to 50%

**Decay Process (runs every 24 hours):**
1. Fetch all memories
2. Calculate new salience for each
3. Update last_seen_at if decayed
4. Mark "cold" memories for compression
5. Log decay statistics

#### D. Waypoint Graph (Associative Linking)

**Purpose:** Single strongest link between related memories

```
Structure:
  Memory A ──── 0.85 ──→ Memory B
         (weight = 0.85)

Rules:
  • ONE outgoing waypoint per memory (strongest match only)
  • Bidirectional if cross-sector
  • Weight range: 0.0-1.0
  • Created during add_memory if cosine_sim > 0.75
  • Reinforced on query hit (+0.05 per traversal)
  • Pruned when weight < 0.05 (weekly)

Query Benefits:
  • Expand initial results via 1-hop traversal
  • Find contextually related memories
  • Reduce redundancy in recall
```

### 3.4 Memory Reinforcement

**Coactivation Learning:**

When querying, memories that appear together get linked:
- Buffer queries result IDs
- Every 1 second, process 50 pairs
- Calculate temporal proximity
- Strengthen waypoint weight if recently co-accessed
- Max weight: 1.0

**Salience Reinforcement:**

On query hit:
- Boost: `new_salience = min(1.0, old_salience + 0.1)`
- Update: `last_seen_at = now()`
- Decay is reversed/slowed by recent access

---

## 4. API Endpoints and Functionality

### 4.1 Memory Operations Endpoints

```
POST   /memory/add
       Body: {content, tags[], metadata, user_id?}
       Response: {id, primary_sector, sectors[]}

POST   /memory/query
       Body: {query, k?, filters}
       Response: {query, matches[]}

POST   /memory/reinforce
       Body: {id, boost?}
       Response: {ok: boolean}

PATCH  /memory/:id
       Body: {content?, tags?, metadata?}
       Response: memory object

DELETE /memory/:id
       Response: {ok: boolean}

GET    /memory/:id
       Response: full memory with all sectors

GET    /memory/all?l=100&u=0&sector=semantic
       Response: paginated memories
```

### 4.2 Ingestion Endpoints

```
POST   /memory/ingest
       Body: {content_type, data, metadata?, config?}
       Response: {root_memory_id, child_count, total_tokens}

POST   /memory/ingest/url
       Body: {url, metadata?, config?}
       Response: ingestion result

Supported formats:
  - PDF (via pdf-parse)
  - DOCX (via unzipper + xml)
  - HTML (via cheerio)
  - Plain text
  - Audio (via speech-to-text)
```

### 4.3 User Management Endpoints

```
GET    /users/:user_id/summary
       Response: {user_id, summary, reflection_count, updated_at}

POST   /users/:user_id/summary/regenerate
       Response: {ok, summary}

GET    /users/:user_id/memories?l=100&u=0
       Response: {user_id, items[]}

DELETE /users/:user_id/memories
       Response: {ok, deleted_count}

POST   /users/summaries/regenerate-all
       Response: {ok, updated_count}
```

### 4.4 System Endpoints

```
GET    /health
       Response: {ok, version, tier, vec_dim, cache_segments}

GET    /sectors
       Response: {sectors[], configs, stats[]}

GET    /stats
       Response: performance metrics
```

### 4.5 LangGraph Integration (When OM_MODE=langgraph)

```
POST   /lgm/store
       Store memory linked to LangGraph node

POST   /lgm/retrieve
       Retrieve memories for graph session

POST   /lgm/context
       Get summarized multi-sector context

POST   /lgm/reflection
       Generate and store reflections
```

### 4.6 AI Agents Endpoints

```
POST   /ai-agents/state
       Save project state (semantic memory)

GET    /ai-agents/state/:project
       Load project state, detect mode (INITIALIZE|RESUME)

POST   /ai-agents/action
       Record agent action (episodic memory)

POST   /ai-agents/pattern
       Store coding pattern (procedural memory)

POST   /ai-agents/decision
       Record architectural decision (reflective memory)

POST   /ai-agents/query
       Query project memories

GET    /ai-agents/history/:project
       Get development history

GET    /ai-agents/patterns/:project
       Get all discovered patterns

GET    /ai-agents/decisions/:project
       Get all decisions

GET    /ai-agents/context/:project
       Get comprehensive context for resume
```

---

## 5. Database Schema and Models

### 5.1 Tables

**Memories Table:**
```sql
CREATE TABLE openmemory_memories (
  id UUID PRIMARY KEY,
  user_id TEXT,
  segment INTEGER DEFAULT 0,
  content TEXT NOT NULL,
  simhash TEXT,
  primary_sector TEXT NOT NULL,
  tags TEXT,
  meta TEXT,
  created_at BIGINT,
  updated_at BIGINT,
  last_seen_at BIGINT,
  salience DOUBLE,
  decay_lambda DOUBLE,
  version INTEGER DEFAULT 1,
  mean_dim INTEGER,
  mean_vec BYTEA,
  compressed_vec BYTEA,
  feedback_score DOUBLE DEFAULT 0
);

INDEX: primary_sector, segment, simhash, user_id
```

**Vectors Table (per sector):**
```sql
CREATE TABLE openmemory_vectors (
  id UUID,
  sector TEXT,
  v BYTEA,
  dim INTEGER NOT NULL,
  PRIMARY KEY (id, sector)
);
```

**Waypoints Table:**
```sql
CREATE TABLE openmemory_waypoints (
  src_id TEXT PRIMARY KEY,
  dst_id TEXT NOT NULL,
  weight DOUBLE NOT NULL,
  created_at BIGINT,
  updated_at BIGINT
);
```

**Other Tables:**
- `openmemory_embed_logs` - Embedding job status
- `openmemory_users` - User summaries and reflection counts
- `openmemory_memories_fts` - Full-text search (SQLite)

### 5.2 Data Types

**Vector Storage:**
- Format: Float32Array → Buffer (binary)
- Dimensions: Configurable per tier (256-1536)
- Compression: Min-max pooling for storage
- Cosine similarity: Fast inner-product calculation

**Salience & Decay:**
- Range: 0.0-1.0 (normalized)
- Decay: Exponential decay with sector-specific lambda
- Reinforcement: On query hit, coactivation
- Feedback: Exponential moving average (90% old, 10% new)

---

## 6. Configuration System

### 6.1 Environment Variables

**Core Settings:**
```
OM_PORT=8080                              # Server port
OM_TIER=hybrid|fast|smart|deep            # Performance tier
OM_MODE=standard|langgraph                # Operating mode
OM_API_KEY=...                            # Optional auth token
```

**Database:**
```
OM_METADATA_BACKEND=sqlite|postgres
OM_DB_PATH=./data/openmemory.sqlite
OM_VECTOR_BACKEND=sqlite|pgvector|weaviate
```

**Embeddings:**
```
OM_EMBEDDINGS=openai|gemini|ollama|local|synthetic
OM_EMBED_MODE=simple|advanced
OM_VEC_DIM=1536                          # Auto-adjusted by tier
OPENAI_API_KEY=...
GEMINI_API_KEY=...
OLLAMA_URL=http://localhost:11434
```

**Memory Settings:**
```
OM_DECAY_INTERVAL_MINUTES=1440            # Every 24h
OM_DECAY_LAMBDA=0.02                      # Default decay rate
OM_MIN_SCORE=0.3                          # Query threshold
OM_DECAY_REINFORCE_ON_QUERY=true
OM_AUTO_REFLECT=true                      # Auto-consolidation
OM_REFLECT_INTERVAL=10                    # Every 10 minutes
```

### 6.2 Performance Tiers

| Tier | Vec Dim | Query Speed | Recall | Use Case |
|------|---------|-------------|--------|----------|
| **fast** | 256 | 700-850 QPS | 70% | Local extensions |
| **smart** | 384 | 500-600 QPS | 85% | Production servers |
| **deep** | 1536 | 350-400 QPS | 94% | Cloud, high accuracy |
| **hybrid** | 256 | 700-800 QPS | 98% | Synthetic + semantic |

**Tier Selection:**
- `fast`: Synthetic embeddings only
- `smart`: Synthetic (60%) + compressed semantic (40%)
- `deep`: Full semantic embeddings
- `hybrid`: Synthetic + compressed semantic with boosted similarity

### 6.3 models.yml Configuration

```yaml
episodic:
  ollama: nomic-embed-text
  openai: text-embedding-3-small
  gemini: models/embedding-001
  local: all-MiniLM-L6-v2

semantic:
  ollama: nomic-embed-text
  openai: text-embedding-3-small
  gemini: models/embedding-001

# ... per sector ...

reflective:
  openai: text-embedding-3-large  # Larger for meta-cognition
  local: all-mpnet-base-v2
```

---

## 7. Key Workflows and Data Flows

### 7.1 Complete Add Memory Flow

```
Client: POST /memory/add
  {content: "...", tags, metadata, user_id}
    │
    ├→ 1. CLASSIFY SECTOR
    │     classify_content(text)
    │     → {primary: 'semantic', additional: [], confidence: 0.9}
    │
    ├→ 2. EMBED FOR SECTORS
    │     For each sector in {primary, additional}:
    │       embedForSector(text, sector)
    │       → [0.1, 0.2, ..., 0.n]
    │
    ├→ 3. CALCULATE MEAN VECTOR
    │     For multi-sector embeddings:
    │       - Weight by sector weight (episodic: 1.2, etc.)
    │       - Exponential weighting
    │       - Normalize to unit length
    │
    ├→ 4. COMPUTE SIMHASH
    │     simhash(content) → 64-bit hash for dedup
    │
    ├→ 5. STORE MEMORY & VECTORS
    │     transaction.begin()
    │       INSERT memory row
    │       INSERT vector rows (one per sector)
    │     transaction.commit()
    │
    ├→ 6. CREATE WAYPOINT
    │     create_single_waypoint(new_id, mean_vec)
    │       - Search all existing memories
    │       - Find best match (highest cosine sim)
    │       - If sim > 0.75: create waypoint
    │
    ├→ 7. UPDATE USER SUMMARY (async)
    │     If user_id provided:
    │       update_user_summary(user_id)
    │
    └→ Response: {id, primary_sector, sectors[]}
```

### 7.2 Complete Query Flow

```
Client: POST /memory/query
  {query: "...", k: 8, filters: {user_id?, sector?, min_score?}}
    │
    ├→ 1. CLASSIFY QUERY
    │     classify_content(query)
    │     → {primary: 'semantic', additional: []}
    │
    ├→ 2. EMBED QUERY
    │     qe = {} 
    │     For each candidate sector:
    │       qe[sector] = embedForSector(query, sector)
    │
    ├→ 3. SECTOR-WISE VECTOR SEARCH
    │     For each sector in candidate sectors:
    │       vectors = get_vectors(sector)
    │       for each vector:
    │         similarity = cosine(query_vec, memory_vec)
    │       sort by similarity descending
    │       take top K×3
    │
    ├→ 4. ADAPTIVE WAYPOINT EXPANSION
    │     avg_top_sim = mean of top similarities
    │     if avg_top_sim < 0.55:
    │       results = expand_via_waypoints(results, k×2)
    │       (1-hop graph traversal)
    │
    ├→ 5. COLLECT CANDIDATE MEMORIES
    │     all_ids = union of:
    │       - Top results per sector
    │       - Expanded via waypoints
    │
    ├→ 6. COMPOSITE SCORING
    │     For each memory:
    │       - Get current salience
    │       - Calculate decay: salience × e^(-lambda × days)
    │       - Token overlap: count(query_tokens ∩ memory_tokens)
    │       - Recency: e^(-days/7)
    │       - Waypoint weight (if traversed)
    │       - Keyword score (hybrid tier only)
    │       
    │       score = 0.6×boosted_sim +
    │               0.2×token_overlap +
    │               0.1×waypoint_weight +
    │               0.05×recency +
    │               keyword_boost
    │       
    │       score = sigmoid(score)
    │
    ├→ 7. NORMALIZE SCORES
    │     scores = (scores - mean) / stddev
    │     (z-score normalization)
    │
    ├→ 8. SORT & TRUNCATE
    │     sort by score descending
    │     take top K
    │
    ├→ 9. REINFORCE ON HIT
    │     For each top result:
    │       - Boost salience: +0.1
    │       - Update last_seen_at
    │       - Strengthen waypoints: +0.05
    │       - Add to coactivation buffer
    │
    ├→ 10. FILTER BY USER_ID
    │      If filters.user_id provided:
    │        filter results by memory.user_id
    │
    └→ Response: {query, matches: [{id, content, score, sectors, path}]}
```

### 7.3 Decay Process (Every 24 Hours)

```
Trigger: setInterval(every 24 hours)
    │
    ├→ 1. FETCH ALL MEMORIES
    │     SELECT * FROM memories
    │
    ├→ 2. CALCULATE NEW SALIENCE
    │     For each memory:
    │       days_since = (now - last_seen_at) / 86400000
    │       new_salience = calc_decay(sector, salience, days_since)
    │
    ├→ 3. UPDATE DECAY STATE
    │     For memories with new_salience < old_salience:
    │       UPDATE memory SET
    │         salience = new_salience,
    │         updated_at = now()
    │
    ├→ 4. IDENTIFY COLD MEMORIES
    │     If salience < 0.25:
    │       Mark as 'cold'
    │       (Candidate for compression)
    │
    ├→ 5. LOG STATISTICS
    │     console.log(`Decay: ${decayed}/${processed}`)
    │
    └→ Completion
```

### 7.4 User Summary Reflection

```
Trigger: Every 30 minutes
    │
    ├→ 1. GET USER MEMORIES
    │     SELECT * FROM memories WHERE user_id = ?
    │     Limit: 100 most recent
    │
    ├→ 2. ANALYZE SECTORS
    │     Group by primary_sector
    │     Calculate stats per sector
    │
    ├→ 3. GENERATE SUMMARY
    │     Using top keywords + content
    │     Max length: 200 chars
    │
    ├→ 4. CALCULATE REFLECTION COUNT
    │     Count reflections created for user
    │
    ├→ 5. STORE SUMMARY
    │     INSERT/UPDATE openmemory_users
    │       user_id, summary, reflection_count, updated_at
    │
    └→ Complete
```

### 7.5 Auto-Reflection (Consolidation)

```
Trigger: Every 10 minutes (if OM_AUTO_REFLECT=true)
    │
    ├→ 1. FETCH RECENT MEMORIES
    │     SELECT * FROM memories
    │     LIMIT 100
    │     ORDER BY created_at DESC
    │
    ├→ 2. CLUSTER SIMILAR MEMORIES
    │     For each memory:
    │       For each other memory in same sector:
    │         similarity = token_similarity(content1, content2)
    │         If sim > 0.8:
    │           Add to cluster
    │
    ├→ 3. CREATE REFLECTIONS
    │     For each cluster with 2+ items:
    │       - Calculate cluster salience
    │       - Create summary text
    │       - Store as 'reflective' memory
    │       - Mark originals as 'consolidated'
    │       - Boost original salience
    │
    ├→ 4. LOG MAINTENANCE
    │     Log operation in embed_logs
    │
    └→ Complete
```

---

## 8. Performance Characteristics

### 8.1 Benchmarks (OpenMemory vs Competitors)

| Operation | OpenMemory | Zep | Supermemory | Mem0 |
|-----------|------------|-----|-------------|------|
| Single query (100k) | 115 ms | 250 ms | 170-250 ms | 250 ms |
| Add memory | 30 ms | 95 ms | 125 ms | 60 ms |
| User summary | 95 ms | N/A | N/A | N/A |
| Throughput | 338 QPS | 180 QPS | 220 QPS | 150 QPS |
| Recall@5 | 95% | 91% | 93% | 88-90% |
| Cost/1M tokens | $0.35 | $2.2 | $2.5+ | $1.2 |

### 8.2 Storage Efficiency

| Scale | SQLite | PostgreSQL | RAM | Query Time |
|-------|--------|------------|-----|------------|
| 10k | 150 MB | 180 MB | 300 MB | 50 ms |
| 100k | 1.5 GB | 1.8 GB | 750 MB | 115 ms |
| 1M | 15 GB | 18 GB | 1.5 GB | 200 ms |
| 10M | 150 GB | 180 GB | 6 GB | 350 ms |

### 8.3 Concurrency Model

```
Max Active Queries (configurable per tier):
  - fast: 32
  - smart: 64
  - deep: 128
  - hybrid: 64

If exceeded: throw "Rate limit: X active (max Y)"

Caching Strategy:
  - Query cache (TTL: 60s): {query, k, filters} → results
  - Salience cache (TTL: 60s): memory_id → salience
  - Vector cache (TTL: 60s): max 1000 vectors
  - Segment cache: configurable per tier
  - Mean vectors: in-memory lookup
```

---

## 9. AI Agents Integration System

### 9.1 Architecture

OpenMemory + AI Agents creates a **memory-enabled autonomous development system**:

```
AI Agent Layer
├─ Architect Agent
├─ Developer Agent
└─ DevOps Agent
    │
    ▼
OpenMemory Client (Python SDK)
    │
    ├→ POST /ai-agents/state       (Save state)
    ├→ GET /ai-agents/state/:proj  (Load state, detect mode)
    ├→ POST /ai-agents/action      (Log actions)
    ├→ POST /ai-agents/pattern     (Store patterns)
    └→ POST /ai-agents/decision    (Record decisions)
    │
    ▼
OpenMemory REST API (Port 8080)
    │
    ▼
Multi-Sector Cognitive Memory
├─ Semantic: Project state, config
├─ Episodic: Development history
├─ Procedural: Coding patterns
├─ Emotional: [optional sentiment]
└─ Reflective: Architectural decisions
    │
    ▼
Persistent Storage (SQLite/PostgreSQL)
```

### 9.2 Session Mode Detection

```python
mode = client.detect_mode()  # Returns: "INITIALIZE" or "RESUME"

INITIALIZE: No previous project state found
  - Create new project structure
  - Initialize all systems
  - Record foundational decisions
  - Save initial state

RESUME: Previous project state found
  - Load full context
  - Retrieve recent actions
  - Access all patterns
  - Review past decisions
  - Continue from last position
```

### 9.3 Memory Mapping for AI Agents

| Agent Activity | Memory Sector | OpenMemory Endpoint | Purpose |
|----------------|---------------|---------------------|---------|
| Project configuration | Semantic | `/ai-agents/state` | Current project metadata, tech stack |
| Development actions | Episodic | `/ai-agents/action` | What was done, when, by whom |
| Discovered patterns | Procedural | `/ai-agents/pattern` | Reusable code patterns, best practices |
| Architectural decisions | Reflective | `/ai-agents/decision` | Why decisions were made, alternatives |

### 9.4 Typical Agent Workflow

**Day 1 - Initialize:**

```python
# 1. Detect mode
mode = client.detect_mode()  # "INITIALIZE"

# 2. Record decisions
client.record_decision(
  decision="Use TypeScript + Express",
  rationale="Type safety, ecosystem",
  alternatives="JavaScript, Python"
)

# 3. Store patterns
client.store_pattern(
  pattern_name="Service Layer",
  description="Abstract data access"
)

# 4. Record actions
client.record_action(
  agent_name="architect",
  action="Created base project structure",
  outcome="success"
)

# 5. Save state
client.save_project_state({
  "project_metadata": {...},
  "services": {...},
  "next_tasks": [...]
})
```

**Day 15 - Resume:**

```python
# 1. Detect mode
mode = client.detect_mode()  # "RESUME"

# 2. Load full context
context = client.get_full_context()
# Returns: {state, recent_actions, patterns, decisions}

# 3. Continue from last position
next_task = context['state']['next_tasks'][0]

# 4. Implement task using established patterns
# (patterns inform implementation style)

# 5. Record new findings
client.record_decision(...) # New decision
client.store_pattern(...)    # New pattern
client.record_action(...)    # New action

# 6. Update state
client.save_project_state(updated_state)
```

---

## 10. Security and Privacy

### 10.1 Authentication

```
OM_API_KEY=secret_key_here

If set:
  - All requests require: Authorization: Bearer {key}
  - Rate limiting enforced
  - Requests logged to console (if OM_LOG_AUTH=true)

If not set:
  - Development mode: no auth required
  - Not recommended for production
```

### 10.2 Data Ownership

- **100% self-hosted:** No data leaves your infrastructure
- **SQLite default:** Local file-based storage
- **PostgreSQL option:** Your own database server
- **No vendor access:** Completely private

### 10.3 Encryption Options

- Vectors stored as Float32 buffers (not encrypted by default)
- Content stored as plain text in database
- TLS/SSL for API calls (recommended in production)
- Optional: Application-level encryption before storage

---

## 11. Deployment Scenarios

### 11.1 Local Development

```bash
cd backend
npm install
npm run dev
# Server on http://localhost:8080
```

### 11.2 Docker Compose

```bash
docker compose up --build -d
# Runs on port 8080
# Data persists in /data/openmemory.sqlite
```

### 11.3 Production Server

```
Hardware: 4 vCPU, 8GB RAM VPS
Tier: smart or deep
Database: PostgreSQL
Embeddings: OpenAI or Ollama
Cost: $8-25/month + embedding API
```

### 11.4 Cloud Deployment

Options:
- **Heroku/Railway:** Easy one-click deploy
- **Docker → AWS/GCP:** Container orchestration
- **Kubernetes:** For massive scale
- **Managed PostgreSQL:** AWS RDS, Google Cloud SQL

---

## 12. Summary: Architecture Strengths

1. **Cognitive Structure:** Five-sector organization mirrors human memory
2. **Explainability:** Every query includes retrieval path
3. **Efficiency:** 2-3x faster than competitors with hybrid embeddings
4. **Decay Mechanics:** Natural forgetting prevents bloat
5. **Reinforcement:** Smart memories strengthen with use
6. **Graph Associations:** Waypoint linking finds contextual relationships
7. **Multi-user:** User_id isolation for multi-tenant systems
8. **Framework-agnostic:** Works with any LLM
9. **Extensible:** Support for multiple embedding providers
10. **AI-Ready:** Built specifically for agent systems

---

## 13. Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `backend/src/memory/hsg.ts` | 824 | Core HSG engine, all memory ops |
| `backend/src/memory/decay.ts` | 284 | Decay algorithm & memory compression |
| `backend/src/memory/embed.ts` | 242 | Multi-provider embedding system |
| `backend/src/core/db.ts` | 300+ | Database layer, SQLite/PostgreSQL |
| `backend/src/server/routes/memory.ts` | 200+ | Memory API endpoints |
| `backend/src/server/routes/ai-agents.ts` | 400+ | AI agents integration |
| `backend/src/server/index.ts` | 74 | Server initialization, decay/reflection scheduling |
| `sdk-py/openmemory/client.py` | 400+ | Python SDK for clients |
| `ARCHITECTURE.md` | 500+ | Detailed architecture docs |

---

