# Testing Guidelines for GitHub Copilot Agents

This document provides comprehensive testing guidelines for agents working on OpenMemory.

## Testing Philosophy

OpenMemory follows a **comprehensive testing strategy** to ensure reliability and maintain parity between SDKs:

1. **Unit Tests**: Test individual functions and classes
2. **Integration Tests**: Test component interactions
3. **Omnibus Tests**: Validate SDK parity and core functionality
4. **E2E Tests**: Test complete user workflows
5. **Performance Tests**: Benchmark critical operations

## Test Structure

### Node.js Tests

```
packages/openmemory-js/tests/
├── unit/
│   ├── memory.test.ts          # Memory core tests
│   ├── sectors.test.ts         # Sector classifier tests
│   ├── embedding.test.ts       # Embedding engine tests
│   └── temporal.test.ts        # Temporal graph tests
├── integration/
│   ├── api.test.ts             # API integration tests
│   ├── database.test.ts        # Database integration tests
│   └── mcp.test.ts             # MCP server tests
└── test_omnibus.ts             # Comprehensive parity test
```

### Python Tests

```
packages/openmemory-py/tests/
├── unit/
│   ├── test_memory.py          # Memory core tests
│   ├── test_sectors.py         # Sector classifier tests
│   ├── test_embedding.py       # Embedding engine tests
│   └── test_temporal.py        # Temporal graph tests
├── integration/
│   ├── test_api.py             # API integration tests
│   └── test_database.py        # Database integration tests
└── test_omnibus.py             # Comprehensive parity test
```

## Running Tests

### Node.js/TypeScript

```bash
cd packages/openmemory-js

# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/memory.test.ts

# Run tests matching pattern
npm test -- --grep "memory storage"

# Run with coverage
npm test -- --coverage

# Run omnibus test
npx tsx tests/test_omnibus.ts

# Watch mode
npm test -- --watch
```

### Python

```bash
cd packages/openmemory-py

# Run all tests
pytest

# Run specific test file
pytest tests/unit/test_memory.py

# Run tests matching pattern
pytest -k "test_memory_storage"

# Run with coverage
pytest --cov=openmemory

# Run omnibus test
pytest tests/test_omnibus.py

# Verbose output
pytest -v

# Watch mode (requires pytest-watch)
ptw
```

## Writing Unit Tests

### Test Structure

Every test should follow the **Arrange-Act-Assert** pattern:

```typescript
// Node.js example
describe('Memory', () => {
  describe('add', () => {
    it('should store a memory with the correct user_id', async () => {
      // Arrange
      const memory = new Memory();
      const userId = 'test_user';
      const content = 'test memory';
      
      // Act
      const result = await memory.add(content, { user_id: userId });
      
      // Assert
      expect(result.user_id).toBe(userId);
      expect(result.content).toBe(content);
    });
  });
});
```

```python
# Python example
class TestMemory:
    async def test_add_stores_memory_with_user_id(self):
        # Arrange
        memory = Memory()
        user_id = "test_user"
        content = "test memory"
        
        # Act
        result = await memory.add(content, user_id=user_id)
        
        # Assert
        assert result.user_id == user_id
        assert result.content == content
```

### Test Naming Conventions

- Use descriptive names that explain what is being tested
- Follow the pattern: `test_<method>_<scenario>_<expected_result>`
- Examples:
  - `test_add_stores_memory_successfully`
  - `test_search_returns_empty_for_nonexistent_user`
  - `test_delete_raises_error_for_invalid_id`

### Test Coverage Requirements

- **New Features**: Must have >80% code coverage
- **Bug Fixes**: Must include tests that would have caught the bug
- **Public APIs**: Must have comprehensive test coverage
- **Edge Cases**: Must be explicitly tested

## Writing Integration Tests

Integration tests verify that components work together correctly.

```typescript
// Node.js integration test example
describe('Memory API Integration', () => {
  let memory: Memory;
  
  beforeEach(async () => {
    memory = new Memory({ db: ':memory:' });
  });
  
  afterEach(async () => {
    await memory.close();
  });
  
  it('should store and retrieve memory with embeddings', async () => {
    // Store memory
    const stored = await memory.add('test content', { 
      user_id: 'user1' 
    });
    
    // Retrieve memory
    const results = await memory.search('test', { 
      user_id: 'user1' 
    });
    
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(stored.id);
  });
});
```

## Omnibus Tests

Omnibus tests validate **SDK parity** and comprehensive functionality.

### What Omnibus Tests Should Cover

1. Core memory operations (add, search, get, delete)
2. Sector classification
3. Temporal operations
4. Embedding generation
5. Decay and reinforcement
6. Waypoint graph operations
7. MCP server functionality (Node.js only)

### Example Omnibus Test

```typescript
// Node.js omnibus test
async function runOmnibusTests() {
  const memory = new Memory();
  
  // Test 1: Basic memory storage
  const m1 = await memory.add('User likes pizza', { 
    user_id: 'user1' 
  });
  assert(m1.id, 'Memory should have an ID');
  
  // Test 2: Memory retrieval
  const results = await memory.search('pizza', { 
    user_id: 'user1' 
  });
  assert(results.length > 0, 'Should find stored memory');
  
  // Test 3: Temporal operations
  await memory.temporal.addFact({
    subject: 'User',
    predicate: 'likes',
    object: 'pizza',
    valid_from: new Date()
  });
  
  // Continue with more tests...
}
```

## Mocking and Fixtures

### When to Use Mocks

- External API calls (OpenAI, Gemini, etc.)
- File system operations
- Network requests
- Time-dependent behavior

### Example Mock

```typescript
// Node.js mock example
import { jest } from '@jest/globals';

jest.mock('../src/embedding', () => ({
  generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3])
}));
```

