# Changelog

## 1.2.2 - 2025-12-06

### Fixed

- **MCP Server Path Resolution**: Fixed ENOENT error in stdio mode (Claude Desktop)
  - Enforced absolute path resolution for SQLite database
  - Ensures correct data directory creation regardless of working directory
  - Critical fix for local desktop client integration

- **VectorStore Refactor**: Fixed build regressions in backend
  - Migrated deprecated `q` vector operations to `VectorStore` interface
  - Fixed `users.ts`, `memory.ts`, `graph.ts`, `mcp.ts`, and `decay.ts`
  - Removed partial SQL updates in favor of unified vector store methods

### Added

- **Valkey VectorStore Enhancements**: Improved compatibility and performance
  - Refined vector storage implementation for Valkey backend
  - Optimized vector retrieval and storage operations

### Changed

- **IDE Extension**:
  - Updates to Dashboard UI (`DashboardPanel.ts`) and extension activation logic (`extension.ts`)
  - Configuration and dependency updates

- **Python SDK**:
  - Refinements to embedding logic (`embed.py`)
  - Project configuration updates in `pyproject.toml`

- **Backend Maintenance**:
  - Dockerfile updates for improved containerization
  - Updates to CLI tool (`bin/opm.js`)

## 1.2.1 - 2025-11-23

### Added

- **Python SDK (`sdk-py/`)**: SDK Overhaul, it can now perform as a standalone version of OpenMemory
  - Full feature parity with Backend
  - Local-first architecture with SQLite backend
  - Multi-sector memory (episodic, semantic, procedural, emotional, reflective)
  - All embedding providers: synthetic, OpenAI, Gemini, Ollama, AWS
  - Advanced features: decay, compression, reflection
  - Comprehensive test suite (`sdk-py/tests/test_sdk_py.py`)

- **JavaScript SDK Enhancements (`sdk-js/`)**: SDK Overhaul, it can now perform as a standalone version of OpenMemory
  - Full feature parity with Backend
  - Local-first architecture with SQLite backend
  - Multi-sector memory (episodic, semantic, procedural, emotional, reflective)
  - All embedding providers: synthetic, OpenAI, Gemini, Ollama, AWS
  - Advanced features: decay, compression, reflection

- **Examples**: Complete rewrite of both JS and Python examples
  - `examples/js-sdk/basic-usage.js` - CRUD operations
  - `examples/js-sdk/advanced-features.js` - Decay, compression, reflection
  - `examples/js-sdk/brain-sectors.js` - Multi-sector demonstration
  - `examples/py-sdk/basic_usage.py` - Python CRUD operations
  - `examples/py-sdk/advanced_features.py` - Advanced configuration
  - `examples/py-sdk/brain_sectors.py` - Sector demonstration
  - `examples/py-sdk/performance_benchmark.py` - Performance testing

- **Tests**: Comprehensive test suites for both SDKs
  - `tests/js-sdk/js-sdk.test.js` - Full SDK validation
  - `tests/py-sdk/test-sdk.py` - Python SDK validation
  - Tests cover: initialization, CRUD, sectors, advanced features

- **Architecture Documentation**
  - Mermaid diagram in main README showing complete data flow
  - Covers all 5 cognitive sectors
  - Shows embedding engine, storage layer, recall engine
  - Includes temporal knowledge graph integration
  - Node.js script to regenerate diagrams

#### Changed

- **README Updates**:
  - Added banner image and demo GIF to main README
  - Added dashboard screenshot
  - Comprehensive comparison table with competitors
  - Detailed architecture overview with visual diagram
  - SDK READMEs now include banner and GIF

- **Package Metadata**:
  - Added comprehensive keywords for npm and PyPI
  - Improved descriptions highlighting local-first architecture
  - Apache 2.0 license

## 1.2


### Added

- **Multi-Tenant Support with User Isolation**

  - Complete per-user memory isolation via `user_id` field
  - Automatic user summary generation and management
  - User-scoped queries, stats, and memory operations
  - REST API endpoints:
    - `GET /users/:userId/summary` - Get user memory summary
    - `GET /users/:userId/stats` - Get user statistics
    - `POST /memory/add` with `user_id` field
    - `POST /memory/query` with `filters.user_id`
  - Database schema with user_id indexing for performance
  - Migration tool preserves user isolation during import
  - Full user namespace separation in memory storage

