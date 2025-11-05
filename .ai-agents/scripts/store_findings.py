#!/usr/bin/env python3
"""Store discovered patterns and architectural decisions in OpenMemory"""

import sys
sys.path.insert(0, '..')

from openmemory_client import OpenMemoryClient

client = OpenMemoryClient(
    base_url="http://localhost:8080",
    project_name="OpenMemory",
    user_id="ai-agent-system"
)

print("=== Storing Coding Patterns ===\n")

# Pattern 1: Multi-Sector Memory Classification
pattern1 = client.store_pattern(
    pattern_name="Multi-Sector Memory Classification",
    description="Content is classified into one primary sector and multiple additional sectors. Each sector (episodic, semantic, procedural, emotional, reflective) has specific regex patterns and decay rates. This allows the same memory to be searchable from multiple cognitive perspectives.",
    example="""
// From ai-agents.ts:
- Project state → semantic sector
- Agent actions → episodic sector
- Coding patterns → procedural sector
- Architectural decisions → reflective sector
    """,
    tags=["architecture", "memory-sectors", "classification"]
)
print(f"[OK] Pattern 1 stored: {pattern1.get('memory_id')}")

# Pattern 2: Single-Waypoint Graph Linking
pattern2 = client.store_pattern(
    pattern_name="Single-Waypoint Graph Linking",
    description="Each memory links to exactly ONE other memory - its strongest match (cosine similarity >= 0.75). This creates an efficient associative graph without duplication. Links are bidirectional if cross-sector and can be reinforced on recall.",
    example="""
Memory A ──0.85──> Memory B (strongest link only)
- On query: boost weight by 0.05 per traversal
- Max weight: 1.0
- Pruning: remove weights < 0.05 every 7 days
    """,
    tags=["architecture", "graph", "waypoints"]
)
print(f"[OK] Pattern 2 stored: {pattern2.get('memory_id')}")

# Pattern 3: Composite Scoring for Memory Retrieval
pattern3 = client.store_pattern(
    pattern_name="Composite Scoring for Memory Retrieval",
    description="Memory retrieval uses a weighted composite score combining multiple factors: 60% similarity, 20% salience (importance), 10% recency, and 10% waypoint strength. This balances relevance with importance and temporal factors.",
    example="""
score = 0.6×similarity + 0.2×salience + 0.1×recency + 0.1×waypoint

Query flow:
1. Classify query → candidate sectors
2. Embed for each sector
3. Search vectors by sector
4. Expand via waypoints (1-hop)
5. Score with composite formula
6. Sort and return top-K
7. Reinforce retrieved memories
    """,
    tags=["algorithm", "retrieval", "scoring"]
)
print(f"[OK] Pattern 3 stored: {pattern3.get('memory_id')}")

# Pattern 4: Sector-Specific Decay Rates
pattern4 = client.store_pattern(
    pattern_name="Sector-Specific Memory Decay",
    description="Different memory types decay at different rates, mimicking human cognition. Episodic memories (events) fade fastest, while reflective insights persist longest. Formula: salience_new = salience_initial × e^(-decay_lambda × days)",
    example="""
Decay rates by sector:
- episodic: 0.020 (fastest - daily events)
- emotional: 0.015 (feelings fade)
- procedural: 0.008 (how-to knowledge)
- semantic: 0.005 (facts persist)
- reflective: 0.001 (slowest - insights last)

Runs automatically every 24 hours
    """,
    tags=["memory-decay", "cognitive-model", "maintenance"]
)
print(f"[OK] Pattern 4 stored: {pattern4.get('memory_id')}")

# Pattern 5: AI Agent to Memory Sector Mapping
pattern5 = client.store_pattern(
    pattern_name="AI Agent Activity Mapping",
    description="AI agent activities are mapped to specific memory sectors for optimal organization and retrieval. State goes to semantic (facts), actions to episodic (events), patterns to procedural (how-to), and decisions to reflective (meta-cognition).",
    example="""
From backend/src/server/routes/ai-agents.ts:

POST /ai-agents/state → semantic sector
  (stores project state as facts)

POST /ai-agents/action → episodic sector
  (records agent actions as events)

POST /ai-agents/pattern → procedural sector
  (stores coding patterns as how-to knowledge)

POST /ai-agents/decision → reflective sector
  (records architectural decisions as insights)
    """,
    tags=["ai-agents", "integration", "sector-mapping"]
)
print(f"[OK] Pattern 5 stored: {pattern5.get('memory_id')}")

