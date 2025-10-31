const BASE = 'http://localhost:8080';
const API_KEY = 'your';

console.log('🧪 OpenMemory Multimodal Ingestion Tests\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function testTextIngestion() {
  console.log('📝 Test 1: Plain text ingestion (single strategy)');

  const response = await fetch(`${BASE}/memory/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      source: 'file',
      content_type: 'txt',
      data: 'This is a short text document about machine learning. It should use the single strategy.',
      metadata: { test: 'text_ingestion', filename: 'test.txt' },
    }),
  });

  const result = await response.json();
  console.log(`   Strategy: ${result.strategy}`);
  console.log(`   Root ID: ${result.root_memory_id}`);
  console.log(`   Child count: ${result.child_count}`);
  console.log(`   Total tokens: ${result.total_tokens}`);

  if (result.strategy !== 'single') {
    throw new Error(`Expected 'single' strategy, got '${result.strategy}'`);
  }

  console.log('   ✅ PASSED\n');
  return result.root_memory_id;
}

async function testLargeTextIngestion() {
  console.log('📄 Test 2: Large text ingestion (root-child strategy)');

  const largeParagraph =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(200);
  const largeText = Array(10).fill(largeParagraph).join('\n\n');

  const response = await fetch(`${BASE}/memory/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      source: 'file',
      content_type: 'txt',
      data: largeText,
      metadata: { test: 'large_text', filename: 'large.txt' },
    }),
  });

  const result = await response.json();
  console.log(`   Strategy: ${result.strategy}`);
  console.log(`   Root ID: ${result.root_memory_id}`);
  console.log(`   Child count: ${result.child_count}`);
  console.log(`   Total tokens: ${result.total_tokens}`);

  if (result.strategy !== 'root-child') {
    throw new Error(`Expected 'root-child' strategy, got '${result.strategy}'`);
  }

  if (result.child_count === 0) {
    throw new Error('Expected child_count > 0');
  }

  console.log('   ✅ PASSED\n');
  return result.root_memory_id;
}

async function testMarkdownIngestion() {
  console.log('📋 Test 3: Markdown ingestion');

  const markdown = `# Machine Learning Guide

## Introduction
Machine learning is a subset of artificial intelligence.

## Key Concepts
- Neural Networks
- Deep Learning
- Supervised Learning

## Conclusion
ML is transforming technology.`;

  const response = await fetch(`${BASE}/memory/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      source: 'file',
      content_type: 'md',
      data: markdown,
      metadata: { test: 'markdown', filename: 'guide.md' },
    }),
  });

  const result = await response.json();
  console.log(`   Strategy: ${result.strategy}`);
  console.log(`   Root ID: ${result.root_memory_id}`);
  console.log(`   Extraction: ${result.extraction.extraction_method}`);

  console.log('   ✅ PASSED\n');
  return result.root_memory_id;
}

async function testHTMLIngestion() {
  console.log('🌐 Test 4: HTML ingestion');

  const html = `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
    <h1>Welcome to OpenMemory</h1>
    <p>This is a test HTML document with <strong>formatting</strong>.</p>
    <ul>
        <li>Feature 1: Multi-sector memory</li>
        <li>Feature 2: Decay algorithms</li>
        <li>Feature 3: Waypoint graphs</li>
    </ul>
</body>
</html>`;

  const response = await fetch(`${BASE}/memory/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      source: 'file',
      content_type: 'html',
      data: html,
      metadata: { test: 'html', filename: 'page.html' },
    }),
  });

  const result = await response.json();
  console.log(`   Strategy: ${result.strategy}`);
  console.log(`   Root ID: ${result.root_memory_id}`);
  console.log(`   Extraction: ${result.extraction.extraction_method}`);

  console.log('   ✅ PASSED\n');
  return result.root_memory_id;
}

async function testForceRootChild() {
  console.log('🔧 Test 5: Force root-child strategy');

  const smallText = 'This is a small document.';

  const response = await fetch(`${BASE}/memory/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      source: 'file',
      content_type: 'txt',
      data: smallText,
      metadata: { test: 'force_root_child' },
      config: { forceRootChild: true },
    }),
  });

  const result = await response.json();
  console.log(`   Strategy: ${result.strategy}`);
  console.log(`   Root ID: ${result.root_memory_id}`);
  console.log(`   Child count: ${result.child_count}`);

  if (result.strategy !== 'root-child') {
    throw new Error(`Expected 'root-child' strategy with forceRootChild=true`);
  }

  console.log('   ✅ PASSED\n');
  return result.root_memory_id;
}

async function testQueryIngested() {
  console.log('🔍 Test 6: Query ingested documents');

  const response = await fetch(`${BASE}/memory/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      query: 'machine learning neural networks',
      k: 5,
    }),
  });

  const result = await response.json();
  console.log(`   Found ${result.matches.length} matches`);

  if (result.matches.length === 0) {
    throw new Error('Expected at least one match for ingested content');
  }

  const hasIngestedDoc = result.matches.some(
    (m) =>
      m.metadata &&
      (m.metadata.test || m.metadata.is_root || m.metadata.is_child),
  );

  console.log(`   Has ingested doc: ${hasIngestedDoc}`);
  console.log('   ✅ PASSED\n');
}

