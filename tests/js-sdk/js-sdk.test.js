import { OpenMemory } from 'openmemory-sdk';
import { promises as fs } from 'fs';
import path from 'path';

const TEST_DB_PATH = './data/test-sdk.sqlite';
let testResults = { passed: 0, failed: 0, total: 0, failures: [] };

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

async function cleanupTestDB() {
  try {
    await fs.unlink(TEST_DB_PATH);
  } catch (error) {
    // File doesn't exist, that's fine
  }
}

async function testSDKInitialization() {
  console.log('📋 Testing SDK Initialization...\n');
  
  // Test 1: Should fail without required config
  try {
    new OpenMemory();
    assert(false, 'Should throw error without required config');
  } catch (error) {
    assert(true, 'Correctly throws error without required config');
  }
  
  // Test 2: Should fail without path
  try {
    new OpenMemory({ tier: 'fast', embeddings: { provider: 'synthetic' } });
    assert(false, 'Should throw error without path');
  } catch (error) {
    assert(error.message.includes('requires "path"'), 'Error message mentions missing path');
  }
  
  // Test 3: Should fail without tier
  try {
    new OpenMemory({ path: TEST_DB_PATH, embeddings: { provider: 'synthetic' } });
    assert(false, 'Should throw error without tier');
  } catch (error) {
    assert(error.message.includes('requires "tier"'), 'Error message mentions missing tier');
  }
  
  // Test 4: Should fail without embeddings
  try {
    new OpenMemory({ path: TEST_DB_PATH, tier: 'fast' });
    assert(false, 'Should throw error without embeddings');
  } catch (error) {
    assert(error.message.includes('embeddings'), 'Error message mentions missing embeddings');
  }
  
  // Test 5: Should initialize with proper config
  try {
    const mem = new OpenMemory({
      path: TEST_DB_PATH,
      tier: 'fast',
      embeddings: { provider: 'synthetic' }
    });
    assert(mem !== null, 'Successfully initializes with proper config');
  } catch (error) {
    assert(false, `Initialization failed: ${error.message}`);
  }
}

async function testMemoryOperations() {
  console.log('\n🧠 Testing Memory Operations...\n');
  
  const mem = new OpenMemory({
    path: TEST_DB_PATH,
    tier: 'fast',
    embeddings: { provider: 'synthetic' }
  });
  
  // Test add
  let mem1, mem2;
  try {
    mem1 = await mem.add("Test memory 1");
    assert(mem1.id !== undefined, 'Add returns memory with ID');
    assert(mem1.content === "Test memory 1", 'Add preserves content');
  } catch (error) {
    assert(false, `Add failed: ${error.message}`);
  }
  
  // Test add with metadata
  try {
    mem2 = await mem.add("Test memory 2", { 
      tags: ["test", "sdk"], 
      metadata: { source: "test" } 
    });
    assert(mem2.id !== undefined, 'Add with metadata returns ID');
  } catch (error) {
    assert(false, `Add with metadata failed: ${error.message}`);
  }
  
  // Test query
  try {
    const results = await mem.query("test memory");
    assert(Array.isArray(results), 'Query returns array');
    assert(results.length > 0, 'Query finds results');
    assert(results[0].content !== undefined, 'Query results have content');
  } catch (error) {
    assert(false, `Query failed: ${error.message}`);
  }
  
  // Test getAll
  try {
    const all = await mem.getAll();
    assert(Array.isArray(all), 'GetAll returns array');
    assert(all.length >= 2, 'GetAll returns all memories');
  } catch (error) {
    assert(false, `GetAll failed: ${error.message}`);
  }
  
  // Test delete
  if (mem1) {
    try {
      await mem.delete(mem1.id);
      const afterDelete = await mem.getAll();
      assert(!afterDelete.find(m => m.id === mem1.id), 'Delete removes memory');
    } catch (error) {
      assert(false, `Delete failed: ${error.message}`);
    }
  }
}

async function testSectorOperations() {
  console.log('\n🏗️ Testing Sector Operations...\n');
  
  const mem = new OpenMemory({
    path: TEST_DB_PATH,
    tier: 'smart',
    embeddings: { provider: 'synthetic' }
  });
  
  // Add memories that should go to different sectors
  const memories = [
    { content: "I went to Paris yesterday", sector: "episodic" },
    { content: "Python is a programming language", sector: "semantic" },
    { content: "To make coffee: add water, heat, brew", sector: "procedural" },
    { content: "I feel really happy today!", sector: "emotional" },
    { content: "I think I'm learning faster now", sector: "reflective" }
  ];
  
  for (const m of memories) {
    try {
      await mem.add(m.content);
    } catch (error) {
      assert(false, `Add ${m.sector} memory failed: ${error.message}`);
    }
  }
  
  // Test getBySector
  const sectors = ['episodic', 'semantic', 'procedural', 'emotional', 'reflective'];
  for (const sector of sectors) {
    try {
      const sectorMems = await mem.getBySector(sector);
      assert(Array.isArray(sectorMems), `getBySector(${sector}) returns array`);
    } catch (error) {
      assert(false, `getBySector(${sector}) failed: ${error.message}`);
    }
  }
}

async function testAdvancedFeatures() {
  console.log('\n⚡ Testing Advanced Features...\n');
  
  // Test with decay configuration
  try {
    const mem = new OpenMemory({
      path: './data/test-advanced.sqlite',
      tier: 'smart',
      embeddings: { provider: 'synthetic' },
      decay: {
        intervalMinutes: 5,
        reinforceOnQuery: true
      },
      compression: {
        enabled: true,
        algorithm: 'semantic'
      }
    });
    assert(mem !== null, 'Initializes with advanced config');
    
    await mem.add("Test with advanced features", { decayLambda: 0.1 });
    assert(true, 'Add with custom decay works');
    
    await fs.unlink('./data/test-advanced.sqlite');
  } catch (error) {
    assert(false, `Advanced features failed: ${error.message}`);
  }
}

async function runTests() {
  console.log('🧪 OpenMemory JavaScript SDK Tests');
  console.log('===================================\n');
  
  await cleanupTestDB();
  
  try {
    await testSDKInitialization();
    await testMemoryOperations();
    await testSectorOperations();
    await testAdvancedFeatures();
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
  
  await cleanupTestDB();
  
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

runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
