import { OpenMemory } from 'openmemory-sdk';

async function sectorExample() {
    console.log('🧠 OpenMemory JavaScript SDK - Brain Sectors');
    console.log('==========================================');
    
    const mem = new OpenMemory({
        path: './data/sectors-demo.sqlite',
        tier: 'smart',
        embeddings: {
            provider: 'synthetic'
        }
    });
    
    console.log('✅ OpenMemory initialized\n');
    
    // Demonstrate each sector
    console.log('📝 Adding memories to different sectors...\n');
    
    // 1. Episodic (Events & Experiences)
    console.log('1️⃣  EPISODIC SECTOR (Events & Experiences)');
    await mem.add("Last Tuesday I attended a conference on AI safety in San Francisco", {
        tags: ["event", "conference", "ai"],
        metadata: { date: "2024-01-15", location: "San Francisco" }
    });
    await mem.add("I remember the first time I wrote a recursive function - it was confusing but exciting");
    console.log('   ✅ Time-bound experiences stored\n');
    
    // 2. Semantic (Facts & Knowledge)
    console.log('2️⃣  SEMANTIC SECTOR (Facts & Knowledge)');
    await mem.add("Python is an interpreted, high-level programming language known for readability", {
        tags: ["programming", "python", "facts"]
    });
    await mem.add("The mitochondria is the powerhouse of the cell", {
        tags: ["biology", "facts"]
    });
    console.log('   ✅ Timeless facts stored\n');
    
    // 3. Procedural (Skills & How-to)
    console.log('3️⃣  PROCEDURAL SECTOR (Skills & How-to)');
    await mem.add("To deploy to production: 1) Run tests, 2) Build Docker image, 3) Push to registry, 4) Update k8s manifests", {
        tags: ["devops", "procedure"]
    });
    await mem.add("When debugging, always check: logs, network tab, console errors, and stack traces", {
        tags: ["debugging", "procedure"]
    });
    console.log('   ✅ Procedures stored\n');
    
    // 4. Emotional (Feelings & Sentiment)
    console.log('4️⃣  EMOTIONAL SECTOR (Feelings & Sentiment)');
    await mem.add("I'm extremely proud of finishing that complex algorithm! 🎉", {
        tags: ["emotion", "achievement"]
    });
    await mem.add("Feeling a bit anxious about the upcoming presentation tomorrow", {
        tags: ["emotion", "anxiety"]
    });
    console.log('   ✅ Emotional states stored\n');
    
    // 5. Reflective (Meta-cognition & Insights)
    console.log('5️⃣  REFLECTIVE SECTOR (Meta-cognition & Insights)');
    await mem.add("I notice I learn best when I can practice concepts immediately after learning them", {
        tags: ["reflection", "learning"]
    });
    await mem.add("Looking back, I realize my coding style has evolved to prioritize readability over cleverness", {
        tags: ["reflection", "growth"]
    });
    console.log('   ✅ Reflections stored\n');
    
    // Query across sectors
    console.log('🔍 Querying across sectors...');
    const results = await mem.query("learning and programming");
    console.log(`\n✅ Found ${results.length} memories across sectors:`);
    results.forEach((r, i) => {
        console.log(`   ${i+1}. ${r.content.substring(0, 70)}...`);
    });
    
    // Get memories by sector
    console.log('\n📊 Memories per sector:');
    const sectors = ['episodic', 'semantic', 'procedural', 'emotional', 'reflective'];
    for (const sector of sectors) {
        const sectorMems = await mem.getBySector(sector);
        console.log(`   ${sector.padEnd(12)}: ${sectorMems.length} memories`);
    }
    
    console.log('\n✨ Sector demonstration complete!');
}

sectorExample().catch(console.error);