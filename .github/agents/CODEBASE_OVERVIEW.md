# OpenMemory Codebase Overview

This document provides a high-level overview of the OpenMemory codebase for GitHub Copilot agents.

## What is OpenMemory?

OpenMemory is a cognitive memory engine for LLMs and agents, providing real long-term memory capabilities beyond simple RAG (Retrieval Augmented Generation) or vector database solutions.

## Core Features

- **Multi-Sector Memory**: Episodic (events), semantic (facts), procedural (skills), emotional (feelings), reflective (insights)
- **Temporal Knowledge Graph**: Time-aware facts with `valid_from`/`valid_to` windows
- **Composite Scoring**: Combines salience, recency, and coactivation (not just cosine distance)
- **Decay Engine**: Adaptive forgetting per sector instead of hard TTLs
- **Explainable Recall**: Waypoint traces showing which nodes were recalled and why
- **Self-Hosted**: Local-first with SQLite or PostgreSQL backend
- **Multiple Integrations**: LangChain, CrewAI, AutoGen, Streamlit, MCP, VS Code

## Repository Structure

```
OpenMemory/
├── .github/              # GitHub configuration
│   ├── agents/           # Copilot agent configuration
│   ├── workflows/        # CI/CD pipelines
│   └── ISSUE_TEMPLATE/   # Issue templates
├── packages/
│   ├── openmemory-js/    # Node.js/TypeScript SDK and backend
│   │   ├── src/          # Source code
│   │   ├── tests/        # Test suite
│   │   └── package.json
│   └── openmemory-py/    # Python SDK
│       ├── openmemory/   # Python package
│       ├── tests/        # Test suite
│       └── setup.py
├── dashboard/            # Web dashboard UI
│   ├── src/              # React source
│   └── public/           # Static assets
├── examples/             # Example implementations
├── docs/                 # Documentation
├── tools/                # CLI and utilities
├── scripts/              # Build and deployment scripts
├── ARCHITECTURE.md       # Detailed architecture
├── README.md             # Main documentation
├── CONTRIBUTING.md       # Contribution guidelines
└── SECURITY.md           # Security policies

```

## Key Components

### 1. Memory Core (`packages/openmemory-js/src/core/`)

- **MemoryEngine**: Main orchestration layer
- **SectorClassifier**: Classifies memories into sectors
- **EmbeddingEngine**: Handles vector embeddings
- **RecallEngine**: Retrieves and scores memories
- **DecayEngine**: Manages memory decay and reinforcement

### 2. Temporal Knowledge Graph (`packages/openmemory-js/src/temporal/`)

- **TemporalGraph**: Manages time-aware facts
- **Timeline**: Reconstructs entity history
- **FactEvolution**: Handles fact succession and closure

### 3. Database Layer

- **SQLite**: Default local storage
- **PostgreSQL**: Optional for production deployments
- **Migrations**: Schema versioning and updates

### 4. SDKs

- **JavaScript/TypeScript**: Full-featured SDK with MCP server
- **Python**: Feature-parity SDK with async support

### 5. Integrations

- **OpenAI**: Direct integration for chat completions
- **LangChain**: Message history and memory tools
- **MCP**: Model Context Protocol server
- **VS Code**: Extension for IDE integration

## Memory Sectors Explained

1. **Episodic**: Time-stamped events and experiences
   - Example: "User logged in at 2024-01-15"

2. **Semantic**: Facts and knowledge
   - Example: "Python is a programming language"

3. **Procedural**: Skills and how-to knowledge
   - Example: "To deploy, run 'npm run build'"

4. **Emotional**: Feelings and sentiment
   - Example: "User expressed frustration with slow loading"

5. **Reflective**: Meta-insights and learned patterns
   - Example: "User typically codes in the evening"

## Common Development Workflows

### Adding a New Feature

1. Check `ARCHITECTURE.md` for design patterns
2. Implement in both Node.js and Python SDKs for parity
3. Add tests to omnibus test suites
4. Update relevant documentation
5. Run linters and tests
6. Submit PR with clear description

### Testing

```bash
# Node.js
cd packages/openmemory-js
npm test
npx tsx tests/test_omnibus.ts

# Python
cd packages/openmemory-py
pytest
pytest tests/test_omnibus.py
```

### Running Locally

```bash
# Full stack with Docker
docker-compose up --build

# Backend only
cd packages/openmemory-js
npm install
npm run dev

# Dashboard
cd dashboard
npm install
npm run dev
```

## Data Flow

```
Input → Sector Classifier → Embedding Engine → Storage
                                                   ↓
Query → Recall Engine ← Vector Search + Waypoint Graph + Decay Engine
           ↓
      Consolidation → Reflection → Output + Trace
```

## Important Conventions

- **User IDs**: All memories are scoped to a `user_id` for multi-tenancy
- **Timestamps**: Use ISO 8601 format
- **Embeddings**: Default to OpenAI, fallback to synthetic
- **Database**: Connection pooling and proper cleanup
- **Errors**: Descriptive error messages with context
- **Logging**: Structured logging for debugging

## Security Considerations

- Validate all input parameters
- Sanitize database queries (use parameterized queries)
- Protect API keys and credentials
- Follow principle of least privilege
- Audit security-sensitive operations
- See `SECURITY.md` for full guidelines

## Testing Strategy

- **Unit Tests**: Test individual components
- **Integration Tests**: Test component interactions
- **Omnibus Tests**: Comprehensive parity checks between SDKs
- **E2E Tests**: Test full user workflows
- **Performance Tests**: Benchmark critical paths

## API Compatibility

When making changes:
- Maintain backward compatibility
- Version breaking changes appropriately
- Update both SDKs simultaneously
- Document migration paths
- Update changelog

## Resources

- Architecture: `ARCHITECTURE.md`
- Contributing: `CONTRIBUTING.md`
- Security: `SECURITY.md`
- API Docs: `docs/`
- Examples: `examples/`
- Discord: https://discord.gg/P7HaRayqTh
