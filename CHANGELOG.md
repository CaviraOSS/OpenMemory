# changelog

## [1.3.0] - 2025-12-20

### 🎉 major refactors

#### api simplification
- **python sdk**: simplified to zero-config `Memory()` api matching javascript
  - `from openmemory.client import Memory` → `mem = Memory()`
  - works out of the box with sensible defaults (in-memory sqlite, fast tier, synthetic embeddings)
  - optional configuration via environment variables or constructor
  - breaking change: moved from `OpenMemory` class to `Memory` class

#### benchmark suite rewrite
- implemented comprehensive benchmark suite in `temp/benchmarks/`
  - typescript-based using `tsx` for execution
  - supports longmemeval dataset evaluation
  - multi-backend comparison (openmemory, mem0, zep, supermemory)
- created `src/main.ts` consolidated benchmark runner
  - environment validation
  - backend instantiation checks
  - sequential benchmark execution with detailed logging

### ✨ features

#### core improvements
- **`Memory.wipe()`**: added database wipe functionality for testing
  - `clear_all` implementation in `db.ts` for postgres and sqlite
  - clears memories, vectors, waypoints, and users tables
  - useful for benchmark isolation and test cleanup

- **environment variable overrides**:
  - `OM_OLLAMA_MODEL`: override ollama embedding model
  - `OM_OPENAI_MODEL`: override openai embedding model
  - `OM_VEC_DIM`: configure vector dimension (critical for embedding compatibility)
  - `OM_DB_PATH`: sqlite database path (supports `:memory:`)

#### vector store enhancements
- added comprehensive logging to `PostgresVectorStore`
  - logs vector storage operations with id, sector, dimension
  - logs search operations with sector and result count
  - aids in debugging retrieval issues

### 🐛 bug fixes

- **embedding configuration**:
  - fixed `models.ts` to respect `OM_OLLAMA_MODEL` environment variable
  - resolved dimension mismatch issues (768 vs 1536) for embeddinggemma
  - ensured `OM_TIER=deep` uses semantic embeddings (not synthetic fallback)

- **benchmark data isolation**:
  - implemented proper database reset between benchmark runs
  - fixed simhash collision issues causing cross-user contamination
  - added `resetUser()` functionality calling `Memory.wipe()`

- **configuration loading**:
  - fixed dotenv timing issues in benchmark suite
  - ensured environment variables load before openmemory-js initialization
  - corrected dataset path resolution (`longmemeval_s.json`)

### 📚 documentation

- **comprehensive readme updates**:
  - root `README.md`: language-agnostic, showcases both python & javascript sdks
  - `packages/openmemory-js/README.md`: complete api reference, mcp integration, examples
  - `packages/openmemory-py/README.md`: zero-config usage, all embedding providers

- **api documentation**:
  - environment variables with descriptions
  - cognitive sectors explanation
  - performance tiers breakdown
  - embedding provider configurations

### 🔧 internal improvements

- **type safety**: added lint error handling in benchmark adapters
- **code organization**: separated generator, judge, and backend interfaces
- **debug tooling**: created dimension check script (`check_dim.ts`)
- **logging standardization**: consistent `[Component]` prefix pattern

### ⚠️ breaking changes

- python sdk now uses `from openmemory.client import Memory` instead of `from openmemory import OpenMemory`
- `Memory()` constructor signature changed to accept optional parameters (was required)
- benchmark suite moved to typescript (was python)

---

## [1.2.2] - 2024-11-xx

### bug fixes
- memory consolidation edge cases
- multi-user query isolation
- vector dimension handling

---

## [1.2.1] - 2024-11-xx

### improvements
- performance optimizations for large datasets
- enhanced sector classification accuracy

---

## [1.2.0] - 2024-10-xx

### features
- multi-sector memory architecture
- cognitive decay system
- reflection and consolidation

---

## [1.1.0] - 2024-09-xx

### features
- initial typescript sdk release
- sqlite vector store
- basic query and add operations

---

## [1.0.0] - 2024-08-xx

### initial release
- python sdk
- local-first architecture
- basic memory operations
