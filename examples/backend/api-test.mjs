async function testBackendAPI() {
  const baseUrl = 'http://localhost:8080';

  console.log('🧠 Testing OpenMemory Backend API');
  console.log('=================================');

  try {
    console.log('1. Health Check...');
    const health = await fetch(`${baseUrl}/health`);
    const healthData = await health.json();
    console.log('✅ Health:', healthData);

    console.log('\n2. Get Sectors...');
    const sectors = await fetch(`${baseUrl}/sectors`);
    const sectorsData = await sectors.json();
    console.log('✅ Sectors:', sectorsData.sectors);

    console.log('\n3. Add Memory...');
    const addResponse = await fetch(`${baseUrl}/memory/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'I went to Paris yesterday and saw the Eiffel Tower',
        tags: ['travel', 'paris'],
        metadata: { trip: 'vacation' },
      }),
    });
    const memory = await addResponse.json();
    console.log('✅ Added memory:', memory);

    console.log('\n4. Query Memory...');
    const queryResponse = await fetch(`${baseUrl}/memory/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Paris travel',
        k: 5,
      }),
    });
    const results = await queryResponse.json();
    console.log('✅ Query results:', results.matches.length, 'matches');

    if (results.matches.length > 0) {
      console.log('\n5. Update Memory (content only)...');
      const updateResponse = await fetch(
        `${baseUrl}/memory/${results.matches[0].id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content:
              'I went to Paris yesterday and absolutely loved the Eiffel Tower - it was even more beautiful than I imagined!',
          }),
        },
      );
      const updateResult = await updateResponse.json();
      console.log('✅ Updated:', updateResult);

      console.log('\n6. Verify Update...');
      const getResponse = await fetch(
        `${baseUrl}/memory/${results.matches[0].id}`,
      );
      const updatedMemory = await getResponse.json();
      console.log(
        '✅ Updated memory content:',
        updatedMemory.content.substring(0, 50) + '...',
      );
      console.log('✅ Updated tags:', updatedMemory.tags);
      console.log('✅ Updated metadata:', updatedMemory.metadata);
      console.log('✅ Version:', updatedMemory.version);
    }

    if (results.matches.length > 0) {
      console.log('\n7. Reinforce Memory...');
      const reinforceResponse = await fetch(`${baseUrl}/memory/reinforce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: results.matches[0].id,
          boost: 0.2,
        }),
      });
      const reinforceResult = await reinforceResponse.json();
      console.log('✅ Reinforced:', reinforceResult);
    }

    console.log('\n8. List All Memories...');
    const allResponse = await fetch(`${baseUrl}/memory/all?l=10`);
    const allMemories = await allResponse.json();
    console.log('✅ Total memories:', allMemories.items.length);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('Make sure the OpenMemory server is running on port 8080');
  }
}

testBackendAPI();
