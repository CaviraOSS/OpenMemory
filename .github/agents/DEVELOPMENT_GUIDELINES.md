# Development Guidelines for GitHub Copilot Agents

This document provides specific guidelines for GitHub Copilot agents working on the OpenMemory codebase.

## Code Style and Standards

### JavaScript/TypeScript

- Use **TypeScript** for new code
- Follow existing code patterns and naming conventions
- Use **async/await** for asynchronous operations
- Prefer **functional programming** patterns where appropriate
- Use **Prettier** for formatting (config in `.prettierrc.js`)
- Add JSDoc comments for public APIs

```typescript
// Good example
export async function storeMemory(
  content: string,
  options: MemoryOptions
): Promise<Memory> {
  // Implementation
}

// Bad example - missing types
export async function storeMemory(content, options) {
  // Implementation
}
```

### Python

- Follow **PEP 8** style guide
- Use **type hints** for function signatures
- Use **Black** for code formatting
- Use **isort** for import sorting
- Add **docstrings** for classes and functions

```python
# Good example
async def store_memory(
    content: str,
    user_id: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Memory:
    """Store a memory with the given content.
    
    Args:
        content: The memory content to store
        user_id: The user identifier
        metadata: Optional metadata dictionary
        
    Returns:
        The created Memory object
    """
    # Implementation

# Bad example - missing types and docstring
async def store_memory(content, user_id, metadata=None):
    # Implementation
```

## Testing Requirements

### Always Add Tests

When adding new features or fixing bugs:

1. Add unit tests for individual functions
2. Add integration tests for component interactions
3. Update omnibus tests if changing core APIs
4. Ensure tests pass in both Node.js and Python SDKs

### Test File Organization

```
packages/openmemory-js/
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── test_omnibus.ts    # Comprehensive parity test

packages/openmemory-py/
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── test_omnibus.py    # Comprehensive parity test
```

### Running Tests

```bash
# Node.js
cd packages/openmemory-js
npm test                      # Run all tests
npm test -- --grep "pattern" # Run specific tests
npx tsx tests/test_omnibus.ts # Omnibus test

# Python
cd packages/openmemory-py
pytest                        # Run all tests
pytest tests/unit/           # Run unit tests only
pytest tests/test_omnibus.py # Omnibus test
```

## SDK Parity

**Critical**: Maintain feature parity between Node.js and Python SDKs.

### When Adding a New Feature

1. Implement in both SDKs simultaneously
2. Use similar naming conventions (adjust for language idioms)
3. Ensure consistent behavior
4. Update omnibus tests to validate parity
5. Document in both SDK READMEs

### Example: Adding a New Method

```typescript
// Node.js: packages/openmemory-js/src/client.ts
export class Memory {
  async reinforce(memoryId: string): Promise<void> {
    // Implementation
  }
}
```

```python
# Python: packages/openmemory-py/openmemory/client.py
class Memory:
    async def reinforce(self, memory_id: str) -> None:
        """Reinforce a memory by ID."""
        # Implementation
```

## Database Operations

### Always Use Parameterized Queries

```typescript
// Good - parameterized query
const result = await db.query(
  'SELECT * FROM memories WHERE user_id = ? AND sector = ?',
  [userId, sector]
);

// Bad - string interpolation (SQL injection risk!)
const result = await db.query(
  `SELECT * FROM memories WHERE user_id = '${userId}'`
);
```

### Connection Management

- Always close database connections
- Use connection pooling for production
- Handle connection errors gracefully
- Test with both SQLite and PostgreSQL

## Error Handling

### Provide Context in Errors

```typescript
// Good - descriptive error with context
throw new Error(
  `Failed to store memory for user ${userId}: ${error.message}`
);

// Bad - generic error
throw new Error('Failed to store memory');
```

### Handle Async Errors

```typescript
// Good - proper error handling
try {
  await storeMemory(content, options);
} catch (error) {
  logger.error('Memory storage failed', { error, userId });
  throw error;
}

// Bad - unhandled promise rejection
storeMemory(content, options);
```

## Memory Sector Classification

