const { OpenMemory, SECTORS } = require('@openmemory/SDK/javascript')

const client = new OpenMemory({
    baseUrl: 'http://localhost:8080'
})

async function sectorExample() {
    console.log('🧠 OpenMemory JavaScript SDK - Brain Sectors Example')
    console.log('===================================================')
    
    try {
        // Get sector information
        console.log('1. Getting sector information...')
        const sectors = await client.getSectors()
        console.log('✅ Available sectors:', Object.keys(sectors.sectors))
        console.log('✅ Sector configurations:', sectors.configs)
        
        // Add memories for each sector
        console.log('\n2. Adding memories to different sectors...')
        const testMemories = [
            {
                content: "I went to the coffee shop this morning at 9 AM",
                expectedSector: "episodic"
            },
            {
                content: "Machine learning is a subset of artificial intelligence",
                expectedSector: "semantic"
            },
            {
                content: "First, open the terminal. Then, run npm install.",
                expectedSector: "procedural"
            },
            {
                content: "I feel so excited and happy about this new opportunity!",
                expectedSector: "emotional"
            },
            {
                content: "I wonder what the purpose of all this learning really is",
                expectedSector: "reflective"
            }
        ]
        
        const addedMemories = []
        for (const test of testMemories) {
            const memory = await client.add(test.content)
            addedMemories.push(memory)
            
            const match = memory.primary_sector === test.expectedSector ? '✅' : '❓'
            console.log(`${match} "${test.content}"`)
            console.log(`   Expected: ${test.expectedSector}, Got: ${memory.primary_sector}`)
            console.log(`   All sectors: [${memory.sectors.join(', ')}]`)
        }
        
        // Query specific sectors
        console.log('\n3. Querying specific sectors...')
        
        const episodicResults = await client.querySector("morning coffee", "episodic")
        console.log(`✅ Episodic memories (${episodicResults.matches.length}):`)
        episodicResults.matches.forEach(m => {
            console.log(`   - ${m.content.substring(0, 60)}...`)
        })
        
        const emotionalResults = await client.querySector("excited happy", "emotional")
        console.log(`✅ Emotional memories (${emotionalResults.matches.length}):`)
        emotionalResults.matches.forEach(m => {
            console.log(`   - ${m.content.substring(0, 60)}...`)
        })
        
        // Cross-sector query
        console.log('\n4. Cross-sector query...')
        const crossResults = await client.query("learning and feeling excited", { k: 10 })
        console.log(`✅ Cross-sector results (${crossResults.matches.length}):`)
        crossResults.matches.forEach((match, i) => {
            console.log(`   ${i+1}. [${match.primary_sector}] ${match.content.substring(0, 50)}...`)
            console.log(`      Score: ${match.score.toFixed(3)}, Path: [${match.path.join(' → ')}]`)
        })
        
        // Get memories by sector
        console.log('\n5. Getting memories by sector...')
        const emotionalMemories = await client.getBySector("emotional", 10)
        console.log(`✅ All emotional memories: ${emotionalMemories.items.length}`)
        
    } catch (error) {
        console.error('❌ Error:', error.message)
        console.log('Make sure the OpenMemory server is running on port 8080')
    }
}

sectorExample()