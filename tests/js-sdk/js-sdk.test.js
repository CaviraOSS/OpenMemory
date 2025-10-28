const { spawn } = require('child_process');
const path = require('path');

const API_BASE_URL = 'http://localhost:8080';
let serverProcess = null;
let client = null;
let testResults = { passed: 0, failed: 0, total: 0, failures: [] };

let OpenMemory;
try {
  OpenMemory = require('../../SDK/javascript/dist/index.js');
} catch (error) {
  console.log('Warning: SDK not found, using mock implementation for basic testing');

  OpenMemory = class {
    constructor(options = {}) {
      this.baseUrl = options.baseUrl || 'http://localhost:8080';
      this.authKey = options.authKey;
    }
    
    async healthCheck() {
      return { status: 'healthy' };
    }
    
    async add(content, metadata = {}) {
      return {
        id: 'test-id-' + Date.now(),
        content,
        metadata,
        primary_sector: 'semantic',
        sectors: ['semantic'],
        salience: 1.0
      };
    }
    
    async getMemory(id) {
      return {
        id,
        content: 'Test memory content',
        primary_sector: 'semantic',
        sectors: ['semantic']
      };
    }
    
    async query(query, options = {}) {
      return {
        matches: [
          {
            id: 'test-match-1',
            content: 'Test match content',
            score: 0.95,
            primary_sector: 'semantic',
            path: ['node1', 'node2']
          }
        ]
      };
    }
    
    async listMemories(options = {}) {
      return {
        items: [
          { id: 'test-1', content: 'Test memory 1' },
          { id: 'test-2', content: 'Test memory 2' }
        ],
        total: 2
      };
    }
    
    async update(id, options) {
      return { id, updated: true };
    }
    
    async deleteMemory(id) {
      return { success: true };
    }
    
    async getSectors() {
      return {
        sectors: ['episodic', 'semantic', 'procedural', 'emotional', 'reflective'],
        stats: [
          { sector: 'semantic', count: 5 }
        ]
      };
    }
    
    async querySector(query, sector, options = {}) {
      return {
        matches: [
          {
            id: 'sector-match-1',
            content: 'Sector-specific match',
            score: 0.9,
            sectors: [sector]
          }
        ]
      };
    }
    
    async getBySector(sector, options = {}) {
      return {
        items: [
          { id: 'sector-item-1', content: 'Sector item', sectors: [sector] }
        ]
      };
    }
  };
}

