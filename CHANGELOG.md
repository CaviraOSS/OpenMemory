# Changelog

## 1.2

### Added

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
