import { OpenMemory } from 'openmemory-sdk';

async function basicExample() {
    console.log('🧠 OpenMemory JavaScript SDK - Basic Example');
    console.log('============================================');
    
    // Initialize with local-first configuration
    const mem = new OpenMemory({
        path: './data/demo.sqlite',
        tier: 'fast',
        embeddings: {
            provider: 'synthetic' // Use 'openai', 'gemini', 'ollama', or 'synthetic'
        }
    });
    
    console.log('✅ OpenMemory initialized (local-first mode)');
    
    // Add some memories
    console.log('\n1. Adding memories...');
    const mem1 = await mem.add("I went to Paris yesterday and loved the Eiffel Tower", {
        tags: ["travel", "paris"],
        metadata: { location: "Paris, France" }
    });
    console.log(`✅ Episodic memory stored: ${mem1.id}`);
    
    const mem2 = await mem.add("I feel really excited about the new AI project", {
        tags: ["emotion", "ai"]
    });
    console.log(`✅ Emotional memory stored: ${mem2.id}`);
    
    const mem3 = await mem.add("My morning routine: coffee, then check emails, then code", {
        tags: ["routine", "procedural"]
    });
    console.log(`✅ Procedural memory stored: ${mem3.id}`);
    
    // Query memories
    console.log('\n2. Querying memories...');
    const results = await mem.query("Paris travel experience", { limit: 5 });
    console.log(`✅ Found ${results.length} matching memories:`);
    
    results.forEach((match, i) => {
        console.log(`   ${i+1}. [score: ${match.score?.toFixed(3)}] ${match.content.substring(0, 50)}...`);
    });
    
    // Get all memories
    console.log('\n3. Listing all memories...');
    const all = await mem.getAll({ limit: 10 });
    console.log(`✅ Total memories: ${all.length}`);
    
    // Delete a memory
    if (results.length > 0) {
        console.log('\n4. Deleting a memory...');
        await mem.delete(results[results.length - 1].id);
        console.log('✅ Memory deleted');
    }
    
    console.log('\n✨ Example completed!');
}

basicExample().catch(console.error);