import { OpenMemory } from 'openmemory-sdk';

async function advancedExample() {
    console.log('🧠 OpenMemory JavaScript SDK - Advanced Features');
    console.log('===============================================');
    
    // Initialize with advanced configuration
    const mem = new OpenMemory({
        path: './data/advanced-demo.sqlite',
        tier: 'smart', // 'fast' | 'smart' | 'deep' | 'hybrid'
        embeddings: {
            provider: 'synthetic',
            mode: 'advanced',
            dimensions: 768
        },
        decay: {
            intervalMinutes: 5,
            reinforceOnQuery: true,
            coldThreshold: 0.1
        },
        compression: {
            enabled: true,
            algorithm: 'semantic',
            minLength: 100
        },
        reflection: {
            enabled: true,
            intervalMinutes: 10,
            minMemories: 5
        }
    });
    
    console.log('✅ OpenMemory initialized with advanced features');
    
    // Multi-sector memories
    console.log('\n1. Adding multi-sector memories...');
    
    await mem.add("Yesterday I learned how to implement binary search trees while feeling slightly frustrated", {
        tags: ["learning", "coding", "emotion"],
        metadata: { difficulty: "medium", mood: "frustrated" }
    });
    
    await mem.add("The capital of France is Paris, located on the Seine river", {
        tags: ["geography", "facts"],
        metadata: { type: "factual" }
    });
    
    await mem.add("To make coffee: 1) Heat water to 200°F, 2) Add 2 tbsp grounds, 3) Pour slowly", {
        tags: ["coffee", "procedure"],
        metadata: { category: "cooking" }
    });
    
    await mem.add("I'm thinking about why certain algorithms are more efficient than others", {
        tags: ["reflection", "metacognition"],
        metadata: { type: "reflective" }
    });
    
    console.log('✅ Added 4 memories across different sectors');
    
    // Cross-sector query
    console.log('\n2. Cross-sector query...');
    const results = await mem.query("learning and emotions", { limit: 3 });
    console.log(`✅ Found ${results.length} cross-sector matches`);
    results.forEach((r, i) => {
        console.log(`   ${i+1}. ${r.content.substring(0, 60)}...`);
    });
    
    // Sector-specific query
    console.log('\n3. Sector-specific queries...');
    const procedural = await mem.getBySector('procedural', { limit: 5 });
    console.log(`✅ Procedural memories: ${procedural.length}`);
    
    const semantic = await mem.getBySector('semantic', { limit: 5 });
    console.log(`✅ Semantic memories: ${semantic.length}`);
    
    // Memory with custom decay
    console.log('\n4. Adding memory with custom decay...');
    await mem.add("This is a short-lived thought", {
        decayLambda: 0.5, // Fast decay
        metadata: { temporary: true }
    });
    console.log('✅ Memory added with fast decay');
    
    // Bulk operations
    console.log('\n5. Bulk adding memories...');
    const memories = [
        "Machine learning is transforming healthcare",
        "I enjoy hiking in the mountains on weekends",
        "Quantum computing uses qubits instead of classical bits"
    ];
    
    for (const content of memories) {
        await mem.add(content);
    }
    console.log(`✅ Added ${memories.length} memories in bulk`);
    
    // Get statistics
    console.log('\n6. Memory statistics...');
    const all = await mem.getAll();
    console.log(`✅ Total memories: ${all.length}`);
    
    console.log('\n✨ Advanced features demonstrated!');
}

advancedExample().catch(console.error);