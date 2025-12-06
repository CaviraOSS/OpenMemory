<meta name="description" content="OpenMemory gives AI agents real long-term memory. Not vector search. Not RAG. Actual memory.">
<meta name="keywords" content="ai memory, long-term memory, llm, agents, python memory, javascript memory, standalone ai memory, mcp memory, semantic memory, temporal memory, openmemory, openmemory-js, openmemory-py, python, javascript">

<img width="1577" height="781" alt="image" src="https://github.com/user-attachments/assets/3baada32-1111-4c2c-bf13-558f2034e511" />

# OpenMemory

[VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode) • [Report Bug](https://github.com/caviraOSS/openmemory/issues) • [Request Feature](https://github.com/caviraOSS/openmemor/issues) • [Discord server](https://discord.gg/P7HaRayqTh)

Long‑term memory for AI systems. **Self‑hosted. Local‑first. Explainable. Scalable.**
A full cognitive memory engine — not a vector database. Add Memory to AI/Agents in one line.

![demo](./.github/openmemory.gif)

## **🔥 Spread the Word!**

<p align="center"><a href="https://twitter.com/intent/tweet?text=OpenMemory%20%E2%80%93%20open-source%20long-term%20memory%20for%20AI%20agents%20and%20MCP.%20Not%20vector%20search.%20Not%20RAG.%20Actual%20memory.&url=https%3A%2F%2Fgithub.com%2FCaviraOSS%2FOpenMemory&hashtags=ai,agents,opensource,mcp,llm"><img src="https://img.shields.io/badge/Share%20on%20X-000000?style=for-the-badge&logo=x&logoColor=white"></a>&nbsp;<a href="https://www.linkedin.com/shareArticle?mini=true&url=https%3A%2F%2Fgithub.com%2FCaviraOSS%2FOpenMemory&title=OpenMemory%20%E2%80%93%20long-term%20memory%20for%20AI%20agents%20and%20MCP&summary=OpenMemory%20is%20a%20self-hosted%20multi-sector%20memory%20system%20with%20temporal%20reasoning%20and%20MCP%20integration."><img src="https://img.shields.io/badge/Share%20on%20LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white"></a>&nbsp;<a href="https://reddit.com/submit?url=https%3A%2F%2Fgithub.com%2FCaviraOSS%2FOpenMemory&title=OpenMemory%20%E2%80%94%20Self-hosted%20long-term%20memory%20for%20AI%20agents"><img src="https://img.shields.io/badge/Share%20on%20Reddit-FF4500?style=for-the-badge&logo=reddit&logoColor=white"></a>&nbsp;<a href="https://news.ycombinator.com/submitlink?u=https%3A%2F%2Fgithub.com%2FCaviraOSS%2FOpenMemory&t=Show%20HN%3A%20OpenMemory%20%E2%80%93%20Long-term%20memory%20for%20AI%20agents%20%28MCP%20%2F%20VSCode%20%2F%20Temporal%20KG%29"><img src="https://img.shields.io/badge/Hacker%20News-FF6600?style=for-the-badge&logo=y-combinator&logoColor=white"></a>&nbsp;<a href="https://dev.to/new/share?url=https%3A%2F%2Fgithub.com%2FCaviraOSS%2FOpenMemory&title=OpenMemory%20%E2%80%93%20long-term%20memory%20for%20AI%20agents&prefill=OpenMemory%20gives%20AI%20agents%20real%20long-term%20memory%20with%20multi-sector%20recall%2C%20temporal%20reasoning%2C%20graph%20links%2C%20decay%2C%20and%20MCP.%20Try%20it%3A%20https%3A%2F%2Fgithub.com%2FCaviraOSS%2FOpenMemory"><img src="https://img.shields.io/badge/Share%20on%20DEV.to-000000?style=for-the-badge&logo=dev.to&logoColor=white"></a></p>

## Why OpenMemory?

**Traditional Vector DBs** require extensive setup, cloud dependencies, and vendor lock-in:
```python
# The old way: Pinecone + LangChain (12+ lines)
import os
import time
from langchain.chains import ConversationChain
from langchain.memory import VectorStoreRetrieverMemory
from langchain_community.vectorstores import Pinecone
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

os.environ["PINECONE_API_KEY"] = "sk-..."
os.environ["OPENAI_API_KEY"] = "sk-..."
time.sleep(3)  # Wait for cloud initialization

embeddings = OpenAIEmbeddings()
pinecone = Pinecone.from_existing_index(embeddings, index_name="my-memory")
retriever = pinecone.as_retriever(search_kwargs=dict(k=2))
memory = VectorStoreRetrieverMemory(retriever=retriever)
conversation = ConversationChain(llm=ChatOpenAI(), memory=memory)

# Usage (requires explicit chain call)
conversation.predict(input="I'm allergic to peanuts")
```

**OpenMemory** needs just 3 lines:
```python
# The new way: OpenMemory (3 lines)
from openmemory import OpenMemory

om = OpenMemory(mode="local", path="./memory.db", tier="deep", embeddings={"provider": "ollama"})
om.add("User allergic to peanuts", userId="user123")
results = om.query("allergies", filters={"user_id": "user123"})
# Returns: [{"content": "User allergic to peanuts", "score": 0.89, ...}]
```
✅ Zero cloud setup • ✅ Local SQLite • ✅ Works offline • ✅ No vendor lock-in

---
---

# ⚡ Standalone Mode (New!)

**OpenMemory now works without a backend server.**
Run the full cognitive engine directly inside your Node.js or Python application.

*   **Zero Config**: `npm install` and go.
*   **Local Storage**: Data lives in a local SQLite file.
*   **Privacy**: No data leaves your machine.

[**👉 Read the Standalone Guide**](https://openmemory.cavira.app/docs/sdks/python)

# 1. Introduction

Modern LLMs forget everything between messages. Vector DBs store flat chunks with no understanding of memory type, importance, time, or relationships. Cloud memory APIs add cost and vendor lock‑in.

**OpenMemory solves this.**
It gives AI systems:

* persistent memory
* multi‑sector cognitive structure
* natural decay
* graph‑based recall
* time‑aware fact tracking
* explainability through waypoint traces
* complete data ownership
* MCP integration
* and much more

OpenMemory acts as the **Memory OS** for your AI agents, copilots, and applications. **On top of this, you can easily migrate from Mem0, Zep, Supermemory to OpenMemory in just one command.**

---

# Competitor Comparison

| **Feature / Metric**                     | **OpenMemory (Our Tests – Nov 2025)**                       | **Zep (Their Benchmarks)**         | **Supermemory (Their Docs)**    | **Mem0 (Their Tests)**        | **OpenAI Memory**          | **LangChain Memory**        | **Vector DBs (Chroma / Weaviate / Pinecone)** |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------------------------- | ------------------------------- | ----------------------------- | -------------------------- | --------------------------- | --------------------------------------------- |
| **Open-source License**                  | ✅ Apache 2.0                                               | ✅ Apache 2.0                      | ✅ Source available (GPL-like)  | ✅ Apache 2.0                 | ❌ Closed                  | ✅ Apache 2.0               | ✅ Varies (OSS + Cloud)                       |
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
| **Cost / 1M tokens (hosted embeddings)** | ~$0.35 (synthetic + Gemini hybrid ✓)                        | ~$2.2                              | ~$2.5+                          | ~$1.2                         | ~$3.0                      | User-managed                | User-managed                                  |
| **Local Embeddings Support**             | ✅ (Ollama / E5 / BGE / synthetic fallback ✓)               | ⚠️ Partial                         | ✅ Self-hosted tier ✓           | ✅ Supported ✓                | ❌ None                    | ⚠️ Optional                 | ✅ Chroma / Weaviate ✓                        |
| **Ingestion Formats**                    | ✅ PDF / DOCX / TXT / MD / HTML / Audio / Video ✓                         | ✅ API ✓                           | ✅ API ✓                        | ✅ SDK ✓                      | ❌ None                    | ⚠️ Manual ✓                 | ⚠️ SDK specific ✓                             |
| **Scalability Model**                    | Sector-sharded (semantic / episodic / etc.) ✓               | PG + FAISS cloud ✓                 | PG shards (cloud) ✓             | Single node                   | Vendor scale               | In-process                  | Horizontal ✓                                  |
| **Deployment**                           | Local / Docker / Cloud ✓                                    | Local + Cloud ✓                    | Docker / Cloud ✓                | Node / Python ✓               | Cloud only ❌              | Python / JS SDK ✓           | Docker / Cloud ✓                              |
| **Data Ownership**                       | 100 % yours ✓                                               | Vendor / self-host split ✓         | Partial ✓                       | 100 % yours ✓                 | Vendor ❌                  | Yours ✓                     | Yours ✓                                       |
| **Use-case Fit**                         | Long-term AI agents, copilots, journaling ✓                 | Enterprise RAG assistants ✓        | Cognitive agents / journaling ✓ | Basic agent memory ✓          | ChatGPT personalization ❌ | Context memory ✓            | Generic vector store ✓                        |

# Migration

OpenMemory includes a robust migration tool to import billions of memories from other systems.

### Supported Providers

* **Mem0** — user-based export
* **Zep** — sessions/messages API
* **Supermemory** — document export

### Example

```
cd migrate
node index.js --from zep --api-key ZEP_KEY --verify
```

---

# Installation & Setup (Three Ways)

OpenMemory supports **all three usage modes**:

* **Node.js SDK (local-first)**
* **Python SDK (local-first)**
* **Backend Server (web + API)**

---

## JavaScript SDK (Local-First)

Install:

```
npm install openmemory-js
```

Use:

```
import { OpenMemory } from "openmemory-js"
const mem = new OpenMemory()
```

* Runs fully locally
* Zero configuration
* Fastest integration path

---

## Python SDK (Local-First)

Install:

```
pip install openmemory-py
```

Use:

```
from openmemory import Memory
mem = Memory()
```

* Same cognitive engine as JS
* Ideal for LangGraph, notebooks, research

---

## Backend Server (Web + API)

Use this mode for:

* Multi-user apps
* Dashboards
* Cloud agents
* Centralized org-wide memory

Setup:

```
git clone https://github.com/caviraoss/openmemory.git
cp .env.example .env
cd backend
npm install
npm run dev
```

Or:

```
docker compose up --build -d
```

Backend runs on port 8080.

---

## Local via SDK

```
npm install openmemory-js
```

```
import { OpenMemory } from "openmemory-js"
const mem = new OpenMemory()
```

## Docker

```
docker compose up --build -d
```

## Source Setup

```
git clone https://github.com/caviraoss/openmemory.git
cp .env.example .env
cd backend
npm install
npm run dev
```

---

# Dashboard

![demo](./.github/dashboard.png)

* Browse memories per sector
* See decay curves
* Explore graph links
* Visualize timelines
* Chat with memory

```
cd dashboard
npm install
npm run dev
```

---

# VS Code Extension

The official **OpenMemory VS Code extension** gives AI assistants access to your coding history, project evolution, and file context.

**Marketplace Link:** [https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode)

### What it does

* Tracks file edits, opens, saves, and navigation
* Compresses context intelligently (30–70% token savings)
* Supplies high‑signal memory summaries to any MCP-compatible AI
* Works without configuration — install and it runs
* Extremely low latency (~80ms average)

---

# MCP Integration

OpenMemory ships with a **native MCP (Model Context Protocol) server**, making it instantly usable with Claude Desktop, Claude Code, Cursor, Windsurf, and any other MCP client.

### What MCP Enables

* Use OpenMemory as a tool inside your AI IDE
* Query memories directly from the AI
* Store new memories as you work
* Reinforce or inspect nodes without leaving the editor
* Provide full cognitive continuity to assistants

### Tools Provided

* `openmemory_query`
* `openmemory_store`
* `openmemory_list`
* `openmemory_get`
* `openmemory_reinforce`

These tools expose the cognitive engine’s recall, storage, listing, salience boosting, and sectorization.

### Example Setup

**Claude Desktop / Claude Code:**

```
claude mcp add --transport http openmemory http://localhost:8080/mcp
```

**Cursor / Windsurf:**
Add to `.mcp.json`:

```
{
  "mcpServers": {
    "openmemory": {
      "type": "http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

---

# Temporal Knowledge Graph

Most memory systems ignore time completely. OpenMemory treats **time as a first-class dimension**, letting your agent reason about changing facts.

### Core Concepts

* **valid_from / valid_to** — define truth ranges
* **auto-evolution** — new facts close old ones
* **confidence decay** — older facts lose weight
* **point‑in‑time queries** — ask "what was true on X date?"
* **timeline view** — reconstruct an entity’s full history
* **comparison mode** — detect changes between two dates

### Why it matters

Agents using static vector memory confuse old and new facts. Temporal memory allows accurate long-term reasoning, journaling, agent planning, and research workflows.

### Example: Fact lifecycle

```
POST /api/temporal/fact
{
  "subject": "CompanyX",
  "predicate": "has_CEO",
  "object": "Alice",
  "valid_from": "2021-01-01"
}
```

Later:

```
POST /api/temporal/fact
{
  "subject": "CompanyX",
  "predicate": "has_CEO",
  "object": "Bob",
  "valid_from": "2024-04-10"
}
```

OpenMemory automatically updates timeline and closes Alice’s term.

### Advanced Operations

* Search for periods with rapid fact changes
* Build agent memories tied to specific events
* Create time-based embeddings for episodic recall

---

# CLI Tool

The `opm` CLI gives direct shell access to the cognitive engine.

### Installation

```
cd backend
npm link
```

### Commands

* **Add memory**

```
opm add "user prefers dark mode" --user u1 --tags prefs
```

* **Query memory**

```
opm query "preferences" --user u1 --limit 5
```

* **List user memories**

```
opm list --user u1
```

* **Reinforce memory**

```
opm reinforce <id>
```

* **Inspect system stats**

```
opm stats
```

### Why it matters

Great for scripting, automation, server monitoring, and integrating OpenMemory into non-LLM pipelines.

---

# Architecture Overview

OpenMemory uses **Hierarchical Memory Decomposition**.

### Data Flow

1. Input is sectorized
2. Embeddings generated per sector
3. Per‑sector vector search
4. Waypoint graph expansion
5. Composite ranking: similarity + salience + recency + weight
6. Temporal graph adjusts context relevance
7. Output includes **explainable recall trace**

### Diagram

```mermaid
graph TB
    %% Styling
    classDef inputStyle fill:#eceff1,stroke:#546e7a,stroke-width:2px,color:#37474f
    classDef processStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px,color:#0d47a1
    classDef sectorStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px,color:#e65100
    classDef storageStyle fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#880e4f
    classDef engineStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#4a148c
    classDef outputStyle fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#1b5e20
    classDef graphStyle fill:#e1f5fe,stroke:#0277bd,stroke-width:2px,color:#01579b
    
    %% Input Layer
    INPUT[Input / Query]:::inputStyle
    
    %% Classification Layer
    CLASSIFIER[Sector Classifier<br/>Multi-sector Analysis]:::processStyle
    
    %% Memory Sectors
    EPISODIC[Episodic Memory<br/>Events & Experiences<br/>Time-bound]:::sectorStyle
    SEMANTIC[Semantic Memory<br/>Facts & Knowledge<br/>Timeless]:::sectorStyle
    PROCEDURAL[Procedural Memory<br/>Skills & How-to<br/>Action Patterns]:::sectorStyle
    EMOTIONAL[Emotional Memory<br/>Feelings & Sentiment<br/>Affective States]:::sectorStyle
    REFLECTIVE[Reflective Memory<br/>Meta-cognition<br/>Insights]:::sectorStyle
    
    %% Embedding Layer
    EMBED[Embedding Engine<br/>OpenAI/Gemini/Ollama/AWS<br/>Per-sector Vectors]:::processStyle
    
    %% Storage Layer
    SQLITE[(SQLite/Postgres<br/>Memories Table<br/>Vectors Table<br/>Waypoints Table)]:::storageStyle
    TEMPORAL[(Temporal Graph<br/>Facts & Edges<br/>Time-bound Truth)]:::storageStyle
    
    %% Recall Engine
    subgraph RECALL_ENGINE[" "]
        VECTOR[Vector Search<br/>Per-sector ANN]:::engineStyle
        WAYPOINT[Waypoint Graph<br/>Associative Links]:::engineStyle
        SCORING[Composite Scoring<br/>Similarity + Salience<br/>+ Recency + Weight]:::engineStyle
        DECAY[Decay Engine<br/>Adaptive Forgetting<br/>Sector-specific λ]:::engineStyle
    end
    
    %% Temporal Knowledge Graph
    subgraph TKG[" "]
        FACTS[Fact Store<br/>Subject-Predicate-Object<br/>valid_from/valid_to]:::graphStyle
        TIMELINE[Timeline Engine<br/>Point-in-time Queries<br/>Evolution Tracking]:::graphStyle
    end
    
    %% Cognitive Operations
    CONSOLIDATE[Memory Consolidation<br/>Merge Duplicates<br/>Pattern Detection]:::processStyle
    REFLECT[Reflection Engine<br/>Auto-summarization<br/>Meta-learning]:::processStyle
    
    %% Output Layer
    OUTPUT[Final Recall<br/>+ Explainable Trace<br/>+ Waypoint Path<br/>+ Confidence Score]:::outputStyle
    
    %% Flow Connections
    INPUT --> CLASSIFIER
    
    CLASSIFIER --> EPISODIC
    CLASSIFIER --> SEMANTIC
    CLASSIFIER --> PROCEDURAL
    CLASSIFIER --> EMOTIONAL
    CLASSIFIER --> REFLECTIVE
    
    EPISODIC --> EMBED
    SEMANTIC --> EMBED
    PROCEDURAL --> EMBED
    EMOTIONAL --> EMBED
    REFLECTIVE --> EMBED
    
    EMBED --> SQLITE
    EMBED --> TEMPORAL
    
    SQLITE --> VECTOR
    SQLITE --> WAYPOINT
    SQLITE --> DECAY
    
    TEMPORAL --> FACTS
    FACTS --> TIMELINE
    
    VECTOR --> SCORING
    WAYPOINT --> SCORING
    DECAY --> SCORING
    TIMELINE --> SCORING
    
    SCORING --> CONSOLIDATE
    CONSOLIDATE --> REFLECT
    REFLECT --> OUTPUT
    
    %% Feedback loops
    OUTPUT -.->|Reinforcement| WAYPOINT
    OUTPUT -.->|Salience Boost| DECAY
    CONSOLIDATE -.->|Pattern Update| WAYPOINT
```


---

# Performance Benchmarks

* 115ms avg recall @100k
* 338 QPS throughput
* 7.9ms/item scoring
* Stable decay convergence
* 95% accuracy@5

Expanded tables preserved.

---

# Security

* AES‑GCM encryption
* API keys
* user isolation
* no telemetry unless allowed

---

# Roadmap

* learned sector classifier
* federated memory clusters
* agent‑driven reflection engine
* memory‑visualizer 2.0

---

# Contributors

<<<<<<< HEAD
<!-- readme: collaborators,contributors -start -->
<!-- readme: collaborators,contributors -end -->
=======
Discord

---

# 16. License

Apache 2.0
>>>>>>> 35e13e0534700202ef8d983e366a20227d80a0a6
