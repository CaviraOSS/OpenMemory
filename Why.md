# Why OpenMemory

OpenMemory exists because **AI memory today is fragmented, opaque, and inefficient.**  
Most tools either store plain embeddings without context (vector DBs) or lock memory behind closed APIs (Supermemory, OpenAI Memory).  
OpenMemory solves this by building a **structured, explainable, multi-sector cognitive memory engine** — open source, local-first, and framework-free.

---

## 1. Why Not Just Use a Vector Database?

Vector databases like **Chroma**, **Weaviate**, or **Pinecone** are excellent for generic semantic search, but they fall short when used as long-term memory systems for agents or assistants.

| Limitation               | Vector DBs               | OpenMemory                                                           |
| ------------------------ | ------------------------ | -------------------------------------------------------------------- |
| **Contextual structure** | Flat embeddings only     | Multi-sector (episodic, semantic, procedural, emotional, reflective) |
| **Biological alignment** | None                     | Inspired by human brain’s sectorial memory formation                 |
| **Graph relationships**  | Optional (manual edges)  | Automatic, single-waypoint graph                                     |
| **Temporal awareness**   | Manual timestamps        | Built-in recency & salience scoring                                  |
| **Explainable recall**   | ❌                       | ✅ Full trace path via waypoint graph                                |
| **Cost control**         | Scales with vector count | Light, SQLite-based — predictable cost                               |
| **Agent integration**    | Manual                   | Native `/memory/add` + `/memory/query` pipeline                      |
| **Privacy**              | Cloud or managed service | 100% local and auditable                                             |

> **In short:** Vector DBs store “what was said.”  
> **OpenMemory** remembers “what it meant, when, how it felt, and why it matters.”

---

## 2. Why Not Use Supermemory or OpenAI Memory?

| Factor                 | Supermemory (SaaS)   | OpenAI Memory   | OpenMemory                                    |
| ---------------------- | -------------------- | --------------- | --------------------------------------------- |
| **Ownership**          | Significantly closed | Closed SaaS     | Open-source Apache 2.0                        |
| **Hosting**            | Cloud only           | Cloud only      | Self-hosted or cloud                          |
| **Explainability**     | Black-box            | Black-box       | Transparent                                   |
| **Architecture**       | Flat embeddings      | Proprietary     | HMD v2 (multi-sector + single-waypoint graph) |
| **Response latency**   | ~350-400 ms          | ~300 ms         | 110-130 ms                                    |
| **Cost per 1M tokens** | ~$2.50+              | ~$3.00+         | ~$0.30-0.40                                   |
| **Local embeddings**   | ❌                   | ❌              | ✅ E5, BGE, Ollama                            |
| **Integration**        | Web API only         | GPT-native      | REST / JS / Python SDK                        |
| **Focus**              | Chatbot SaaS memory  | Assistant-level | Developer memory infrastructure               |

> **Summary:**
>
> - OpenMemory runs locally, for free, and integrates directly with your stack.
> - It’s 5–10× cheaper and 2–3× faster.
> - You can see how every memory is formed, stored, decayed, and recalled.

---

## 3. The Architectural Difference

### Vector DBs:

- Treat every entry as an independent embedding.
- Retrieval = cosine similarity search.
- No understanding of relationships, meaning, or salience.
- Result: duplicate data, poor recall, high storage cost.

### OpenMemory:

- Breaks information into **memory sectors** (like the brain).
- Stores one unified node per memory with **multi-sector embeddings**.
- Adds a **single, strongest waypoint** between related memories.
- Retrieval uses **composite similarity** and **activation spreading**.
- Result: denser understanding, faster lookup, lower redundancy.

---

## 4. Cost and Efficiency

- **Vector DBs**: Cost grows linearly with embeddings; storage and API calls dominate.
- **SaaS Memories**: Add markup for hosting, tokens, and proprietary APIs.
- **OpenMemory**: Uses SQLite + FAISS/Chroma locally.
  - 100k memories ≈ 1.5 GB
  - 1M memories ≈ 15 GB
  - Runs fine on a $5/month VPS.

| Feature                               | Vector DB  | SaaS Memory | OpenMemory  |
| ------------------------------------- | ---------- | ----------- | ----------- |
| Query time (100k)                     | 160-250 ms | 300-400 ms  | 110-130 ms  |
| Cost (1M tokens w/ hosted embeddings) | ~$1.20     | ~$3.00+     | ~$0.30-0.40 |
| Self-hosted                           | Partial    | No          | Yes         |
| Local embeddings                      | Optional   | No          | Yes         |

---

## 5. Cognitive Realism and Agent Readiness

OpenMemory introduces **sector-specific cognition**:

- **Episodic**: Event memories — when/what happened
- **Semantic**: Facts and preferences
- **Procedural**: Habits and workflows
- **Emotional**: Feelings and tone
- **Reflective**: Meta-memory and logs

This structure mirrors human cognition and allows for **contextual recall** in LLM agents.

Example:

> “User said they enjoy coding at night and feel productive.”  
> → Stored across semantic (“coding preference”), emotional (“feel productive”), and episodic (“time: night”) sectors.  
> → Recalled as one linked thought with a waypoint reference.

No vector DB can do this natively.

---

## 6. Developer Value Proposition

| Area               | Why OpenMemory Wins                                      |
| ------------------ | ---------------------------------------------------------|
| **Setup**          | Single binary or Docker; no external service required    |
| **Integrations**   | Works with any LLM (OpenAI, Gemini, AWS, Ollama, Claude) |
| **SDKs**           | TypeScript + Python included                             |
| **Cost**           | 10× cheaper than hosted alternatives                     |
| **Explainability** | Memory formation and recall fully transparent            |
| **Performance**    | p95 retrieval under 130ms on 100k+ nodes                 |
| **Scalability**    | Horizontally shardable by sector                         |
| **Extensibility**  | Add new embedding models with 1 config line              |
| **Privacy**        | Zero vendor lock-in; full data control                   |

---

## 7. Philosophy

> Memory is not a database.
>
> It’s a dynamic system that evolves, decays, and recalls — contextually and semantically.

OpenMemory treats every memory as a living object with:

- Time decay
- Reinforcement (based on recall frequency)
- Emotional intensity
- Reflective self-linking

This turns static storage into **a cognitive substrate for AI**.

---

## 8. Summary

| Metric             | OpenMemory         | Others |
| ------------------ | ------------------ | ------ |
| **Speed**          | 2–3× faster        |
| **Cost**           | 6–10× cheaper      |
| **Explainability** | 100% transparent   |
| **Integration**    | Any framework      |
| **Data ownership** | 100% yours         |
| **AI readiness**   | Agent-first design |

> **OpenMemory = Cognitive storage for AI agents.**
> Not just another vector DB — it’s the _brain behind your AI_.

---

## 9. Caveats & Accuracy

Note: the figures and comparisons above are approximate and may not be accurate for every environment or over time.
