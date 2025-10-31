const BASE_URL = 'http://localhost:8080';
const API_KEY = 'your';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const post = (url, body) =>
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  }).then(async (r) => {
    const txt = await r.text();
    console.log(
      `POST ${url} status=${r.status}, body=${txt.substring(0, 200)}`,
    );
    return JSON.parse(txt);
  });
const get = (url) =>
  fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  }).then(async (r) => {
    const txt = await r.text();
    if (r.status !== 200)
      console.log(
        `GET ${url} status=${r.status}, body=${txt.substring(0, 200)}`,
      );
    return JSON.parse(txt);
  });
const del = (url) =>
  fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

async function testDecayAndReflection() {
  console.log('🧪 Testing Decay & Reflection Systems\n');

  try {
    // 1. Create test memories
    console.log('📝 Creating test memories...');
    const mems = [];

    for (let i = 0; i < 25; i++) {
      const res = await post(`${BASE_URL}/memory/add`, {
        content: `Test memory ${i}: This is about ${
          i % 3 === 0 ? 'coding' : i % 3 === 1 ? 'debugging' : 'testing'
        } patterns`,
        primary_sector:
          i % 4 === 0
            ? 'episodic'
            : i % 4 === 1
            ? 'semantic'
            : i % 4 === 2
            ? 'procedural'
            : 'emotional',
        metadata: { test: true, batch: 'decay-reflection' },
      });
      mems.push(res.id);
    }
    console.log(`✅ Created ${mems.length} memories\n`);

    // 2. Check initial salience
    console.log('📊 Initial salience values:');
    for (let i = 0; i < 3; i++) {
      const m = await get(`${BASE_URL}/memory/${mems[i]}`);
      console.log(`  Memory ${i}:`, m);
      if (m.salience !== undefined && m.recency !== undefined) {
        console.log(
          `    salience=${m.salience.toFixed(3)}, recency=${m.recency.toFixed(
            3,
          )}`,
        );
      }
    }
    console.log();

    // 3. Wait for decay (10 seconds interval)
    console.log('⏳ Waiting 15 seconds for decay to run...');
    await wait(15000);

    // 4. Check post-decay salience
    console.log('📉 Post-decay salience values:');
    for (let i = 0; i < 3; i++) {
      const m = await get(`${BASE_URL}/memory/${mems[i]}`);
      if (m.salience !== undefined && m.recency !== undefined) {
        console.log(
          `  Memory ${i}: salience=${m.salience.toFixed(
            3,
          )}, recency=${m.recency.toFixed(3)}`,
        );
      }
    }
    console.log();

    // 5. Wait for reflection (10 seconds interval)
    console.log('⏳ Waiting 15 more seconds for reflection to run...');
    await wait(15000);

    // 6. Check for reflective memories
    console.log('🔍 Checking for reflective memories...');
    const reflections = await get(
      `${BASE_URL}/memory/all?sector=reflective&l=10`,
    );

    console.log(`✅ Found ${reflections.items?.length || 0} reflections`);
    if (reflections.items?.length > 0) {
      reflections.items.forEach((r, i) => {
        console.log(`\n  Reflection ${i + 1}:`);
        console.log(`    Content: ${r.content?.substring(0, 80)}...`);
        console.log(`    Salience: ${r.salience?.toFixed(3) || 'N/A'}`);
        console.log(`    Tags: ${r.tags?.join(', ') || 'none'}`);
        console.log(`    Sources: ${r.metadata?.sources?.length || 0}`);
      });
    }
    console.log();

    // 7. Check if sources marked consolidated
    if (reflections.items?.length > 0) {
      const src = reflections.items[0].metadata?.sources?.[0];
      if (src) {
        const srcMem = await get(`${BASE_URL}/memory/${src}`);
        console.log('🔗 Source memory consolidation status:');
        console.log(`  ID: ${src}`);
        console.log(
          `  Consolidated: ${srcMem.metadata?.consolidated || false}`,
        );
        console.log(
          `  Salience (boosted): ${srcMem.salience?.toFixed(3) || 'N/A'}`,
        );
      }
    }
    console.log();

    // 8. Cleanup
    console.log('🧹 Cleaning up test memories...');
    for (const id of mems) {
      try {
        await del(`${BASE_URL}/memory/${id}`);
      } catch (e) {
        // ignore if already pruned
      }
    }

    console.log('✅ Test complete!\n');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

// Run test
testDecayAndReflection();
