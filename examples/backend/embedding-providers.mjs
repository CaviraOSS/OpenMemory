async function embeddingProviderExamples() {
  const baseUrl = 'http://localhost:8080';

  console.log('🧠 OpenMemory Embedding Providers Example');
  console.log('==========================================');

  try {
    console.log('1. Check current embedding provider...');
    const health = await fetch(`${baseUrl}/health`);
    const healthData = await health.json();
    console.log('Current provider:', healthData.embedding.provider);
    console.log('Configuration:', healthData.embedding);

    const examples = [
      {
        content: 'I went to the grocery store this morning',
        expectedSector: 'episodic',
      },
      {
        content: 'Machine learning is a subset of artificial intelligence',
        expectedSector: 'semantic',
      },
      {
        content: 'First, open the app. Then, click on settings.',
        expectedSector: 'procedural',
      },
      {
        content: 'I feel so excited about this new project!',
        expectedSector: 'emotional',
      },
      {
        content: 'I wonder what the meaning of life really is',
        expectedSector: 'reflective',
      },
    ];

    console.log('\n2. Testing sector classification with different content...');
    for (const example of examples) {
      const response = await fetch(`${baseUrl}/memory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: example.content,
        }),
      });
      const result = await response.json();

      const match =
        result.primary_sector === example.expectedSector ? '✅' : '❓';
      console.log(`${match} "${example.content}"`);
      console.log(
        `   Expected: ${example.expectedSector}, Got: ${result.primary_sector}`,
      );
      console.log(`   All sectors: [${result.sectors.join(', ')}]`);
    }

    console.log('\n3. Testing cross-sector queries...');
    const queryResponse = await fetch(`${baseUrl}/memory/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'how do I feel about learning',
        k: 5,
      }),
    });
    const queryResults = await queryResponse.json();

    console.log('Cross-sector query results:');
    queryResults.matches.forEach((match, i) => {
      console.log(
        `${i + 1}. [${match.primary_sector}] ${match.content.substring(
          0,
          50,
        )}...`,
      );
      console.log(
        `   Score: ${match.score.toFixed(3)}, Path: [${match.path.join(
          ' → ',
        )}]`,
      );
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('Make sure the OpenMemory server is running on port 8080');
  }
}

embeddingProviderExamples();