When working with memory sectors:

1. **Episodic**: Events with specific timestamps
2. **Semantic**: Timeless facts and knowledge
3. **Procedural**: Step-by-step instructions
4. **Emotional**: Sentiment and feelings
5. **Reflective**: Meta-insights and patterns

Ensure new features respect sector-specific behavior (e.g., decay rates differ by sector).

## Temporal Operations

When working with temporal knowledge graphs:

- Always validate `valid_from` and `valid_to` timestamps
- Handle timeline queries correctly
- Ensure fact evolution closes previous facts
- Test edge cases (concurrent facts, overlapping periods)

```typescript
// Good - proper temporal validation
if (validFrom && validTo && validFrom >= validTo) {
  throw new Error('valid_from must be before valid_to');
}

// Good - handle undefined valid_to (ongoing fact)
const isActive = !fact.valid_to || fact.valid_to > now;
```

## Performance Considerations

### Vector Operations

- Batch embeddings when possible
- Cache frequently accessed embeddings
- Use appropriate embedding dimensions
- Consider fallback to synthetic embeddings

### Database Queries

- Use indexes for frequently queried columns
- Limit result sets appropriately
- Use pagination for large datasets
- Profile slow queries

## Documentation

### When to Update Documentation

- New features: Update README and relevant docs
- API changes: Update API documentation
- Breaking changes: Update CHANGELOG.md and MIGRATION.md
- Bug fixes: Update SECURITY_FIXES_SUMMARY.md if security-related

### Documentation Style

- Use clear, concise language
- Provide code examples
- Explain the "why" not just the "what"
- Keep examples up-to-date with code changes

## Security Best Practices

1. **Input Validation**: Validate all user input
2. **SQL Injection**: Use parameterized queries
3. **API Keys**: Never commit secrets to the repository
4. **Dependencies**: Keep dependencies updated
5. **Audit Logs**: Log security-sensitive operations

See `SECURITY.md` for comprehensive security guidelines.

## MCP Server Development

When working on the MCP (Model Context Protocol) server:

- Follow MCP specification strictly
- Test with multiple MCP clients (Claude, Cursor, Windsurf)
- Ensure tool descriptions are clear and accurate
- Handle errors gracefully with helpful messages
- Document available tools and their parameters

## Dashboard Development

When working on the web dashboard:

- Use React best practices
- Ensure responsive design
- Test with different data volumes
- Handle loading and error states
- Follow existing component patterns

## Common Pitfalls to Avoid

1. **Breaking SDK Parity**: Always update both SDKs
2. **Missing Tests**: All code should have tests
3. **SQL Injection**: Never interpolate user input into queries
4. **Memory Leaks**: Always clean up resources
5. **Hardcoded Values**: Use configuration and environment variables
6. **Missing Error Handling**: Handle edge cases and errors
7. **Uncommitted Secrets**: Check for API keys before committing
8. **Inconsistent Naming**: Follow existing conventions

## Git Workflow

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add memory reinforcement API
fix: resolve SQL injection in search query
docs: update Python SDK installation guide
test: add omnibus test for temporal operations
refactor: simplify embedding engine initialization
```

### Branch Naming

```
feature/add-memory-reinforcement
fix/sql-injection-in-search
docs/update-python-guide
test/add-temporal-tests
```

## Building and Deployment

### Local Development

```bash
# Install dependencies
npm install  # or pip install -e .

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up --build

# Run specific service
docker-compose up backend
```

## Getting Help

- Review existing code for patterns
- Check `ARCHITECTURE.md` for design decisions
- Read `CONTRIBUTING.md` for contribution process
- Search GitHub issues for similar problems
- Ask in Discord: https://discord.gg/P7HaRayqTh

## Resources

- **Architecture**: `/ARCHITECTURE.md`
- **Contributing**: `/CONTRIBUTING.md`
- **Security**: `/SECURITY.md`
- **Node.js SDK**: `/packages/openmemory-js/README.md`
- **Python SDK**: `/packages/openmemory-py/README.md`
- **Examples**: `/examples/`
- **Documentation**: `/docs/`
