# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenMemory is a self-hosted AI memory engine implementing **Hierarchical Memory Decomposition (HMD) v2** with multi-sector embeddings and waypoint-based associative linking. It provides persistent, structured, and semantic memory for LLM applications.

## Build & Development Commands

### Backend (TypeScript/Node)
```bash
cd packages/openmemory-js
npm install                          # Install dependencies
npm run dev                          # Start dev server with nodemon
npm run build                        # Compile TypeScript to dist/
npm start                            # Run production server
npm run format                       # Prettier formatting
npx tsx tests/test_omnibus.ts        # Run omnibus parity test
npm run check-parity                 # Sector parity check
```

### Python SDK
```bash
cd packages/openmemory-py
pip install -e .[dev]                # Install with dev dependencies
pytest tests/test_omnibus.py         # Run omnibus parity test
```

### Dashboard (Next.js)
```bash
cd dashboard
npm install
npm run dev                          # Start dev server on :3000
npm run build                        # Production build
npm run lint                         # ESLint
```

### Docker
```bash
docker compose up --build            # Full stack (API + Dashboard)
docker compose down                  # Stop
```

### Make Targets
```bash
make help                            # Show all targets
make dev                             # Start dev server
make test                            # Run all tests
make full-check                      # Clean, install, build, lint, test
```

## Architecture

### Core Components (packages/openmemory-js/src/)

```
src/
├── server/                    # Express HTTP server
│   ├── index.ts              # Server bootstrap, CORS, auth, decay scheduler
│   ├── routes/               # Route handlers
│   │   ├── memory.ts         # CRUD: /memory/add, /memory/query, /memory/:id
│   │   ├── langgraph.ts      # LangGraph mode: /lgm/store, /lgm/retrieve
│   │   ├── temporal.ts       # Knowledge graph: /temporal/*
│   │   └── dashboard.ts      # Stats and metrics
│   └── middleware/auth.ts    # Bearer token + x-api-key auth
│
├── memory/                    # HSG (Hierarchical Sectored Graph) engine
│   ├── hsg.ts                # Sector classification, waypoint creation, query
│   ├── decay.ts              # Time-based salience decay
│   ├── embed.ts              # Multi-provider embedding generation
│   ├── reflect.ts            # Auto-reflection system
│   └── user_summary.ts       # User profile summaries
│
├── core/                      # Infrastructure
│   ├── db.ts                 # SQLite/PostgreSQL abstraction
│   ├── cfg.ts                # Environment config (OM_* vars)
│   ├── vector_store.ts       # Vector storage abstraction
│   ├── citations.ts          # Citation tracking
│   ├── templates.ts          # Template management
│   └── compliance.ts         # Compliance rules engine
│
├── temporal_graph/            # Temporal knowledge graph
│   ├── store.ts              # Fact storage
│   ├── query.ts              # Temporal queries
│   └── timeline.ts           # Timeline operations
│
├── ai/                        # AI integrations
│   ├── mcp.ts                # Model Context Protocol server
│   └── graph.ts              # LangGraph integration
│
├── ops/                       # Operations
│   ├── ingest.ts             # Document ingestion (PDF, DOCX, audio, video)
│   ├── extract.ts            # Content extraction
│   └── compress.ts           # Vector compression
│
└── sources/                   # External connectors
    ├── github.ts, notion.ts, google_drive.ts, etc.
```

### Memory Sectors

Five cognitive sectors with pattern-based classification and sector-specific decay:

| Sector     | Decay λ | Weight | Examples                           |
|------------|---------|--------|-----------------------------------|
| episodic   | 0.015   | 1.2    | Events, dates, "remember when"    |
| semantic   | 0.005   | 1.0    | Facts, definitions, concepts      |
| procedural | 0.008   | 1.1    | How-to, steps, instructions       |
| emotional  | 0.020   | 1.3    | Feelings, sentiments, reactions   |
| reflective | 0.001   | 0.8    | Insights, meta-cognition          |

### Query Scoring

Composite score = 0.6×similarity + 0.2×salience + 0.1×recency + 0.1×waypoint

### Database Schema

SQLite (default) or PostgreSQL. Key tables:
- `memories` - Content, sector, salience, mean vector
- `vectors` - Per-sector embeddings (id, sector, blob)
- `waypoints` - Single-link associations (src_id, dst_id, weight)
- `embed_logs` - Embedding operation tracking

## Environment Configuration

Key variables (see docker-compose.yml for full list):

```bash
# Server
OM_PORT=8080
OM_API_KEY=                     # Optional bearer token
OM_DB_PATH=./data/openmemory.sqlite

# Embeddings
OM_EMBEDDINGS=openai            # openai|gemini|aws|ollama|synthetic
OM_EMBED_MODE=simple            # simple|advanced
OM_VEC_DIM=768

# Provider keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# Database backend
OM_METADATA_BACKEND=sqlite      # sqlite|postgres
OM_VECTOR_BACKEND=sqlite        # sqlite|postgres|valkey

# Modes
OM_MODE=standard                # standard|langgraph
OM_TIER=deep                    # deep|hybrid|fast
```

## Code Patterns

### Authentication
The server uses optional bearer token auth via `OM_API_KEY`. Check `src/server/middleware/auth.ts` for implementation using `timingSafeEqual`.

### Adding a New Route
1. Create handler in `src/server/routes/<name>.ts`
2. Export route registration function
3. Import and call in `src/server/routes/index.ts`

### Embedding Providers
Implement the embedding interface in `src/memory/embed.ts`:
```typescript
interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  getDimensions(): number;
}
```

### Vector Operations
Use utilities from `src/utils/index.ts`: `cos_sim`, `buf_to_vec`, `vec_to_buf`

### UUID Generation
Use `rid()` from `src/utils/index.ts` for all UUID generation. This wraps the native `crypto.randomUUID()` for consistency across the codebase.

### Safe Regex for User Input
When accepting regex patterns from user input (templates, compliance rules), use the safe regex utilities from `src/utils/regex.ts`:
```typescript
import { create_safe_regex, safe_regex_test, safe_regex_match_all } from "../utils";

// Validate and create a safe regex (returns null if dangerous)
const regex = create_safe_regex(user_pattern, flags);
if (!regex) {
  // Handle invalid/unsafe pattern
}

// Execute with protection against ReDoS
const result = safe_regex_test(regex, content);
const matches = safe_regex_match_all(regex, content, { max_matches: 100 });
```

### Version History Pruning
Document versioning (D1) auto-prunes old versions to prevent unbounded growth:
- Default limit: 50 versions per memory
- Configurable via `OM_MAX_VERSIONS_PER_MEMORY` env var
- Pruning runs asynchronously after each `save_version()` call
- Use `prune_all_versions()` for batch maintenance

## Testing

The project uses **omnibus tests** for SDK parity checking:
- `packages/openmemory-js/tests/test_omnibus.ts`
- `packages/openmemory-py/tests/test_omnibus.py`

These ensure TypeScript and Python implementations behave identically.

## Commit Style

Use conventional commits: `feat(scope):`, `fix(scope):`, `docs:`, `refactor:`, `test:`, `chore:`

Examples:
```
feat(embedding): add Google Gemini embedding provider
fix(database): resolve memory leak in connection pooling
```
