import { OpenMemory, SECTORS } from './index'
const client = new OpenMemory({
    baseUrl: 'http://localhost:8080',
    apiKey: 'your-api-key' // Optional
})
async function basicOperations() {
    console.log('ðŸ§  Basic Memory Operations')
    const health = await client.health()
    console.log('Health:', health)
    const memory1 = await client.add("I went to Paris yesterday and loved the Eiffel Tower")
    console.log(`Memory stored in ${memory1.primary_sector} sector (${memory1.sectors.join(', ')}):`, memory1.id)
    const memory2 = await client.add("I feel really excited about the new AI project")
    console.log(`Memory stored in ${memory2.primary_sector} sector (${memory2.sectors.join(', ')}):`, memory2.id)
    const memory3 = await client.add("My morning routine: coffee, then check emails, then code")
    console.log(`Memory stored in ${memory3.primary_sector} sector (${memory3.sectors.join(', ')}):`, memory3.id)
    const results = await client.query("Paris travel experience", { k: 3 })
    console.log('Query results:', results.matches.length, 'matches')
    if (results.matches.length > 0) {
        await client.reinforce(results.matches[0].id, 0.3)
        console.log('Reinforced memory:', results.matches[0].id)
    }
}
async function sectorOperations() {
    console.log('ðŸ§  Brain Sector Operations')
    const sectors = await client.getSectors()
    console.log('Available sectors:', Object.keys(sectors.sectors))
    console.log('Sector statistics:', sectors.stats)
    const emotionalMemories = await client.querySector("happiness and joy", "emotional")
    console.log('Emotional memories:', emotionalMemories.matches.length)
    const proceduralMemories = await client.querySector("morning routine", "procedural")
    console.log('Procedural memories:', proceduralMemories.matches.length)
    const episodicMemories = await client.querySector("yesterday events", "episodic")
    console.log('Episodic memories:', episodicMemories.matches.length)
    const allEmotions = await client.getBySector("emotional", 50)
    console.log('All emotional memories:', allEmotions.items.length)
}
async function advancedOperations() {
    console.log('ðŸ§  Advanced Operations')
    const richMemory = await client.add("Learned about vector databases today", {
        tags: ["learning", "technology", "databases"],
        metadata: {
            source: "documentation",
            difficulty: "intermediate",
            category: "technical",
            importance: 'high',
            timestamp: Date.now()
        }
    })
    console.log('Rich memory added:', richMemory)
    const filteredResults = await client.query("database technology", {
        k: 10,
        filters: {
            tags: ["technology"],
            min_score: 0.6,
            sector: "semantic"
        }
    })
    console.log('Filtered results:', filteredResults.matches.length)
    const page1 = await client.getAll({ limit: 20, offset: 0 })
    const page2 = await client.getAll({ limit: 20, offset: 20 })
    console.log('Page 1:', page1.items.length, 'Page 2:', page2.items.length)
}
async function sectorClassificationExamples() {
    console.log('ðŸ§  Sector Classification Examples')
    const examples = [
        {
            content: "I went to the movies last Friday with Sarah",
            expectedSector: "episodic" // Events with temporal context
        },
        {
            content: "The capital of France is Paris",
            expectedSector: "semantic" // Facts and knowledge
        },
        {
            content: "I always drink coffee before checking emails",
            expectedSector: "procedural" // Habits and routines
        },
        {
            content: "I felt overwhelmed by the deadline pressure",
            expectedSector: "emotional" // Emotions and feelings
        },
        {
            content: "Analysis: my productivity peaks in the morning",
            expectedSector: "reflective" // Meta-cognitive thoughts
        }
    ]
    for (const example of examples) {
        const result = await client.add(example.content)
        console.log(`"${example.content}"`)
        console.log(`Expected: ${example.expectedSector}, Actual: ${result.primary_sector}`)
        console.log('---')
    }
}
async function monitoringOperations() {
    console.log('ðŸ§  Memory Statistics')
    const stats = await client.getStats()
    console.log('Brain Sector Analysis:')
    stats.stats.forEach(stat => {
        const sectorInfo = SECTORS[stat.sector as keyof typeof SECTORS]
        console.log(`${stat.sector.toUpperCase()}:`)
        console.log(`  - Count: ${stat.count} memories`)
        console.log(`  - Average Salience: ${stat.avg_salience.toFixed(3)}`)
        console.log(`  - Decay Rate: ${sectorInfo.decay_lambda}`)
        console.log(`  - Description: ${sectorInfo.description}`)
        console.log()
    })
}
async function errorHandlingExample() {
    console.log('ðŸ§  Error Handling')
    try {
        await client.health()
    } catch (error) {
        console.error('Health check failed:', error)
    }
    try {
        await client.query("")
    } catch (error) {
        console.error('Empty query failed:', error)
    }
    try {
        await client.delete("non-existent-id")
    } catch (error) {
        console.error('Delete failed:', error)
    }
}
async function runExamples() {
    try {
        await basicOperations()
        console.log('\n' + '='.repeat(50) + '\n')
        await sectorOperations()
        console.log('\n' + '='.repeat(50) + '\n')
        await advancedOperations()
        console.log('\n' + '='.repeat(50) + '\n')
        await sectorClassificationExamples()
        console.log('\n' + '='.repeat(50) + '\n')
        await monitoringOperations()
        console.log('\n' + '='.repeat(50) + '\n')
        await errorHandlingExample()
        console.log('ðŸŽ‰ All examples completed!')
    } catch (error) {
        console.error('Example failed:', error)
    }
}
export {
    basicOperations,
    sectorOperations,
    advancedOperations,
    sectorClassificationExamples,
    monitoringOperations,
    errorHandlingExample,
    runExamples
}
if (require.main === module) {
    runExamples()
}