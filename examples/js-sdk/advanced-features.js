const { OpenMemory } = require('@openmemory/SDK/javascript')

const client = new OpenMemory({
    baseUrl: 'http://localhost:8080'
})

async function advancedExample() {
    console.log('🧠 OpenMemory JavaScript SDK - Advanced Features')
    console.log('================================================')
    
    try {
        // Add rich memories with metadata and tags
        console.log('1. Adding rich memories with metadata...')
        
        const projectMemory = await client.add("Started working on the OpenMemory project", {
            tags: ["work", "project", "ai", "memory"],
            metadata: {
                project: "OpenMemory",
                priority: "high",
                category: "development",
                deadline: "2025-11-01",
                team_size: 3
            }
        })
        console.log('✅ Project memory added:', projectMemory.id)
        
        const learningMemory = await client.add("Learned about vector databases and embeddings", {
            tags: ["learning", "technology", "databases", "ai"],
            metadata: {
                source: "documentation",
                difficulty: "intermediate",
                time_spent: "2 hours",
                completion: 0.8
            }
        })
        console.log('✅ Learning memory added:', learningMemory.id)
        
        // Test memory reinforcement
        console.log('\n2. Testing memory reinforcement...')
        const beforeReinforce = await client.query("OpenMemory project", { k: 1 })
        console.log('Before reinforcement salience:', beforeReinforce.matches[0]?.salience)
        
        await client.reinforce(projectMemory.id, 0.3)
        
        const afterReinforce = await client.query("OpenMemory project", { k: 1 })
        console.log('After reinforcement salience:', afterReinforce.matches[0]?.salience)
        
        // Filtered queries
        console.log('\n3. Filtered queries...')
        
        // Query with minimum score filter
        const highScoreResults = await client.query("learning technology", {
            k: 10,
            filters: { min_score: 0.5 }
        })
        console.log(`✅ High-score results: ${highScoreResults.matches.length}`)
        
        // Query specific sector
        const semanticResults = await client.query("vector databases", {
            k: 5,
            filters: { sector: "semantic" }
        })
        console.log(`✅ Semantic sector results: ${semanticResults.matches.length}`)
        
        // Complex memory operations
        console.log('\n4. Memory lifecycle operations...')
        
        // Add temporary memory
        const tempMemory = await client.add("This is a temporary memory for testing deletion")
        console.log('✅ Temporary memory added:', tempMemory.id)
        
        // Verify it exists
        const beforeDelete = await client.query("temporary memory", { k: 10 })
        const found = beforeDelete.matches.find(m => m.id === tempMemory.id)
        console.log('Memory found before deletion:', !!found)
        
        // Delete the memory
        await client.delete(tempMemory.id)
        console.log('✅ Memory deleted')
        
        // Verify it's gone
        const afterDelete = await client.query("temporary memory", { k: 10 })
        const stillFound = afterDelete.matches.find(m => m.id === tempMemory.id)
        console.log('Memory found after deletion:', !!stillFound)
        
        // Batch operations
        console.log('\n5. Batch memory addition...')
        const batchMemories = [
            "Read an interesting article about quantum computing",
            "Had lunch with colleagues at the new restaurant",
            "Completed the code review for the authentication module",
            "Feeling optimistic about the project's progress",
            "Reflected on the importance of good documentation"
        ]
        
        const addedBatch = []
        for (const content of batchMemories) {
            const memory = await client.add(content, {
                tags: ["batch", "example"],
                metadata: { batch_id: Date.now() }
            })
            addedBatch.push(memory)
        }
        console.log(`✅ Added ${addedBatch.length} memories in batch`)
        
        // Sector distribution analysis
        console.log('\n6. Analyzing sector distribution...')
        const sectorCount = {}
        addedBatch.forEach(memory => {
            sectorCount[memory.primary_sector] = (sectorCount[memory.primary_sector] || 0) + 1
        })
        
        console.log('Sector distribution:')
        Object.entries(sectorCount).forEach(([sector, count]) => {
            console.log(`   ${sector}: ${count} memories`)
        })
        
    } catch (error) {
        console.error('❌ Error:', error.message)
        console.log('Make sure the OpenMemory server is running on port 8080')
    }
}

advancedExample()