```python
# Python mock example
from unittest.mock import AsyncMock, patch

@patch('openmemory.embedding.generate_embedding')
async def test_with_mock(mock_generate):
    mock_generate.return_value = [0.1, 0.2, 0.3]
    # Test implementation
```

### Test Fixtures

```typescript
// Node.js fixture
export const mockMemories = [
  {
    id: 'mem1',
    content: 'test memory 1',
    user_id: 'user1',
    sector: 'semantic'
  },
  {
    id: 'mem2',
    content: 'test memory 2',
    user_id: 'user1',
    sector: 'episodic'
  }
];
```

## Testing Temporal Operations

Temporal operations require special attention to time handling.

```typescript
describe('Temporal Graph', () => {
  it('should handle fact evolution correctly', async () => {
    const temporal = new TemporalGraph();
    
    // Add initial fact
    const fact1 = await temporal.addFact({
      subject: 'Company',
      predicate: 'has_CEO',
      object: 'Alice',
      valid_from: new Date('2020-01-01')
    });
    
    // Add superseding fact
    const fact2 = await temporal.addFact({
      subject: 'Company',
      predicate: 'has_CEO',
      object: 'Bob',
      valid_from: new Date('2024-01-01')
    });
    
    // Verify first fact was closed
    const updated = await temporal.getFact(fact1.id);
    expect(updated.valid_to).toBeDefined();
    expect(updated.valid_to).toBeLessThan(fact2.valid_from);
  });
});
```

## Testing Database Operations

### Use In-Memory Database for Tests

```typescript
// Node.js - use :memory: for SQLite tests
const memory = new Memory({ db: ':memory:' });
```

```python
# Python - use in-memory database
memory = Memory(db_path=':memory:')
```

### Test Database Migrations

```typescript
it('should migrate database schema correctly', async () => {
  const db = await openDatabase(':memory:');
  await runMigrations(db);
  
  // Verify schema
  const tables = await db.query(
    "SELECT name FROM sqlite_master WHERE type='table'"
  );
  
  expect(tables).toContain('memories');
  expect(tables).toContain('temporal_facts');
});
```

## Testing Error Conditions

Always test error conditions and edge cases.

```typescript
describe('Error Handling', () => {
  it('should throw error for invalid user_id', async () => {
    const memory = new Memory();
    
    await expect(
      memory.add('content', { user_id: '' })
    ).rejects.toThrow('user_id is required');
  });
  
  it('should handle database connection errors', async () => {
    const memory = new Memory({ 
      db: '/invalid/path/db.sqlite' 
    });
    
    await expect(
      memory.add('content', { user_id: 'user1' })
    ).rejects.toThrow();
  });
});
```

## Performance Testing

Test performance-critical operations.

```typescript
describe('Performance', () => {
  it('should handle 1000 memories efficiently', async () => {
    const memory = new Memory({ db: ':memory:' });
    const startTime = Date.now();
    
    // Add 1000 memories
    for (let i = 0; i < 1000; i++) {
      await memory.add(`memory ${i}`, { user_id: 'user1' });
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000); // Should complete in <10s
  });
  
  it('should search through 1000 memories quickly', async () => {
    // Setup: add 1000 memories
    const memory = new Memory({ db: ':memory:' });
    for (let i = 0; i < 1000; i++) {
      await memory.add(`memory ${i}`, { user_id: 'user1' });
    }
    
    // Test search performance
    const startTime = Date.now();
    const results = await memory.search('memory', { 
      user_id: 'user1' 
    });
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(1000); // Should complete in <1s
  });
});
```

## Test Isolation

Ensure tests are isolated and don't affect each other.

```typescript
describe('Memory Tests', () => {
  let memory: Memory;
  
  beforeEach(async () => {
    // Create fresh instance for each test
    memory = new Memory({ db: ':memory:' });
  });
  
  afterEach(async () => {
    // Clean up after each test
    await memory.close();
  });
  
  // Tests here...
});
```

## Continuous Integration

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Scheduled nightly builds

### CI Test Requirements

- All tests must pass before merging
- Code coverage must not decrease
- Performance benchmarks must not regress significantly

## Test Documentation

Document complex test scenarios:

```typescript
/**
 * Tests that the decay engine correctly reduces salience over time
 * according to the sector-specific decay rates.
 * 
 * Test scenario:
 * 1. Create memories in different sectors
 * 2. Fast-forward time
 * 3. Verify salience has decayed according to sector rates
 */
it('should apply sector-specific decay rates', async () => {
  // Test implementation
});
```

## Debugging Failed Tests

When tests fail:

1. Run the specific test in isolation
2. Add `console.log` or `print` statements
3. Use debugger breakpoints
4. Check database state after operations
5. Verify mock expectations
6. Review recent code changes

```bash
# Node.js - debug specific test
node --inspect-brk node_modules/.bin/jest tests/unit/memory.test.ts

# Python - debug with pdb
pytest --pdb tests/unit/test_memory.py
```

## Best Practices Summary

1. ✅ Write tests for all new features
2. ✅ Include edge cases and error conditions
3. ✅ Use descriptive test names
4. ✅ Keep tests isolated and independent
5. ✅ Mock external dependencies
6. ✅ Test both success and failure paths
7. ✅ Maintain SDK parity in tests
8. ✅ Update omnibus tests for core changes
9. ✅ Document complex test scenarios
10. ✅ Ensure tests run quickly (<30s for unit tests)

## Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **pytest Documentation**: https://docs.pytest.org/
- **Testing Best Practices**: `/CONTRIBUTING.md`
- **Example Tests**: `/packages/openmemory-js/tests/`