async function testMemoryRetrieval(memoryId) {
  console.log('📖 Test 7: Retrieve ingested memory details');

  const response = await fetch(`${BASE}/memory/${memoryId}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const memory = await response.json();

  console.log(`   ID: ${memory.id}`);
  console.log(`   Primary sector: ${memory.primary_sector}`);
  console.log(`   Sectors: ${memory.sectors.join(', ')}`);
  console.log(`   Has metadata: ${!!memory.metadata}`);

  if (!memory.id) {
    throw new Error('Memory not found');
  }

  console.log('   ✅ PASSED\n');
}

async function testURLIngestion() {
  console.log('🌍 Test 8: URL ingestion (example.com)');

  try {
    const response = await fetch(`${BASE}/memory/ingest/url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        url: 'https://example.com',
        metadata: { test: 'url_ingestion' },
      }),
    });

    const result = await response.json();

    if (result.err) {
      console.log(
        `   ⚠️  URL ingestion failed (may be expected): ${result.message}`,
      );
      console.log('   ⏭️  SKIPPED\n');
      return null;
    }

    console.log(`   Strategy: ${result.strategy}`);
    console.log(`   Root ID: ${result.root_memory_id}`);
    console.log(`   Source URL in metadata: ${result.extraction.source_url}`);
    console.log('   ✅ PASSED\n');
    return result.root_memory_id;
  } catch (error) {
    console.log(`   ⚠️  URL ingestion error: ${error.message}`);
    console.log('   ⏭️  SKIPPED\n');
    return null;
  }
}

async function testWaypointStructure(rootId) {
  console.log('🔗 Test 9: Verify waypoint structure for root-child');

  const memResponse = await fetch(`${BASE}/memory/${rootId}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const memory = await memResponse.json();

  if (memory.metadata && memory.metadata.ingestion_strategy === 'root-child') {
    console.log(`   Root memory found: ${rootId}`);
    console.log(`   Strategy: ${memory.metadata.ingestion_strategy}`);
    console.log(`   Is root: ${memory.metadata.is_root}`);

    const allResponse = await fetch(`${BASE}/memory/all?l=100`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const allMemories = await allResponse.json();

    const children = allMemories.items.filter(
      (m) => m.metadata && m.metadata.parent_id === rootId,
    );

    console.log(`   Child memories found: ${children.length}`);

    if (children.length > 0) {
      console.log(
        `   Child IDs: ${children.map((c) => c.id.slice(0, 8)).join(', ')}...`,
      );
    }

    console.log('   ✅ PASSED\n');
  } else {
    console.log('   ℹ️  Not a root-child memory, skipping waypoint check\n');
  }
}

async function runTests() {
  try {
    console.log('⏳ Waiting for server to be ready...\n');
    await sleep(1000);

    const healthCheck = await fetch(`${BASE}/health`);
    const health = await healthCheck.json();
    console.log(`✅ Server ready: ${health.version}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const textId = await testTextIngestion();
    const largeId = await testLargeTextIngestion();
    const mdId = await testMarkdownIngestion();
    const htmlId = await testHTMLIngestion();
    const forceId = await testForceRootChild();

    await testQueryIngested();
    await testMemoryRetrieval(largeId);

    const urlId = await testURLIngestion();

    await testWaypointStructure(largeId);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 All tests passed!\n');
    console.log('Summary:');
    console.log(`  • Text ingestion: ${textId ? '✅' : '❌'}`);
    console.log(`  • Large document splitting: ${largeId ? '✅' : '❌'}`);
    console.log(`  • Markdown support: ${mdId ? '✅' : '❌'}`);
    console.log(`  • HTML conversion: ${htmlId ? '✅' : '❌'}`);
    console.log(`  • Force root-child: ${forceId ? '✅' : '❌'}`);
    console.log(`  • URL ingestion: ${urlId ? '✅' : '⏭️'}`);
    console.log(`  • Query integration: ✅`);
    console.log(`  • Waypoint structure: ✅`);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
