const BASE_URL = 'http://localhost:8080';
const API_KEY = 'your';
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

function assertEqual(actual, expected, message) {
  assert(actual === expected, message || `Expected ${expected}, got ${actual}`);
}

function assertTrue(condition, message) {
  assert(condition === true, message || 'Expected true');
}

function assertProperty(object, property, message) {
  assert(
    object && object.hasOwnProperty(property),
    message || `Expected object to have property ${property}`,
  );
}

function assertArray(value, message) {
  assert(Array.isArray(value), message || 'Expected array');
}

async function makeRequest(url, options = {}) {
  const http = require('http');
  const https = require('https');

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        Authorization: `Bearer ${API_KEY}`,
      },
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : {},
            ok: res.statusCode >= 200 && res.statusCode < 300,
          });
        } catch (error) {
          resolve({ status: res.statusCode, data: data, ok: false });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function testHealthCheck() {
  console.log('📋 Testing Health Check...');

  try {
    const response = await makeRequest(`${BASE_URL}/health`);
    console.log(
      `   Debug: Response status: ${response.status}, data:`,
      response.data,
    );
    assertEqual(response.status, 200, 'Health check should return 200 status');
    assertProperty(
      response.data,
      'ok',
      'Health response should have ok property',
    );
    assertTrue(response.data.ok, 'Health ok should be true');
    assertProperty(
      response.data,
      'version',
      'Health response should have version',
    );
  } catch (error) {
    assert(false, `Health check failed: ${error.message}`);
  }
}

async function testMemoryOperations() {
  console.log('\n🧠 Testing Memory Operations...');

  let testMemoryId;

  try {
    const testContent = 'This is a test memory for backend API testing';
    const response = await makeRequest(`${BASE_URL}/memory/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: testContent }),
    });

    console.log(
      `   Debug: Add memory response status: ${response.status}, data:`,
      response.data,
    );
    assertEqual(response.status, 200, 'Add memory should return 200 status');
    assertProperty(response.data, 'id', 'Added memory should have ID');
    assertProperty(
      response.data,
      'primary_sector',
      'Added memory should have primary sector',
    );
    assertProperty(
      response.data,
      'sectors',
      'Added memory should have sectors array',
    );
    assertArray(response.data.sectors, 'Sectors should be an array');

    testMemoryId = response.data.id;
  } catch (error) {
    assert(false, `Add memory failed: ${error.message}`);
  }

  try {
    const response = await makeRequest(`${BASE_URL}/memory/all?l=10`);
    assertEqual(response.status, 200, 'List memories should return 200 status');
    assertProperty(response.data, 'items', 'List response should have items');
    assertArray(response.data.items, 'Items should be an array');
  } catch (error) {
    assert(false, `List memories failed: ${error.message}`);
  }

  try {
    const response = await makeRequest(`${BASE_URL}/memory/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test memory', k: 5 }),
    });

    console.log(
      `   Debug: Query response status: ${response.status}, data:`,
      response.data,
    );
    assertEqual(response.status, 200, 'Query should return 200 status');
    assertProperty(
      response.data,
      'matches',
      'Query response should have matches',
    );
    assertArray(response.data.matches, 'Matches should be an array');
    if (response.data.matches) {
      assertTrue(
        response.data.matches.length >= 0,
        'Matches should be a valid array',
      );
    }
  } catch (error) {
    assert(false, `Query memories failed: ${error.message}`);
  }

  // Test memory update before deleting
  if (testMemoryId) {
    try {
      console.log('   Testing memory update...');
      const updateResponse = await makeRequest(
        `${BASE_URL}/memory/${testMemoryId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'This is an UPDATED test memory for backend API testing',
            tags: ['test', 'updated'],
            metadata: { updated: true },
          }),
        },
      );

      assertEqual(
        updateResponse.status,
        200,
        'Update memory should return 200 status',
      );
      assertProperty(
        updateResponse.data,
        'id',
        'Updated memory should have ID',
      );
      assertProperty(
        updateResponse.data,
        'updated',
        'Updated memory should have updated flag',
      );
      assertTrue(updateResponse.data.updated, 'Updated flag should be true');
    } catch (error) {
      assert(false, `Update memory failed: ${error.message}`);
    }
  }

  if (testMemoryId) {
    try {
      const response = await makeRequest(`${BASE_URL}/memory/${testMemoryId}`, {
        method: 'DELETE',
      });
      assertEqual(
        response.status,
        200,
        'Delete memory should return 200 status',
      );
      assertProperty(
        response.data,
        'ok',
        'Delete response should have ok property',
      );
      assertTrue(response.data.ok, 'Delete should be successful');
    } catch (error) {
      assert(false, `Delete memory failed: ${error.message}`);
    }
  }
}

async function testSectorOperations() {
  console.log('\n🏗️ Testing Sector Operations...');

  try {
    const response = await makeRequest(`${BASE_URL}/sectors`);
    assertEqual(response.status, 200, 'Get sectors should return 200 status');
    assertProperty(
      response.data,
      'sectors',
      'Sectors response should have sectors',
    );
    assertArray(response.data.sectors, 'Sectors should be an array');

    const expectedSectors = [
      'episodic',
      'semantic',
      'procedural',
      'emotional',
      'reflective',
    ];
    expectedSectors.forEach((sector) => {
      assertTrue(
        response.data.sectors.includes(sector),
        `Should include ${sector} sector`,
      );
    });
  } catch (error) {
    assert(false, `Get sectors failed: ${error.message}`);
  }
}

async function testErrorHandling() {
  console.log('\n⚠️ Testing Error Handling...');

  try {
    const response = await makeRequest(`${BASE_URL}/memory/invalid-id`);
    assertEqual(response.status, 404, 'Invalid memory ID should return 404');
  } catch (error) {
    assert(false, `Invalid memory ID test failed: ${error.message}`);
  }
}

async function runBackendTests() {
  console.log('🧪 OpenMemory Backend API Tests');
  console.log('================================');

  console.log('🔍 Checking if server is ready...');
  try {
    const response = await makeRequest(`${BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Server not ready: ${response.status}`);
    }
    console.log('✅ Server is ready for testing\n');
  } catch (error) {
    console.error(
      '❌ Server not available. Please start the server first:',
      error.message,
    );
    console.error('   Run: cd backend && npm start');
    process.exit(1);
  }

  try {
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
    testResults.failures.forEach((failure) => console.log(`   - ${failure}`));
  }

  const success = testResults.failed === 0;
  console.log(`\n${success ? '🎉 All tests passed!' : '💔 Some tests failed'}`);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  runBackendTests().catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { runBackendTests };
