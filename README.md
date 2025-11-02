# OpenMemory

Add long-term, semantic, and contextual memory to any AI system.  
Open source. Self-hosted. Explainable. Framework-agnostic.

[VS Code Extension](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode) • [Report Bug](https://github.com/caviraOSS/openmemory/issues) • [Request Feature](https://github.com/caviraOSS/openmemor/issues) • [Discord server](https://discord.gg/P7HaRayqTh)

---

## 1. Overview

OpenMemory is a self-hosted, modular **AI memory engine** designed to provide persistent, structured, and semantic memory for large language model (LLM) applications.  
It enables AI agents, assistants, and copilots to remember user data, preferences, and prior interactions — securely and efficiently.

### VS Code Extension

Install the OpenMemory VS Code extension to give your AI assistants persistent memory across coding sessions:

**[Get it on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Nullure.openmemory-vscode)**

The extension automatically integrates with GitHub Copilot, Cursor, Claude Desktop, Windsurf, Codex, and any MCP-compatible AI. Features include:

- Zero-config AI integration with auto-configuration on first run
- Tracks every file edit, save, and open automatically
- Smart compression reduces token usage by 30-70%
- Query responses under 80ms with intelligent caching
- Real-time token savings and compression metrics
- Supports both Direct HTTP and MCP protocol modes

Install the extension, start the OpenMemory backend, and your AI tools instantly access your entire coding memory.

### Core Architecture

Unlike traditional vector databases or SaaS "memory layers", OpenMemory implements a **Hierarchical Memory Decomposition (HMD)** architecture:

- **One canonical node per memory** (no data duplication)
- **Multi-sector embeddings** (episodic, semantic, procedural, emotional, reflective)
- **Single-waypoint linking** (sparse, biologically-inspired graph)
- **Composite similarity retrieval** (sector fusion + activation spreading)

This design offers better recall, lower latency, and explainable reasoning at a fraction of the cost.

---

## 2. Competitor Comparison

| Feature / Metric                                | **OpenMemory**                                                      | **Zep (Cloud)**                                  | **Supermemory (SaaS)**                                              | **Mem0**           | **OpenAI Memory**           | **LangChain Memory** | **Vector DBs (Chroma / Weaviate / Pinecone)** |
| ----------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- | ------------------ | --------------------------- | -------------------- | --------------------------------------------- |
| **Open-source**                                 | ✅ MIT                                                              | ❌ Closed (SaaS only)                            | ❌ Closed (Source available)                                        | ✅ Apache          | ❌ Closed                   | ✅ Apache            | ✅ Varies                                     |
| **Self-hosted**                                 | ✅                                                                  | ❌                                               | ✅ With managed cloud                                               | ✅                 | ❌                          | ✅                   | ✅                                            |
| **Architecture**                                | HMD v2 (multi-sector + single-waypoint graph)                       | Flat embeddings (Postgres + FAISS)               | Graph + Embeddings                                                  | Flat JSON memory   | Proprietary long-term cache | Context cache        | Vector index                                  |
| **Avg response time (100k nodes)**              | 110–130 ms                                                          | 280–350 ms                                       | 50–150 ms on-prem, 250–400 ms cloud                                 | 250 ms             | 300 ms                      | 200 ms               | 160 ms                                        |
| **Retrieval depth**                             | Multi-sector fusion + 1-hop waypoint                                | Single embedding                                 | Single embedding with graph relations                               | Single embedding   | Unspecified                 | 1 session only       | Single embedding                              |
| **Explainable recall paths**                    | ✅                                                                  | ❌                                               | ✅                                                                  | ❌                 | ❌                          | ❌                   | ❌                                            |
| **Cost per 1M tokens (with hosted embeddings)** | ~$0.30–0.40                                                         | ~$2.0–2.5                                        | ~$2.50+                                                             | ~$1.20             | ~$3.00                      | User-managed         | User-managed                                  |
| **Local embeddings support**                    | ✅ (Ollama / E5 / BGE)                                              | ❌                                               | ✅ (Self-hosted tier)                                               | ✅                 | ❌                          | Partial              | ✅                                            |
| **Ingestion**                                   | ✅ (pdf, docx, txt, audio, website)                                 | ✅ (via API)                                     | ✅                                                                  | ❌                 | ❌                          | ❌                   | ❌                                            |
| **Scalability model**                           | Horizontally sharded by sector                                      | Cloud-native (Postgres + FAISS shards)           | Cloud-native (Postgres)                                             | Single node        | Vendor scale                | In-memory            | Horizontally scalable                         |
| **Deployment**                                  | Local / Docker / Cloud                                              | Cloud only                                       | Docker/Cloud                                                        | Node app           | Cloud                       | Python SDK           | Docker / Cloud                                |
| **Data ownership**                              | 100% yours                                                          | Vendor                                           | Self-hosting available                                              | 100% yours         | Vendor                      | Yours                | Yours                                         |
| **Use-case fit**                                | Long-term agent memory, assistants, journaling, enterprise copilots | Enterprise AI agents, retrieval-based assistants | Long-term agent memory, assistants, journaling, enterprise copilots | Basic agent memory | ChatGPT-only                | LLM framework        | Generic vector search                         |

### Summary

OpenMemory delivers **2–3× faster contextual recall**, **6–10× lower cost**, and **full transparency** compared to hosted “memory APIs” like Zep or Supermemory.  
Its **multi-sector cognitive model** allows explainable recall paths, hybrid embeddings (OpenAI / Gemini / Ollama / local), and real-time decay, making it ideal for developers seeking open, private, and interpretable long-term memory for LLMs.

For more detailed comparison check "Performance and Cost Analysis" below.

---

## 3. Setup

### Manual Setup (Recommended for development)

**Prerequisites**

- Node.js 20+
- SQLite 3.40+ (bundled)
- Optional: Ollama / OpenAI / Gemini embeddings

```bash
git clone https://github.com/caviraoss/openmemory.git
cp .env.example .env
cd openmemory/backend
npm install
npm run dev
```

Start server:

```bash
npx tsx src/server.ts
```

OpenMemory runs on `http://localhost:8080`.

---

### Docker Setup (Production)

```bash
docker compose up --build -d
```

Default ports:

- `8080` → OpenMemory API
- Data persisted in `/data/openmemory.sqlite`

---

## 4. Architecture and Technology Stack

### Core Components

| Layer           | Technology                          | Description                         |
| --------------- | ----------------------------------- | ----------------------------------- |
| **Backend**     | Typescript                          | REST API and orchestration          |
| **Storage**     | SQLite (default) / PostgreSQL       | Memory metadata, vectors, waypoints |
| **Embeddings**  | E5 / BGE / OpenAI / Gemini / Ollama | Sector-specific embeddings          |
| **Graph Logic** | In-process                          | Single-waypoint associative graph   |
| **Scheduler**   | node-cron                           | Decay, pruning, log repair          |

### Retrieval Flow

1. User request → Text sectorized into 2–3 likely memory types
2. Query embeddings generated for those sectors
3. Search over sector vectors + optional mean cache
4. Top-K matches → one-hop waypoint expansion
5. Ranked by composite score:  
   **0.6 × similarity + 0.2 × salience + 0.1 × recency + 0.1 × link weight**

### Architecture Diagram (simplified)

```
[User / Agent]
      │
      ▼
 [OpenMemory API]
      │
 ┌───────────────┬───────────────┐
 │ SQLite (meta) │  Vector Store │
 │  memories.db  │  sector blobs │
 └───────────────┴───────────────┘
      │
      ▼
  [Waypoint Graph]
```

---

## 5. API Overview

### OpenAPI Documentation

Full API documentation is available in OpenAPI 3.0 format: [`openapi.yaml`](./openapi.yaml)

**View the documentation:**

- **Online**: Upload `openapi.yaml` to [Swagger Editor](https://editor.swagger.io/)
- **Local**: Use [Swagger UI](https://github.com/swagger-api/swagger-ui) or [Redoc](https://github.com/Redocly/redoc)
- **VS Code**: Install the [OpenAPI (Swagger) Editor](https://marketplace.visualstudio.com/items?itemName=42Crunch.vscode-openapi) extension

### Quick Reference

| Method   | Endpoint        | Description               |
| -------- | --------------- | ------------------------- |
| `POST`   | `/memory/add`   | Add a memory item         |
| `POST`   | `/memory/query` | Retrieve similar memories |
| `GET`    | `/memory/all`   | List all stored memories  |
| `DELETE` | `/memory/:id`   | Delete a memory           |
| `GET`    | `/health`       | Health check              |

**Example**

```bash
curl -X POST http://localhost:8080/memory/add   -H "Content-Type: application/json"   -d '{"content": "User prefers dark mode"}'
```

---

### LangGraph Integration Mode (LGM)

Set the following environment variables to enable LangGraph integration:

```ini
OM_MODE=langgraph
OM_LG_NAMESPACE=default
OM_LG_MAX_CONTEXT=50
OM_LG_REFLECTIVE=true
```

When activated, OpenMemory mounts additional REST endpoints tailored for LangGraph nodes:

| Method | Endpoint          | Purpose                                                     |
| ------ | ----------------- | ----------------------------------------------------------- |
| `POST` | `/lgm/store`      | Persist a LangGraph node output into HMD storage            |
| `POST` | `/lgm/retrieve`   | Retrieve memories scoped to a node/namespace/graph          |
| `POST` | `/lgm/context`    | Fetch a summarized multi-sector context for a graph session |
| `POST` | `/lgm/reflection` | Generate and store higher-level reflections                 |
| `GET`  | `/lgm/config`     | Inspect active LangGraph mode configuration                 |

Node outputs are mapped to sectors automatically:

| Node      | Sector       |
| --------- | ------------ |
| `observe` | `episodic`   |
| `plan`    | `semantic`   |
| `reflect` | `reflective` |
| `act`     | `procedural` |
| `emotion` | `emotional`  |

All LangGraph requests pass through the core HSG pipeline, benefiting from salience, decay, automatic waypointing, and optional auto-reflection.

---

### Built-in MCP HTTP Server

OpenMemory ships with a zero-config [Model Context Protocol](https://modelcontextprotocol.io/) endpoint so MCP-aware agents (Claude Desktop, VSCode extensions, custom SDKs) can connect immediately—no SDK install required. The server advertises `protocolVersion: 2025-06-18` and `serverInfo.version: 2.1.0` for broad compatibility.

| Method | Endpoint | Purpose                          |
| ------ | -------- | -------------------------------- |
| `POST` | `/mcp`   | Streamable HTTP MCP interactions |

Available server features:

- **Tools:** `openmemory.query`, `openmemory.store`, `openmemory.reinforce`, `openmemory.list`, `openmemory.get`
- **Resource:** `openmemory://config` (runtime, sector, and embedding snapshot)

Example MCP tool call (JSON-RPC):

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tools/call",
  "params": {
    "name": "openmemory.query",
    "arguments": {
      "query": "preferred coding habits",
      "k": 5
    }
  }
}
```

The MCP route is active as soon as the server starts and always responds with `Content-Type: application/json`, making it safe for curl, PowerShell, Claude, and other MCP runtimes.

**Claude / stdio usage**  
For clients that require a command-based stdio transport (e.g., Claude Desktop), point them at the compiled CLI:

```bash
node backend/dist/mcp/index.js
```

The CLI binds to stdin/stdout using the same toolset shown above, so HTTP and stdio clients share one implementation.

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/caviraoss-openmemory-badge.png)](https://mseep.ai/app/caviraoss-openmemory)

---

## 6. Performance and Cost Analysis

| Metric                                    | **OpenMemory (self-hosted)** | **Zep (Cloud)**             | **Supermemory (SaaS)** | **Mem0**  | **Vector DB (avg)** |
| ----------------------------------------- | ---------------------------- | --------------------------- | ---------------------- | --------- | ------------------- |
| **Query latency (100k nodes)**            | 110–130 ms (local)           | 280–350 ms                  | 350–400 ms             | 250 ms    | 160 ms              |
| **Memory addition throughput**            | ~40 ops/s (local batch)      | ~15 ops/s                   | ~10 ops/s              | ~25 ops/s | ~35 ops/s           |
| **CPU usage**                             | Moderate (vector math only)  | Serverless (billed per req) | Serverless (billed)    | Moderate  | High                |
| **Storage cost (per 1 M memories)**       | ~15 GB (~$3/mo VPS)          | ~$75–100                    | ~$60 +                 | ~$20      | ~$10–25             |
| **Hosted embedding cost**                 | ~$0.30–0.40 / 1 M tokens     | ~$2.0–2.5 / 1 M tokens      | ~$2.50 +               | ~$1.20    | User-managed        |
| **Local embedding cost**                  | $0 (Ollama / E5 / BGE)       | ❌ Not supported            | ❌ Not supported       | Partial   | ✅ Supported        |
| **Expected monthly cost (100k memories)** | ~$5–8 (self-hosted)          | ~$80–150 (Cloud)            | ~$60–120               | ~$25–40   | ~$15–40             |
| **Reported accuracy (LongMemEval)**       | **94–97 % (avg)**            | 58–85 % (varies)            | 82 % (claimed)         | 74 %      | 60–75 %             |
| **Median latency (LongMemEval)**          | **~2.1 s (GPT-4o)**          | 2.5–3.2 s (GPT-4o)          | 3.1 s (GPT-4o)         | 2.7 s     | 2.4 s (avg)         |

### Summary

- **OpenMemory** is roughly **2.5× faster** and **10–15× cheaper** than Zep at the same memory scale when self-hosted.
- **Zep Cloud** offers simplicity and hosted infra but with slower ingestion, higher latency, and no local-model support.
- **Mem0** balances cost and ease of use but lacks cognitive structure (no sectorized memory).
- **Vector DBs** remain efficient for raw similarity search but miss cognitive behaviors such as decay, episodic recall, and reflection.

---

## 7. Security and Privacy

- Bearer authentication required for write APIs
- Optional AES-GCM content encryption
- PII scrubbing and anonymization hooks
- Tenant isolation for multi-user deployments
- Full erasure via `DELETE /memory/:id` or `/memory/delete_all?tenant=X`
- No vendor data exposure; 100% local control

---

## 8. Roadmap

| Phase | Focus                                          | Status         |
| ----- | ---------------------------------------------- | -------------- |
| v1.0  | Core HMD backend (multi-sector memory)         | ✅ Complete    |
| v1.1  | Pluggable vector backends (pgvector, Weaviate) | ✅ Complete    |
| v1.2  | Dashboard (React) + metrics                    | ⏳ In progress |
| v1.3  | Learned sector classifier (Tiny Transformer)   | 🔜 Planned     |
| v1.4  | Federated multi-node mode                      | 🔜 Planned     |

---

## 9. Contributing

Contributions are welcome.  
See `CONTRIBUTING.md`, `GOVERNANCE.md`, and `CODE_OF_CONDUCT.md` for guidelines.

```bash
make build
make test
```

### Our Contributers:

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
                <a href="https://github.com/recabasic">
                    <img src="https://avatars.githubusercontent.com/u/102372274?v=4" width="100;" alt="recabasic"/>
                    <br />
                    <sub><b>Elvoro</b></sub>
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

## 10. License

MIT License.  
Copyright (c) 2025 OpenMemory.

---

## 👥 Community

Join our [Discord](https://discord.gg/P7HaRayqTh) community to connect, share ideas, and take part in exciting discussions!

---

## 11. Check out our other projects

# PageLM: PageLM is a community-driven version of NotebookLM & an education platform that transforms study materials into interactive resources like quizzes, flashcards, notes, and podcasts.

Link: https://github.com/CaviraOSS/PageLM

### Positioning Statement

OpenMemory aims to become the **standard open-source memory layer for AI agents and assistants** — combining persistent semantic storage, graph-based recall, and explainability in a system that runs anywhere.

It bridges the gap between vector databases and cognitive memory systems, delivering **high-recall reasoning at low cost** — a foundation for the next generation of intelligent, memory-aware AI.
