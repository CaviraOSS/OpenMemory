# GitHub Copilot Agents Configuration

This directory contains configuration and documentation for GitHub Copilot agents working on the OpenMemory repository.

## Overview

OpenMemory is a cognitive memory engine for LLMs and agents. This directory provides essential context and guidelines for AI agents to effectively contribute to the project.

## Files in This Directory

### `agent.yml`
Main configuration file that provides:
- Repository structure and context
- Key concepts and terminology
- Development guidelines
- Important file references
- Common tasks and workflows

### `CODEBASE_OVERVIEW.md`
High-level overview of the codebase including:
- Project architecture
- Directory structure
- Key components
- Memory sectors explained
- Data flow diagrams
- Common development workflows

### `DEVELOPMENT_GUIDELINES.md`
Detailed development guidelines covering:
- Code style and standards (TypeScript/JavaScript and Python)
- Testing requirements
- SDK parity maintenance
- Database operations
- Error handling
- Security best practices
- MCP server development
- Git workflow

### `TESTING_GUIDELINES.md`
Comprehensive testing guidelines including:
- Testing philosophy and strategy
- Test structure and organization
- Running tests (Node.js and Python)
- Writing unit and integration tests
- Omnibus tests for SDK parity
- Mocking and fixtures
- Testing temporal operations
- Performance testing
- CI/CD requirements

## Quick Start for Agents

1. **Read First**: Start with `CODEBASE_OVERVIEW.md` to understand the project
2. **Follow Standards**: Review `DEVELOPMENT_GUIDELINES.md` for coding standards
3. **Test Everything**: Consult `TESTING_GUIDELINES.md` for testing requirements
4. **Check Configuration**: Reference `agent.yml` for quick context

## Key Principles for Agents

### 1. SDK Parity
Always maintain feature parity between Node.js and Python SDKs. When implementing a new feature:
- Implement in both SDKs
- Use similar naming conventions (adjusted for language idioms)
- Update omnibus tests
- Document in both SDK READMEs

### 2. Testing
All code changes must include tests:
- Unit tests for new functions/methods
- Integration tests for component interactions
- Update omnibus tests for core API changes
- Ensure tests pass in both SDKs

### 3. Security
Follow security best practices:
- Validate all input parameters
- Use parameterized queries (never string interpolation)
- Handle errors gracefully
- Never commit secrets or API keys
- See `SECURITY.md` for details

### 4. Documentation
Keep documentation up-to-date:
- Update README files for API changes
- Add examples for new features
- Update CHANGELOG.md for notable changes
- Document breaking changes in MIGRATION.md

## Project Structure

```
OpenMemory/
├── .github/agents/          # This directory - agent configuration
├── packages/
│   ├── openmemory-js/       # Node.js/TypeScript SDK and backend
│   └── openmemory-py/       # Python SDK
├── dashboard/               # Web dashboard UI
├── examples/                # Example implementations
├── docs/                    # Documentation
├── ARCHITECTURE.md          # Detailed architecture
├── README.md                # Main documentation
├── CONTRIBUTING.md          # Contribution guidelines
└── SECURITY.md              # Security policies
```

## Core Concepts

### Memory Sectors
OpenMemory organizes memories into sectors:
- **Episodic**: Time-stamped events and experiences
- **Semantic**: Facts and knowledge
- **Procedural**: Skills and how-to knowledge
- **Emotional**: Feelings and sentiment
- **Reflective**: Meta-insights and learned patterns

### Temporal Knowledge Graph
Time-aware facts with:
- `valid_from` / `valid_to` timestamps
- Automatic fact evolution
- Point-in-time queries
- Timeline reconstruction

### Composite Scoring
Memories are scored based on:
- **Salience**: Importance and relevance
- **Recency**: How recent the memory is
- **Coactivation**: How often it's accessed with other memories

## Common Tasks

### Adding a New Feature
1. Review `ARCHITECTURE.md` for design patterns
2. Implement in both Node.js and Python SDKs
3. Add comprehensive tests
4. Update documentation
5. Ensure tests pass
6. Submit PR

### Fixing a Bug
1. Write a test that reproduces the bug
2. Fix the issue
3. Verify the test now passes
4. Check for similar issues in other SDK
5. Update documentation if needed

### Improving Performance
1. Identify bottleneck with profiling
2. Implement optimization
3. Add performance test
4. Verify improvement doesn't break functionality
5. Document changes

## Development Commands

### Node.js
```bash
cd packages/openmemory-js
npm install
npm test                      # Run tests
npm run dev                   # Start dev server
npx tsx tests/test_omnibus.ts # Run omnibus test
```

### Python
```bash
cd packages/openmemory-py
pip install -e .[dev]
pytest                        # Run tests
pytest tests/test_omnibus.py  # Run omnibus test
```

### Full Stack
```bash
docker-compose up --build     # Run full stack
```

## Resources

- **Discord**: https://discord.gg/P7HaRayqTh
- **GitHub Issues**: https://github.com/CaviraOSS/OpenMemory/issues
- **Documentation**: https://openmemory.cavira.app/docs/
- **Architecture**: `/ARCHITECTURE.md`
- **Contributing**: `/CONTRIBUTING.md`
- **Security**: `/SECURITY.md`

## Getting Help

If you need clarification on:
- Architecture decisions → See `ARCHITECTURE.md`
- Development process → See `CONTRIBUTING.md`
- Security concerns → See `SECURITY.md`
- Testing approach → See `TESTING_GUIDELINES.md`
- Code style → See `DEVELOPMENT_GUIDELINES.md`

## Updates

This configuration is maintained by the OpenMemory team. If you notice outdated information or have suggestions for improvements, please submit an issue or PR.

Last updated: 2024
