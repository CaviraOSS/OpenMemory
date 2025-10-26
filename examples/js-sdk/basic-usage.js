const { OpenMemory, SECTORS } = require('../../sdk-js/src/index.ts')

const client = new OpenMemory({
    baseUrl: 'http://localhost:8080',
    apiKey: '' // Optional - set if your server requires auth
})

async function basicExample() {
    console.log('🧠 OpenMemory JavaScript SDK - Basic Example')
    console.log('============================================')
    
    try {
        // Check server health
        console.log('1. Checking server health...')
        const health = await client.health()
        console.log('✅ Server status:', health)
        
        // Add some memories
        console.log('\n2. Adding memories...')
        const memory1 = await client.add("I went to Paris yesterday and loved the Eiffel Tower")
        console.log(`✅ Memory stored in ${memory1.primary_sector} sector:`, memory1.id)
        
        const memory2 = await client.add("I feel really excited about the new AI project")
        console.log(`✅ Memory stored in ${memory2.primary_sector} sector:`, memory2.id)
        
        const memory3 = await client.add("My morning routine: coffee, then check emails, then code")
        console.log(`✅ Memory stored in ${memory3.primary_sector} sector:`, memory3.id)
        
        // Query memories
        console.log('\n3. Querying memories...')
        const results = await client.query("Paris travel experience", { k: 5 })
        console.log(`✅ Found ${results.matches.length} matching memories:`)
        
        results.matches.forEach((match, i) => {
            console.log(`   ${i+1}. [${match.primary_sector}] ${match.content.substring(0, 50)}...`)
            console.log(`      Score: ${match.score.toFixed(3)}, Salience: ${match.salience.toFixed(3)}`)
        })
        
        // Update a memory
        if (results.matches.length > 0) {
            console.log('\n4. Updating best match...')
            const memoryId = results.matches[0].id
            const originalContent = results.matches[0].content
            console.log(`   Original: ${originalContent.substring(0, 50)}...`)
            
            // Update the memory with new content and tags
            const updatedMemory = await client.update(memoryId, {
                content: "I went to Paris yesterday and absolutely loved the Eiffel Tower - it was even more beautiful than I imagined!",
                tags: ["travel", "paris", "eiffel-tower", "updated"],
                metadata: { updated: true, original_length: originalContent.length }
            })
            console.log(`✅ Memory updated:`, updatedMemory)
        }
        
        // Reinforce a memory
        if (results.matches.length > 0) {
            console.log('\n5. Reinforcing best match...')
            await client.reinforce(results.matches[0].id, 0.2)
            console.log('✅ Memory reinforced')
        }
        
        // Get all memories
        console.log('\n6. Listing all memories...')
        const allMemories = await client.getAll({ limit: 10 })
        console.log(`✅ Total memories: ${allMemories.items.length}`)
        
    } catch (error) {
        console.error('❌ Error:', error.message)
        console.log('Make sure the OpenMemory server is running on port 8080')
    }
}

basicExample()