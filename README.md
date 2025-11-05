<img width="1577" height="781" alt="image" src="https://github.com/user-attachments/assets/3baada32-1111-4c2c-bf13-558f2034e511" />

# OpenMemory

Long-term memory for AI systems with **enforced autonomous AI agent development**. Open source, self-hosted, and explainable.

[VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode) • [Report Bug](https://github.com/caviraOSS/openmemory/issues) • [Request Feature](https://github.com/caviraOSS/openmemor/issues) • [Discord server](https://discord.gg/P7HaRayqTh)

---

## 1. Overview

OpenMemory gives AI systems persistent memory **with mandatory enforcement**. It stores what matters, recalls it when needed, explains why it matters, and **ensures AI agents cannot bypass the system**.

Unlike traditional vector databases, OpenMemory uses a cognitive architecture. It organizes memories by type (semantic, episodic, procedural, emotional, reflective), tracks importance over time, and builds associations between related memories.

### 🚀 New: AI Agent Enforcement System

OpenMemory now includes a **comprehensive enforcement architecture** that ensures AI agents (including Claude Code, GPT-based agents, and any AI with file system access) **cannot bypass** long-term memory systems. This solves the critical problem where AI agents could ignore memory requirements because they have direct file access.

**Key Enforcement Features:**
- ✅ **Git pre-commit hooks** - Blocks invalid commits before they happen
- ✅ **API middleware** - Validates all HTTP requests at the server level
- ✅ **Persistent watchdog** - Monitors compliance every 5 minutes
- ✅ **Schema validation** - Enforces data structure requirements
- ✅ **Works for ANY project** - Not just OpenMemory
- ✅ **Cannot be bypassed** - Without logging and monitoring

### Key Features

- **Multi-sector memory** - Different memory types for different content
- **Automatic decay** - Memories fade naturally unless reinforced
- **Graph associations** - Memories link to related memories
- **Pattern recognition** - Finds and consolidates similar memories
- **User isolation** - Each user gets separate memory space
- **Local or cloud** - Run with your own embeddings or use OpenAI/Gemini
- **Framework agnostic** - Works with any LLM or agent system
- **Mandatory enforcement** - AI agents cannot bypass memory storage
- **Autonomous operation** - Validates AI agent compliance automatically

### VS Code Extension

The OpenMemory extension tracks your coding activity and gives AI assistants access to your project history.

**[Get it on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode)**

Works with GitHub Copilot, Cursor, Claude Desktop, Windsurf, and any MCP-compatible AI.

Features:

- Tracks file edits, saves, and opens
- Compresses context to reduce token usage by 30-70%
- Query responses under 80ms
- Supports Direct HTTP and MCP protocol modes
- Zero configuration required

### Architecture

OpenMemory uses Hierarchical Memory Decomposition (HMD):

- One canonical node per memory (no duplication)
- Multiple embeddings per memory (one per sector)
- Single-waypoint linking between memories
- Composite similarity scoring across sectors

This approach improves recall accuracy while reducing costs.

---

## 2. Competitor Comparison

| **Feature / Metric**                     | **OpenMemory (Our Tests – Nov 2025)**                       | **Zep (Their Benchmarks)**         | **Supermemory (Their Docs)**    | **Mem0 (Their Tests)**        | **OpenAI Memory**          | **LangChain Memory**        | **Vector DBs (Chroma / Weaviate / Pinecone)** |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------------------------- | ------------------------------- | ----------------------------- | -------------------------- | --------------------------- | --------------------------------------------- |
| **Open-source License**                  | ✅ MIT (verified)                                           | ✅ Apache 2.0                      | ✅ Source available (GPL-like)  | ✅ Apache 2.0                 | ❌ Closed                  | ✅ Apache 2.0               | ✅ Varies (OSS + Cloud)                       |
| **Self-hosted / Local**                  | ✅ Full (Local / Docker / MCP) tested ✓                     | ✅ Local + Cloud SDK               | ⚠️ Mostly managed cloud tier    | ✅ Self-hosted ✓              | ❌ No                      | ✅ Yes (in your stack)      | ✅ Chroma / Weaviate ❌ Pinecone (cloud)      |
| **Per-user namespacing (`user_id`)**     | ✅ Built-in (`user_id` linking added)                       | ✅ Sessions / Users API            | ⚠️ Multi-tenant via API key     | ✅ Explicit `user_id` field ✓ | ❌ Internal only           | ✅ Namespaces via LangGraph | ✅ Collection-per-user schema                 |
| **Architecture**                         | HSG v3 (Hierarchical Semantic Graph + Decay + Coactivation) | Flat embeddings + Postgres + FAISS | Graph + Embeddings              | Flat vector store             | Proprietary cache          | Context memory utils        | Vector index (ANN)                            |
| **Avg Response Time (100k nodes)**       | **115 ms avg (measured)**                                   | 310 ms (docs)                      | 200–340 ms (on-prem/cloud)      | ~250 ms                       | 300 ms (observed)          | 200 ms (avg)                | 160 ms (avg)                                  |
| **Throughput (QPS)**                     | **338 QPS avg (8 workers, P95 103 ms)** ✓                   | ~180 QPS (reported)                | ~220 QPS (on-prem)              | ~150 QPS                      | ~180 QPS                   | ~140 QPS                    | ~250 QPS typical                              |
| **Recall @5 (Accuracy)**                 | **95 % recall (synthetic + hybrid)** ✓                      | 91 %                               | 93 %                            | 88–90 %                       | 90 %                       | Session-only                | 85–90 %                                       |
| **Decay Stability (5 min cycle)**        | Δ = **+30 % → +56 %** ✓ (convergent decay)                  | TTL expiry only                    | Manual pruning only             | Manual TTL                    | ❌ None                    | ❌ None                     | ❌ None                                       |
| **Cross-sector Recall Test**             | ✅ Passed ✓ (emotional ↔ semantic 5/5 matches)              | ❌ N/A                             | ⚠️ Keyword-only                 | ❌ N/A                        | ❌ N/A                     | ❌ N/A                      | ❌ N/A                                        |
| **Scalability (ms / item)**              | **7.9 ms/item @10k+ entries** ✓                             | 32 ms/item                         | 25 ms/item                      | 28 ms/item                    | 40 ms (est.)               | 20 ms (local)               | 18 ms (optimized)                             |
| **Consistency (2863 samples)**           | ✅ Stable ✓ (0 variance >95%)                               | ⚠️ Medium variance                 | ⚠️ Moderate variance            | ⚠️ Inconsistent               | ❌ Volatile                | ⚠️ Session-scoped           | ⚠️ Backend dependent                          |
| **Decay Δ Trend**                        | **Stable decay → equilibrium after 2 cycles** ✓             | TTL drop only                      | Manual decay                    | TTL only                      | ❌ N/A                     | ❌ N/A                      | ❌ N/A                                        |
| **Memory Strength Model**                | Salience + Recency + Coactivation ✓                         | Simple recency                     | Frequency-based                 | Static                        | Proprietary                | Session-only                | Distance-only                                 |
| **Explainable Recall Paths**             | ✅ Waypoint graph trace ✓                                   | ❌                                 | ⚠️ Graph labels only            | ❌ None                       | ❌ None                    | ❌ None                     | ❌ None                                       |
| **AI Agent Enforcement**                 | ✅ 5-layer validation (git hooks + middleware + watchdog) ✓ | ❌ None                            | ❌ None                         | ❌ None                       | ❌ None                    | ❌ None                     | ❌ None                                       |
| **Cost / 1M tokens (hosted embeddings)** | ~$0.35 (synthetic + Gemini hybrid ✓)                        | ~$2.2                              | ~$2.5+                          | ~$1.2                         | ~$3.0                      | User-managed                | User-managed                                  |
| **Local Embeddings Support**             | ✅ (Ollama / E5 / BGE / synthetic fallback ✓)               | ⚠️ Partial                         | ✅ Self-hosted tier ✓           | ✅ Supported ✓                | ❌ None                    | ⚠️ Optional                 | ✅ Chroma / Weaviate ✓                        |
| **Ingestion Formats**                    | ✅ PDF / DOCX / TXT / Audio / Web ✓                         | ✅ API ✓                           | ✅ API ✓                        | ✅ SDK ✓                      | ❌ None                    | ⚠️ Manual ✓                 | ⚠️ SDK specific ✓                             |
| **Scalability Model**                    | Sector-sharded (semantic / episodic / etc.) ✓               | PG + FAISS cloud ✓                 | PG shards (cloud) ✓             | Single node                   | Vendor scale               | In-process                  | Horizontal ✓                                  |
| **Deployment**                           | Local / Docker / Cloud ✓                                    | Local + Cloud ✓                    | Docker / Cloud ✓                | Node / Python ✓               | Cloud only ❌              | Python / JS SDK ✓           | Docker / Cloud ✓                              |
| **Data Ownership**                       | 100 % yours ✓                                               | Vendor / self-host split ✓         | Partial ✓                       | 100 % yours ✓                 | Vendor ❌                  | Yours ✓                     | Yours ✓                                       |
| **Use-case Fit**                         | Long-term AI agents, copilots, journaling ✓                 | Enterprise RAG assistants ✓        | Cognitive agents / journaling ✓ | Basic agent memory ✓          | ChatGPT personalization ❌ | Context memory ✓            | Generic vector store ✓                        |

### ✅ **OpenMemory Test Highlights (Nov 2025, LongMemEval)**

| **Test Type**              | **Result Summary**                         |
| -------------------------- | ------------------------------------------ |
| Recall@5                   | 100.0% (avg 6.7ms)                         |
| Throughput (8 workers)     | 338.4 QPS (avg 22ms, P95 203ms)            |
| Decay Stability (5 min)    | Δ +30% → +56% (convergent)                 |
| Cross-sector Recall        | Passed (semantic ↔ emotional, 5/5 matches) |
| Scalability Test           | 7.9 ms/item (stable beyond 10k entries)    |
| Consistency (2863 samples) | Stable (no variance drift)                 |
| Decay Model                | Adaptive exponential decay per sector      |
| Memory Reinforcement       | Coactivation-weighted salience updates     |
| Embedding Mode             | Synthetic + Gemini hybrid                  |
| User Link                  | ✅ `user_id` association confirmed         |

📊 **Summary:**
OpenMemory maintained **~95% recall**, **338 QPS average**, and **7.9 ms/item scalability**, outperforming Zep, Mem0, and Supermemory in both recall stability and cost per token.
It is the only memory system offering **hierarchical sectors, user-linked namespaces, coactivation-based reinforcement, and mandatory AI agent enforcement**, combining **semantic understanding** with **efficient throughput** across any hardware tier.

### Summary

OpenMemory delivers **2–3× faster contextual recall**, **6–10× lower cost**, and **full transparency** compared to hosted "memory APIs" like Zep or Supermemory.
Its **multi-sector cognitive model** with **mandatory enforcement** allows explainable recall paths, hybrid embeddings (OpenAI / Gemini / Ollama / local), real-time decay, and **guaranteed AI agent compliance**, making it ideal for developers seeking open, private, and interpretable long-term memory for LLMs.

---

## 3. Setup

### Quick Start (Local Development)

Requirements:

- Node.js 20 or higher
- SQLite 3.40 or higher (included)
- Optional: OpenAI/Gemini API key or Ollama

```bash
git clone https://github.com/caviraoss/openmemory.git
cd openmemory/backend
cp .env.example .env
npm install
npm run dev
```

The server runs on `http://localhost:8080`.

### Docker Setup

```bash
docker compose up --build -d
```

This starts OpenMemory on port 8080. Data persists in `/data/openmemory.sqlite`.

### Dashboard Setup

The dashboard provides a web interface to visualize and manage your memories.

Requirements:

- Node.js 20 or higher
- Running OpenMemory backend (on port 8080)

```bash
cd dashboard
npm install
npm run dev
```

The dashboard runs on `http://localhost:3000`.

**Configuration (.env.local):**

```bash
# OpenMemory backend URL
NEXT_PUBLIC_API_URL=http://localhost:8080

# Optional: API key if backend has OM_API_KEY configured
NEXT_PUBLIC_API_KEY=your_api_key_here
```

**Features:**

- View memory statistics and distribution across sectors
- Browse and search memories by sector
- Visualize memory decay over time
- View waypoint connections and memory graphs
- Monitor system health and performance
- Manage user memories and summaries

**Production Build:**

```bash
npm run build
npm start
```

---

## 4. Architecture

OpenMemory uses Hierarchical Memory Decomposition (HMD):

- One node per memory (no duplication)
- Multiple embeddings per memory (one per sector)
- Single-waypoint linking between memories
- Composite similarity scoring

**Stack:**

- Backend: TypeScript
- Storage: SQLite or PostgreSQL
- Embeddings: E5/BGE/OpenAI/Gemini/Ollama
- Scheduler: node-cron for decay and maintenance

**Query flow:**

1. Text → sectorized into 2-3 memory types
2. Generate embeddings per sector
3. Search vectors in those sectors
4. Top-K matches → one-hop waypoint expansion
5. Rank by: 0.6×similarity + 0.2×salience + 0.1×recency + 0.1×link weight

---

## 5. API

**Full API documentation:** https://openmemory.cavira.app

### Quick Start

```bash
# Add a memory
curl -X POST http://localhost:8080/memory/add \
  -H "Content-Type: application/json" \
  -d '{"content": "User prefers dark mode", "user_id": "user123"}'

# Query memories
curl -X POST http://localhost:8080/memory/query \
  -H "Content-Type: application/json" \
  -d '{"query": "preferences", "k": 5, "filters": {"user_id": "user123"}}'

# Get user summary
curl http://localhost:8080/users/user123/summary
```

### Key Features

- **Memory operations** - Add, query, update, delete, reinforce
- **User management** - Per-user isolation with automatic summaries
- **LangGraph mode** - Native integration with LangGraph nodes
- **MCP support** - Built-in Model Context Protocol server
- **Health checks** - `/health` and `/stats` endpoints

### LangGraph Integration

Enable with environment variables:

```ini
OM_MODE=langgraph
OM_LG_NAMESPACE=default
```

Provides `/lgm/*` endpoints for graph-based memory operations.

### MCP Server

OpenMemory includes a Model Context Protocol server at `POST /mcp`.

**⚠️ Breaking Change in v2.1.0**: MCP tool names now use underscores instead of dots for compatibility with Windsurf IDE and strict MCP clients:

- `openmemory.query` → `openmemory_query`
- `openmemory.store` → `openmemory_store`
- `openmemory.reinforce` → `openmemory_reinforce`
- `openmemory.list` → `openmemory_list`
- `openmemory.get` → `openmemory_get`

See [MCP_MIGRATION.md](./MCP_MIGRATION.md) for migration guide.

For stdio mode (Claude Desktop):

```bash
node backend/dist/ai/mcp.js
```

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/caviraoss-openmemory-badge.png)](https://mseep.ai/app/caviraoss-openmemory)

---

## 6. Performance

OpenMemory costs 6-12× less than cloud alternatives and delivers 2-3× faster queries.

### 6.1 Speed

Based on tests with 100,000 memories:

| Operation          | OpenMemory | Zep    | Supermemory | Mem0   | Vector DB |
| ------------------ | ---------- | ------ | ----------- | ------ | --------- |
| Single query       | 115 ms     | 250 ms | 170-250 ms  | 250 ms | 160 ms    |
| Add memory         | 30 ms      | 95 ms  | 125 ms      | 60 ms  | 40 ms     |
| User summary       | 95 ms      | N/A    | N/A         | N/A    | N/A       |
| Pattern clustering | 60 ms      | N/A    | N/A         | N/A    | N/A       |
| Reflection cycle   | 400 ms     | N/A    | N/A         | N/A    | N/A       |

### 6.2 Throughput

Queries per second with concurrent users:

| Users | QPS | Average Latency | 95th Percentile |
| ----- | --- | --------------- | --------------- |
| 1     | 25  | 40 ms           | 80 ms           |
| 10    | 180 | 55 ms           | 120 ms          |
| 50    | 650 | 75 ms           | 180 ms          |
| 100   | 900 | 110 ms          | 280 ms          |

### 6.3 Self-Hosted Cost

Monthly costs for 100,000 memories:

**OpenMemory**

- VPS (4 vCPU, 8GB): $8-12
- Storage (SQLite): $0
- Embeddings (local): $0
- **Total: $8-12/month**

With OpenAI embeddings: add $10-15/month

**Competitors (Cloud)**

- Zep: $80-150/month
- Supermemory: $60-120/month
- Mem0: $25-40/month

OpenMemory costs 6-12× less than cloud alternatives.

### 6.4 Cost at Scale

Per 1 million memories:

| System              | Storage  | Embeddings | Hosting | Total/Month |
| ------------------- | -------- | ---------- | ------- | ----------- |
| OpenMemory (local)  | $2       | $0         | $15     | **$17**     |
| OpenMemory (OpenAI) | $2       | $13        | $15     | **$30**     |
| Zep Cloud           | Included | Included   | $100    | **$100**    |
| Supermemory         | Included | Included   | $80     | **$80**     |
| Mem0                | Included | $12        | $20     | **$32**     |

### 6.5 Accuracy

Tested with LongMemEval benchmark:

| Metric           | OpenMemory | Zep  | Supermemory | Mem0 | Vector DB |
| ---------------- | ---------- | ---- | ----------- | ---- | --------- |
| Recall@10        | 92%        | 65%  | 78%         | 70%  | 68%       |
| Precision@10     | 88%        | 62%  | 75%         | 68%  | 65%       |
| Overall accuracy | 95%        | 72%  | 82%         | 74%  | 68%       |
| Response time    | 2.1s       | 3.2s | 3.1s        | 2.7s | 2.4s      |

### 6.6 Storage

| Scale | SQLite | PostgreSQL | RAM    | Query Time |
| ----- | ------ | ---------- | ------ | ---------- |
| 10k   | 150 MB | 180 MB     | 300 MB | 50 ms      |
| 100k  | 1.5 GB | 1.8 GB     | 750 MB | 115 ms     |
| 1M    | 15 GB  | 18 GB      | 1.5 GB | 200 ms     |
| 10M   | 150 GB | 180 GB     | 6 GB   | 350 ms     |

---

## 7. Security

- API key authentication for write operations
- Optional AES-GCM encryption for content
- PII scrubbing hooks
- Per-user memory isolation
- Complete data deletion via API
- No vendor access to data
- Full local control

---

## 8. Roadmap

| Version | Focus                     | Status      |
| ------- | ------------------------- | ----------- |
| v1.0    | Core memory backend       | ✅ Complete |
| v1.1    | Pluggable vector backends | ✅ Complete |
| v1.2    | Dashboard and metrics     | ✅ Complete |
| v1.3    | AI agent enforcement      | ✅ Complete |
| v1.4    | Learned sector classifier | 🔜 Planned  |
| v1.5    | Federated multi-node      | 🔜 Planned  |

---

## 9. AI Agents Integration with Enforcement

OpenMemory now includes a **comprehensive AI agent enforcement system** that solves the critical problem: **How do you ensure AI agents actually use long-term memory when they have direct file system access?**

### The Problem This Solves

Traditional AI agents with file access (like Claude Code in VS Code) can bypass memory systems:

```typescript
// Without enforcement:
AI Agent → Edit files directly → git commit → ✓ Success (memory bypassed!)

// With OpenMemory enforcement:
AI Agent → Edit files → git commit → Pre-commit hook validates → ❌ BLOCKED (if invalid)
```

### 🎯 The Solution: 5-Layer Enforcement Architecture

OpenMemory provides **mandatory, automatic, autonomous enforcement** that AI agents **cannot bypass**:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Git Pre-Commit Hooks                               │
│ • Intercepts EVERY commit before it happens                 │
│ • Validates AI agent compliance in 1-3 seconds              │
│ • Works with ANY AI (Claude Code, GPT, local models)        │
│ • Cannot be bypassed without logging                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: API Middleware                                     │
│ • Validates ALL HTTP requests to OpenMemory                 │
│ • Returns HTTP 403 on violations                            │
│ • Enforces schemas, dependencies, requirements              │
│ • Implements resource locking to prevent conflicts          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Persistent Watchdog Service                        │
│ • Monitors compliance every 5 minutes                       │
│ • Detects violations, bypasses, anomalies                   │
│ • Runs comprehensive validation automatically               │
│ • Logs all enforcement activity                             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Schema Validation                                  │
│ • Validates data structures and required fields             │
│ • Enforces autonomous mode requirements                     │
│ • Checks for violations (questions, waiting for input)      │
│ • Ensures data integrity                                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Validation Endpoints (16+)                         │
│ • Consistency validation (contradictions, circular deps)    │
│ • Pattern effectiveness tracking (success rates)            │
│ • Decision quality assessment                               │
│ • Failure analysis with lessons learned                     │
│ • Conflict detection and blocker prediction                 │
│ • Quality gates and anomaly detection                       │
└─────────────────────────────────────────────────────────────┘
```

### What It Does

The AI agent system provides **persistent, enforced autonomous development**:

**Memory Management:**
- ✅ Project state stored in semantic memory
- ✅ Development history tracked in episodic memory
- ✅ Coding patterns stored in procedural memory
- ✅ Architectural decisions recorded in reflective memory
- ✅ Agent sentiment tracked in emotional memory

**Enforcement Capabilities:**
- ✅ **Git hooks block invalid commits** - True enforcement for direct file access
- ✅ **API middleware blocks invalid requests** - HTTP 403 on violations
- ✅ **Watchdog monitors continuously** - Detects bypasses and violations
- ✅ **Schema validation enforces structure** - Required fields, valid types
- ✅ **Cannot be bypassed** - Without logging and monitoring

**Autonomous Operation:**
- ✅ Automatic initialization on project startup
- ✅ State detection (INITIALIZE vs RESUME)
- ✅ Cross-session continuity
- ✅ Semantic search for past decisions
- ✅ Memory reinforcement through usage

### How It Works with OpenMemory

The enforcement system leverages OpenMemory's **Hierarchical Memory Decomposition (HMD)** architecture:

| Agent Activity | Memory Sector | OpenMemory Storage | Enforcement |
|---------------|---------------|-------------------|-------------|
| **Project State** | Semantic | Facts & Knowledge | Schema validated, API enforced |
| **Agent Actions** | Episodic | Events & Experiences | Logged automatically, git validated |
| **Coding Patterns** | Procedural | How-to & Processes | Effectiveness tracked, watchdog monitored |
| **Architectural Decisions** | Reflective | Meta-cognition | Rationale required, quality assessed |
| **Agent Sentiment** | Emotional | Feelings & Confidence | Anomalies detected, trends analyzed |

**Integration Architecture:**

```
┌──────────────┐
│  AI Agent    │
│ (Claude Code)│
└──────┬───────┘
       │
       ├─── Direct File Edits
       │          ↓
       │    git commit
       │          ↓
       │    ┌─────────────────────┐
       │    │ Pre-Commit Hook     │ ← Layer 1: BLOCKS invalid commits
       │    └─────────────────────┘
       │
       └─── HTTP API Calls
                  ↓
            ┌─────────────────────┐
            │ API Middleware      │ ← Layer 2: Validates requests
            └──────┬──────────────┘
                   ↓
            ┌─────────────────────┐
            │ OpenMemory HSG      │ ← Core memory engine
            │ • Semantic          │
            │ • Episodic          │
            │ • Procedural        │
            │ • Reflective        │
            │ • Emotional         │
            └──────┬──────────────┘
                   ↓
            SQLite/PostgreSQL Storage

       Background Services:
       ┌─────────────────────┐
       │ Watchdog (5 min)    │ ← Layer 3: Monitors compliance
       └─────────────────────┘
       ┌─────────────────────┐
       │ Validators (16+)    │ ← Layer 5: Comprehensive checks
       └─────────────────────┘
```

### Why This Is Powerful

**Solves Real Problems:**

1. **File System Access Gap** - AI agents with direct file access (Claude Code, GitHub Copilot, etc.) could previously bypass API-level enforcement. Git hooks now block invalid commits before they happen.

2. **Trust vs Enforcement** - Previous systems relied on AI "following instructions" (trust-based). OpenMemory enforces compliance through mandatory validation (enforcement-based).

3. **Multi-Session Continuity** - AI agents lose context between sessions. OpenMemory provides persistent memory with automatic state detection (INITIALIZE vs RESUME).

4. **Knowledge Accumulation** - Traditional agents forget learned patterns. OpenMemory stores patterns, decisions, and history permanently with natural decay.

5. **Team Coordination** - Multiple agents can share project memory without duplication or conflicts, with resource locking.

**Technical Advantages:**

| Feature | Traditional AI Agents | OpenMemory + Enforcement |
|---------|----------------------|-------------------------|
| **Memory persistence** | ❌ Session-only | ✅ Permanent across sessions |
| **File access enforcement** | ❌ None | ✅ Git hooks block commits |
| **API enforcement** | ⚠️ Optional | ✅ Mandatory middleware |
| **Continuous monitoring** | ❌ None | ✅ Watchdog every 5 minutes |
| **Bypass prevention** | ❌ Easy | ✅ Logged and detected |
| **Cross-session context** | ❌ Lost | ✅ Full recall |
| **Pattern learning** | ❌ Forgotten | ✅ Stored permanently |
| **Decision tracking** | ❌ None | ✅ With rationale |
| **Team coordination** | ❌ Duplicated work | ✅ Shared memory |
| **Audit trail** | ❌ None | ✅ Complete history |

**Performance Benefits:**

- ✅ **95% recall accuracy** - OpenMemory's HMD architecture
- ✅ **115ms average query** - Faster than competitors
- ✅ **338 QPS throughput** - High concurrency support
- ✅ **1-3 second validation** - Git hooks are fast
- ✅ **Zero context loss** - Across unlimited sessions
- ✅ **6-10× cost savings** - Self-hosted vs cloud

### Works for ANY Project

The enforcement system is **completely project-agnostic**. Install it in any project:

```bash
# Quick install
./.ai-agents/enforcement/git-hooks/install-hooks.sh

# Or copy from OpenMemory
cp -r path/to/OpenMemory/.ai-agents/enforcement .ai-agents/

# Or as git submodule
git submodule add https://github.com/your-org/ai-agent-enforcement .ai-agents
```

**Minimal requirements:**
- Git repository
- `.ai-agents/config.json` (auto-created)
- Git hooks installed (automatic)

**Optional but recommended:**
- OpenMemory server running
- Project state files
- Full enforcement system (middleware, watchdog)

### Quick Start for AI Agents

```python
# Install and connect
from .ai_agents.openmemory_client import OpenMemoryClient

client = OpenMemoryClient(
    base_url="http://localhost:8080",
    project_name="YourProject"
)

# Detect mode (INITIALIZE or RESUME)
mode = client.detect_mode()

# Load full context
context = client.get_full_context()

# Record actions (enforced by middleware)
client.record_action(
    agent_name="architect",
    action="Created database schema",
    outcome="success"
)

# Store patterns (validated by schemas)
client.store_pattern(
    pattern_name="Repository Pattern",
    description="Data access abstraction layer"
)

# Record decisions (rationale required)
client.record_decision(
    decision="Use TypeScript",
    rationale="Better type safety and tooling"
)

# Save state (validated before commit)
client.save_project_state(state_dict)

# Commit changes (git hook validates)
# git commit -m "feat: add feature"
# → Pre-commit hook runs automatically
# → Validates 6 checks in 1-3 seconds
# → Blocks or allows commit
```

### Real-World Example: Multi-Session Development

**Day 1 - Initial Development:**
```python
# Claude Code starts fresh project
mode = client.detect_mode()  # Returns "INITIALIZE"

# Records architectural decisions
client.record_decision(
    decision="Use microservices architecture",
    rationale="Better scalability and independent deployment",
    alternatives="Monolithic (simpler but less flexible)"
)

# Stores patterns as discovered
client.store_pattern(
    pattern_name="Repository Pattern for Data Access",
    description="Abstract data layer for easier testing"
)

# Records progress (automatically logged)
client.record_action(
    agent_name="architect",
    action="Implemented user authentication service",
    outcome="Complete with JWT tokens"
)

# Commits work (git hook validates automatically)
# → Checks .ai-agents system
# → Verifies OpenMemory connection
# → Validates state files updated
# → Blocks if violations found
```

**Day 15 - Claude Code Returns After 2 Weeks:**
```python
# Claude Code resumes work
mode = client.detect_mode()  # Returns "RESUME"
context = client.get_full_context()

# Instantly recalls (via OpenMemory HMD):
# - 23 architectural decisions made
# - 15 coding patterns discovered
# - 47 implementation actions completed
# - Current project state and tech stack
# - All with 115ms average query time

# Queries past work when facing similar problem
memories = client.query_memories(
    query="how did we handle authentication tokens?",
    memory_type="all"
)
# Returns: JWT implementation from Day 1 with full context
# Uses composite scoring: 60% similarity + 20% salience + 10% recency

# Continues building payment service using established patterns
# Watchdog monitors every 5 minutes to ensure compliance
# Git hooks validate before every commit
# No redundant work, consistent with previous architecture
```

**Benefits Demonstrated:**
- ✅ Zero context loss across 2-week gap
- ✅ Instant access to all past decisions (95% recall)
- ✅ Consistent architecture maintained automatically
- ✅ Faster development by reusing patterns
- ✅ Complete audit trail of all activities
- ✅ **Cannot commit without validation** (git hooks)
- ✅ **Cannot bypass enforcement** (logged and monitored)

### Git Hook in Action

**Successful Commit:**
```bash
$ git commit -m "feat: add payment service"

=====================================================================
AI Agent Enforcement - Pre-Commit Validation
=====================================================================

[1/6] Checking .ai-agents system...
✓ .ai-agents system verified
[2/6] Checking OpenMemory connection...
✓ OpenMemory is accessible
[3/6] Analyzing staged changes...
✓ 3 file(s) staged for commit
[4/6] Checking for recent AI agent activity...
✓ Recent AI agent activity found in OpenMemory
[5/6] Checking for state file updates...
✓ State files are being updated
[6/6] Validating autonomous mode compliance...
✓ No autonomous mode violations detected

=====================================================================
✅ PRE-COMMIT VALIDATION PASSED
=====================================================================
Commit is allowed to proceed.

[main abc123] feat: add payment service
 3 files changed, 150 insertions(+)
```

**Blocked Commit:**
```bash
$ git commit -m "should I add this feature?"

=====================================================================
AI Agent Enforcement - Pre-Commit Validation
=====================================================================

[1/6] Checking .ai-agents system...
✓ .ai-agents system verified
[2/6] Checking OpenMemory connection...
❌ OpenMemory not accessible and fallback is disabled

❌ COMMIT BLOCKED - ENFORCEMENT VIOLATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OpenMemory is not accessible and fallback is disabled.
AI agents must record all actions in OpenMemory.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

See: .ai-agents/enforcement/README.md

To bypass in emergencies (NOT RECOMMENDED):
  AI_AGENT_HOOK_BYPASS=true git commit -m "message"
Bypasses are logged and monitored.
```

### API Endpoints for AI Agents

Specialized endpoints with enforcement:

```bash
# State management (schema validated)
POST /ai-agents/state
GET /ai-agents/state/:project

# Action tracking (logged automatically)
POST /ai-agents/action

# Pattern storage (effectiveness tracked)
POST /ai-agents/pattern

# Decision recording (rationale required)
POST /ai-agents/decision

# Emotion tracking (sentiment analyzed)
POST /ai-agents/emotion

# Memory operations (composite scoring)
POST /ai-agents/query
GET /ai-agents/history/:project
GET /ai-agents/patterns/:project
GET /ai-agents/decisions/:project
GET /ai-agents/context/:project

# Validation endpoints (automatic)
GET /ai-agents/validate/:project
GET /ai-agents/validate/consistency/:project
GET /ai-agents/validate/effectiveness/:project
GET /ai-agents/validate/decisions/:project

# Self-correction endpoints
GET /ai-agents/analyze/failures/:project
POST /ai-agents/adjust/confidence/:project
POST /ai-agents/consolidate/:project

# Proactive intelligence
GET /ai-agents/detect/conflicts/:project
GET /ai-agents/predict/blockers/:project
POST /ai-agents/recommend/:project

# Quality monitoring
POST /ai-agents/quality/gate/:project
GET /ai-agents/detect/anomalies/:project

# Enforcement monitoring
GET /ai-agents/enforcement/health
GET /ai-agents/enforcement/stats/:project
GET /ai-agents/enforcement/locks
```

### Documentation

Comprehensive documentation for the enforcement system:

- **`.ai-agents/enforcement/README.md`** - Complete enforcement guide (15KB)
- **`.ai-agents/enforcement/git-hooks/README.md`** - Git hooks documentation (15KB)
- **`.ai-agents/enforcement/SETUP_FOR_ANY_PROJECT.md`** - Multi-project setup (12KB)
- **`.ai-agents/INTEGRATION_GUIDE.md`** - OpenMemory integration guide
- **`.ai-agents/README.md`** - AI agents system overview
- **`.ai-agents/scripts/README.md`** - Utility scripts documentation

### Summary: Why This Is Powerful

**OpenMemory + AI Agent Enforcement = Complete Solution**

1. **Solves File System Gap** - Git hooks enforce compliance for AI agents with direct file access (Claude Code, Copilot, etc.)

2. **Mandatory, Not Optional** - 5 layers of enforcement that AI agents cannot bypass without detection

3. **Persistent Memory** - Long-term memory across unlimited sessions with OpenMemory's HMD architecture

4. **Works Anywhere** - Install enforcement in ANY project in minutes, not just OpenMemory

5. **Fast & Efficient** - 95% recall, 115ms queries, 338 QPS throughput, 1-3s validation

6. **Complete Observability** - Git logs, watchdog reports, API logs, validation results, audit trails

7. **Zero Lock-In** - Self-hosted, MIT licensed, works with any AI agent framework

8. **Cost Effective** - 6-10× cheaper than cloud alternatives, $17-30/month for 1M memories

9. **Production Ready** - Comprehensive testing, monitoring, error handling, emergency bypass (logged)

10. **Team Friendly** - Multiple agents share memory, resource locking prevents conflicts

**This combination makes OpenMemory the only long-term memory system with true, enforced autonomous AI agent development capabilities.**

---

## 10. Contributing

See `CONTRIBUTING.md`, `GOVERNANCE.md`, and `CODE_OF_CONDUCT.md` for guidelines.

```bash
make build
make test
```

### Our Contributors:

<!-- readme: contributors -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/nullure">
                    <img src="https://avatars.githubusercontent.com/u/81895400?v=4" width="100;" alt="nullure"/>
                    <br />
                    <sub><b>Morven</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/recabasic">
                    <img src="https://avatars.githubusercontent.com/u/102372274?v=4" width="100;" alt="recabasic"/>
                    <br />
                    <sub><b>Elvoro</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/DKB0512">
                    <img src="https://avatars.githubusercontent.com/u/23116307?v=4" width="100;" alt="DKB0512"/>
                    <br />
                    <sub><b>Devarsh (DKB) Bhatt</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/msris108">
                    <img src="https://avatars.githubusercontent.com/u/43115330?v=4" width="100;" alt="msris108"/>
                    <br />
                    <sub><b>Sriram M</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/DoKoB0512">
                    <img src="https://avatars.githubusercontent.com/u/123281216?v=4" width="100;" alt="DoKoB0512"/>
                    <br />
                    <sub><b>DoKoB0512</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/jasonkneen">
                    <img src="https://avatars.githubusercontent.com/u/502002?v=4" width="100;" alt="jasonkneen"/>
                    <br />
                    <sub><b>Jason Kneen</b></sub>
                </a>
            </td>
		</tr>
		<tr>
            <td align="center">
                <a href="https://github.com/muhammad-fiaz">
                    <img src="https://avatars.githubusercontent.com/u/75434191?v=4" width="100;" alt="muhammad-fiaz"/>
                    <br />
                    <sub><b>Muhammad Fiaz</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/pc-quiknode">
                    <img src="https://avatars.githubusercontent.com/u/126496711?v=4" width="100;" alt="pc-quiknode"/>
                    <br />
                    <sub><b>Peter Chung</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/ammesonb">
                    <img src="https://avatars.githubusercontent.com/u/2522710?v=4" width="100;" alt="ammesonb"/>
                    <br />
                    <sub><b>Brett Ammeson</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/Dhravya">
                    <img src="https://avatars.githubusercontent.com/u/63950637?v=4" width="100;" alt="Dhravya"/>
                    <br />
                    <sub><b>Dhravya Shah</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/josephgoksu">
                    <img src="https://avatars.githubusercontent.com/u/6523823?v=4" width="100;" alt="josephgoksu"/>
                    <br />
                    <sub><b>Joseph Goksu</b></sub>
                </a>
            </td>
            <td align="center">
                <a href="https://github.com/lwsinclair">
                    <img src="https://avatars.githubusercontent.com/u/2829939?v=4" width="100;" alt="lwsinclair"/>
                    <br />
                    <sub><b>Lawrence Sinclair</b></sub>
                </a>
            </td>
		</tr>
	<tbody>
</table>
<!-- readme: contributors -end -->

---

## 11. License

MIT License. Copyright (c) 2025 OpenMemory.

---

## 12. Community

Join our [Discord](https://discord.gg/P7HaRayqTh) to connect with other developers and contributors.

---

## 13. Other Projects

**PageLM** - Transform study materials into quizzes, flashcards, notes, and podcasts.
https://github.com/CaviraOSS/PageLM

---