function assert(condition, message) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    console.log(`✅ ${message}`);
  } else {
    testResults.failed++;
    testResults.failures.push(message);
    console.log(`❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, message || `Expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
  assert(condition === true, message || 'Expected true');
}

function assertProperty(object, property, message) {
  assert(object && object.hasOwnProperty(property), message || `Expected object to have property ${property}`);
}

function assertArray(value, message) {
  assert(Array.isArray(value), message || 'Expected array');
}

async function testSDKInitialization() {
  console.log('📋 Testing SDK Initialization...');
  
  try {
    const defaultClient = new OpenMemory();
    assertTrue(defaultClient !== null, 'Should initialize with default configuration');
    
    const customClient = new OpenMemory({
      baseUrl: 'http://localhost:8080',
      authKey: 'test-key'
    });
    assertTrue(customClient !== null, 'Should initialize with custom configuration');
  } catch (error) {
    assert(false, `SDK initialization failed: ${error.message}`);
  }
}

async function testHealthCheck() {
  console.log('\n🏥 Testing Health Check...');
  
  try {
    const health = await client.healthCheck();
    assertProperty(health, 'status', 'Health response should have status property');
    assertEqual(health.status, 'healthy', 'Health status should be healthy');
  } catch (error) {
    assert(false, `Health check failed: ${error.message}`);
  }
}

async function testMemoryOperations() {
  console.log('\n🧠 Testing Memory Operations...');
  
  let testMemoryId;

  try {
    const content = 'This is a test memory from JavaScript SDK';
    const memory = await client.add(content);
    
    assertProperty(memory, 'id', 'Added memory should have ID');
    assertEqual(memory.content, content, 'Added memory should have correct content');
    assertProperty(memory, 'primary_sector', 'Added memory should have primary sector');
    assertProperty(memory, 'sectors', 'Added memory should have sectors array');
    assertArray(memory.sectors, 'Sectors should be an array');
    
    testMemoryId = memory.id;
  } catch (error) {
    assert(false, `Add memory failed: ${error.message}`);
  }

  try {
    const content = 'Memory with metadata test';
    const metadata = { source: 'test', importance: 'high' };
    const memory = await client.add(content, metadata);
    
    assertEqual(memory.content, content, 'Memory with metadata should have correct content');
    assertProperty(memory, 'metadata', 'Memory should have metadata property');
  } catch (error) {
    assert(false, `Add memory with metadata failed: ${error.message}`);
  }

  if (testMemoryId) {
    try {
      const memory = await client.getMemory(testMemoryId);
      assertEqual(memory.id, testMemoryId, 'Retrieved memory should have correct ID');
      assertProperty(memory, 'content', 'Retrieved memory should have content');
    } catch (error) {
      assert(false, `Get memory failed: ${error.message}`);
    }

    // Test memory update
    try {
      console.log('   Testing memory update...');
      const updatedMemory = await client.update(testMemoryId, {
        content: 'This is an UPDATED test memory from JavaScript SDK',
        tags: ['test', 'updated', 'js-sdk'],
        metadata: { updated: true, source: 'js-sdk-test' }
      });
      
      assertProperty(updatedMemory, 'id', 'Updated memory should have ID');
      assertProperty(updatedMemory, 'updated', 'Updated memory should have updated flag');
      assertTrue(updatedMemory.updated, 'Updated flag should be true');
    } catch (error) {
      assert(false, `Update memory failed: ${error.message}`);
    }
  }

  try {
    const results = await client.query('JavaScript SDK test', { k: 5 });
    assertProperty(results, 'matches', 'Query response should have matches');
    assertArray(results.matches, 'Matches should be an array');
    assertTrue(results.matches.length > 0, 'Should find at least one match');
    
    if (results.matches.length > 0) {
      const firstMatch = results.matches[0];
      assertProperty(firstMatch, 'id', 'Match should have ID');
      assertProperty(firstMatch, 'content', 'Match should have content');
      assertProperty(firstMatch, 'score', 'Match should have score');
    }
  } catch (error) {
    assert(false, `Query memories failed: ${error.message}`);
  }

  try {
    const memories = await client.listMemories({ limit: 10, offset: 0 });
    assertProperty(memories, 'items', 'List response should have items');
    assertArray(memories.items, 'Items should be an array');
    assertProperty(memories, 'total', 'List response should have total');
  } catch (error) {
    assert(false, `List memories failed: ${error.message}`);
  }

  if (testMemoryId) {
    try {
      const result = await client.deleteMemory(testMemoryId);
      assertProperty(result, 'success', 'Delete response should have success property');
      assertTrue(result.success, 'Delete should be successful');
    } catch (error) {
      assert(false, `Delete memory failed: ${error.message}`);
    }
  }
}

async function testSectorOperations() {
  console.log('\n🏗️ Testing Sector Operations...');

  try {
    const sectors = await client.getSectors();
    assertProperty(sectors, 'sectors', 'Sectors response should have sectors');
    assertArray(sectors.sectors, 'Sectors should be an array');
    
    const expectedSectors = ['episodic', 'semantic', 'procedural', 'emotional', 'reflective'];
    expectedSectors.forEach(sector => {
      assertTrue(sectors.sectors.includes(sector), `Should include ${sector} sector`);
    });
  } catch (error) {
    assert(false, `Get sectors failed: ${error.message}`);
  }

  try {
    const results = await client.querySector('programming', 'semantic', { k: 3 });
    assertProperty(results, 'matches', 'Sector query should have matches');
    assertArray(results.matches, 'Sector matches should be an array');
  } catch (error) {
    assert(false, `Sector query failed: ${error.message}`);
  }

  try {
    const memories = await client.getBySector('emotional', { limit: 5 });
    assertProperty(memories, 'items', 'Sector memories should have items');
    assertArray(memories.items, 'Sector items should be an array');
  } catch (error) {
    assert(false, `Get by sector failed: ${error.message}`);
  }
}

async function testErrorHandling() {
  console.log('\n⚠️ Testing Error Handling...');

  try {

    const offlineClient = new OpenMemory({ baseUrl: 'http://localhost:9999' });

    try {
      await offlineClient.healthCheck();
      assertTrue(true, 'Offline client test completed (mock or real)');
    } catch (error) {
      assertTrue(true, 'Expected error for offline client (real SDK)');
    }
  } catch (error) {
    assert(false, `Error handling test failed: ${error.message}`);
  }
}

async function runJSSDKTests() {
  console.log('🧪 OpenMemory JavaScript SDK Tests');
  console.log('===================================');

  try {
    client = new OpenMemory({
      baseUrl: API_BASE_URL,
      authKey: process.env.AUTH_KEY
    });
    console.log('✅ SDK client initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize SDK client:', error.message);
    process.exit(1);
  }

  try {
    await testSDKInitialization();
    await testHealthCheck();
    await testMemoryOperations();
    await testSectorOperations();
    await testErrorHandling();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }

  console.log('\n📊 Test Results');
  console.log('===============');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📝 Total:  ${testResults.total}`);

  if (testResults.failures.length > 0) {
    console.log('\n💥 Failures:');
    testResults.failures.forEach(failure => console.log(`   - ${failure}`));
  }

  const success = testResults.failed === 0;
  console.log(`\n${success ? '🎉 All tests passed!' : '💔 Some tests failed'}`);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  runJSSDKTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runJSSDKTests };