- **Migration Tool for Competitor Import**

  - Standalone CLI tool to migrate from Zep, Mem0, and Supermemory to OpenMemory
  - API-based architecture (no backend dependencies required)
  - Automatic rate limiting for billion-scale exports:
    - Zep: 1 req/s (session-based iteration)
    - Mem0: 20 req/s (user-based export with Token authentication)
    - Supermemory: 5-25 req/s (document pagination)
  - Features:
    - Preserves user isolation and metadata
    - JSONL export format for portability
    - Built-in verification via OpenMemory API
    - Progress tracking and resume support
    - Automatic retry on rate limit (429) errors
  - Reads backend configuration from root `.env` file (`OM_PORT`, `OM_API_KEY`)
  - Environment variable fallback chain: CLI flags → `OPENMEMORY_*` → `OM_*` → defaults
  - Example: `node migrate/index.js --from mem0 --api-key KEY --verify`
  - Full documentation in `migrate/README.md`

- **HYBRID Tier Performance Mode**

  - New tier achieving 100% keyword match accuracy with synthetic embeddings
  - BM25 scoring algorithm for relevance ranking
  - Exact phrase matching with case-insensitive search
  - N-gram keyword extraction (unigrams, bigrams, trigrams)
  - Performance: 800-1000 QPS, 0.5GB RAM per 10k memories
  - Configurable via `OM_TIER=hybrid`, `OM_KEYWORD_BOOST`, `OM_KEYWORD_MIN_LENGTH`
  - Best for: Documentation search, code search, technical references

- **Memory Compression Engine**: Auto-compresses chat/memory content to reduce tokens and latency

  - 5 compression algorithms: whitespace, filler, semantic, aggressive, balanced
  - Auto-selects optimal algorithm based on content analysis
  - Batch compression support for multiple texts
  - Live savings metrics (tokens saved, latency reduction, compression ratio)
  - Real-time statistics tracking across all compressions
  - Integrated into memory storage with automatic compression
  - REST API endpoints: `/api/compression/compress`, `/api/compression/batch`, `/api/compression/analyze`, `/api/compression/stats`
  - Example usage in `examples/backend/compression-examples.mjs`

- **VS Code Extension with AI Auto-Link**

  - Auto-links OpenMemory to 6 AI tools: Cursor, Claude, Windsurf, GitHub Copilot, Codex
  - Dual mode support: Direct HTTP or MCP (Model Context Protocol)
  - Status bar UI with clickable menu for easy control
  - Toggle between HTTP/MCP mode in real-time
  - Zero-config setup - automatically detects backend and writes configs
  - Performance optimizations:
    - **ESH (Event Signature Hash)**: Deduplicates ~70% redundant saves
    - **HCR (Hybrid Context Recall)**: Sub-80ms queries with sector filtering
    - **MVC (Micro-Vector Cache)**: 32-entry LRU cache saves ~60% embedding calls
  - Settings for backend URL, API key, MCP mode toggle
  - Postinstall script for automatic setup

- **API Authentication & Security**

  - API key authentication with timing-safe comparison
  - Rate limiting middleware (configurable, default 100 req/min)
  - Compact 75-line auth implementation
  - Environment-based configuration

- **CI/CD**
  - GitHub Action for automated Docker build testing
  - Ensures Docker images build successfully on every push

### Changed

- Optimized all compression code for maximum efficiency
- Removed verbose comments and long variable names
- Active voice, casual naming convention throughout compression engine
- Streamlined memory routes with integrated compression
- Ultra-compact compression implementation (<100 lines core logic)

### Fixed

- **MCP Tool Names (Breaking Change)**: Changed from dot notation to underscores for Windsurf IDE compatibility

  - `openmemory.query` → `openmemory_query`
  - `openmemory.store` → `openmemory_store`
  - `openmemory.reinforce` → `openmemory_reinforce`
  - `openmemory.list` → `openmemory_list`
  - `openmemory.get` → `openmemory_get`
  - Complies with MCP naming rule: `^[a-zA-Z0-9_-]{1,64}$`

- **PostgreSQL Custom Table Name**: Fixed hardcoded `memories` table in `openmemory://config` resource
  - Now correctly uses `OM_PG_TABLE` environment variable
  - Exports `memories_table` from database module with fully-qualified name
  - Fixes "relation 'memories' does not exist" error with custom table names
  - Works for both PostgreSQL (with schema) and SQLite

### Fixed

- VS Code extension connection issues (health endpoint)
- MCP protocol integration for AI tools
- Extension now properly passes MCP flag to all writers
