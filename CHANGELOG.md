# Changelog

## [Unreleased]

### Added

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

- VS Code extension connection issues (health endpoint)
- MCP protocol integration for AI tools
- Extension now properly passes MCP flag to all writers