print("\n=== Storing Architectural Decisions ===\n")

# Decision 1: HMD Architecture
decision1 = client.record_decision(
    decision="Use Hierarchical Memory Decomposition (HMD) v2 architecture",
    rationale="HMD provides cognitive-inspired memory organization with multiple sector types, automatic decay, and graph associations. This mimics human memory better than flat vector stores, improving recall accuracy and providing explainable memory paths.",
    alternatives="Flat vector database (Pinecone/Weaviate), Simple key-value store with embeddings, Session-based memory (LangChain)",
    consequences="Improved recall accuracy (95% vs 68-88% for competitors), explainable retrieval paths, natural memory decay, but increased complexity in implementation and maintenance"
)
print(f"[OK] Decision 1 stored: {decision1.get('memory_id')}")

# Decision 2: TypeScript Backend
decision2 = client.record_decision(
    decision="Use TypeScript for backend implementation",
    rationale="TypeScript provides type safety, excellent tooling, and broad ecosystem support. The async/await model works well for I/O-bound memory operations and embedding API calls. Node.js deployment is simple and scalable.",
    alternatives="Python (better ML ecosystem), Go (better performance), Rust (maximum performance)",
    consequences="Good balance of developer productivity and performance. Strong type system prevents bugs. Large community and package ecosystem. Trade-off: not as fast as compiled languages for CPU-intensive tasks"
)
print(f"[OK] Decision 2 stored: {decision2.get('memory_id')}")

# Decision 3: SQLite Primary Storage
decision3 = client.record_decision(
    decision="Use SQLite as primary storage backend with PostgreSQL as optional alternative",
    rationale="SQLite provides zero-configuration deployment, excellent performance for read-heavy workloads, and simple backups. Perfect for self-hosted use cases. Scales to millions of memories with proper indexing.",
    alternatives="PostgreSQL only (better concurrency), MongoDB (flexible schema), Specialized vector DB (Pinecone/Weaviate)",
    consequences="Easy deployment and maintenance, great performance up to 1M+ memories, simple backup/restore. Trade-off: write concurrency limited (mitigated with WAL mode), no built-in vector indexing (using cosine similarity in application)"
)
print(f"[OK] Decision 3 stored: {decision3.get('memory_id')}")

# Decision 4: Multi-Provider Embedding Support
decision4 = client.record_decision(
    decision="Support multiple embedding providers (OpenAI, Gemini, Ollama, local, synthetic)",
    rationale="Different users have different needs: some want best accuracy (OpenAI), some want low cost (Gemini), some want full privacy (Ollama/local), some want zero-setup (synthetic). Provider abstraction allows switching without migration.",
    alternatives="Single provider (OpenAI only), Build custom embedding model, No embeddings (keyword search only)",
    consequences="Maximum flexibility for users, supports both cloud and self-hosted scenarios, enables cost optimization. Trade-off: more complex configuration and testing across providers"
)
print(f"[OK] Decision 4 stored: {decision4.get('memory_id')}")

# Decision 5: Express.js for API Layer
decision5 = client.record_decision(
    decision="Use Express.js framework for REST API server",
    rationale="Express is the de facto standard for Node.js HTTP servers with huge ecosystem, excellent middleware support, and simple routing. Well-understood by most developers and has proven scalability.",
    alternatives="Fastify (faster), Koa (modern), NestJS (more structured), Raw Node.js http module",
    consequences="Simple and maintainable API layer, extensive middleware ecosystem (CORS, rate limiting, auth), well-documented. Trade-off: not the absolute fastest option, but performance is more than adequate for memory operations"
)
print(f"[OK] Decision 5 stored: {decision5.get('memory_id')}")

# Record action for this analysis
action = client.record_action(
    agent_name="claude-code",
    action="Analyzed codebase and stored patterns and architectural decisions",
    context="Examined ai-agents.ts integration, ARCHITECTURE.md, and package.json. Identified 5 key coding patterns and 5 major architectural decisions.",
    outcome="Successfully stored 5 patterns (Multi-Sector Classification, Single-Waypoint Linking, Composite Scoring, Sector-Specific Decay, AI Agent Mapping) and 5 decisions (HMD Architecture, TypeScript, SQLite, Multi-Provider Embeddings, Express.js) in OpenMemory"
)
print(f"\n[OK] Action recorded: {action.get('memory_id')}")

print("\n=== Pattern and Decision Storage Complete ===")
