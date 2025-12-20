
import { Memory } from 'openmemory-js';

// ==================================================================================
// RESEARCH ASSISTANT AGENT
// ==================================================================================
// Simulates an agent that performs a research loop:
// 1. Receives a topic.
// 2. Checks memory for existing knowledge.
// 3. "Searches" (simulated) if knowledge is missing.
// 4. Synthesizes and stores result.
// ==================================================================================

class ResearchAgent {
    private mem: Memory;
    private id: string;

    constructor() {
        this.mem = new Memory();
        this.id = "agent_researcher_v1";
    }

    private async simulatedWebSearch(query: string): Promise<string> {
        console.log(`   [WEB] Searching for "${query}"...`);
        return `Web results for ${query}: detailed info about ${query} including facts X, Y, and Z.`;
    }

    async research(topic: string) {
        console.log(`\n🤖 Agent: Researching "${topic}"...`);

        // 1. Check Memory
        console.log("   [MEM] Checking existing knowledge...");
        const existing = await this.mem.search(topic, { user_id: this.id, limit: 1, minSalience: 0.8 });

        if (existing.length > 0) {
            console.log(`   [MEM] Found relevant info!`);
            console.log(`   📝 Recall: ${existing[0].content}`);
            return existing[0].content;
        }

        // 2. If missing, Search Web
        console.log("   [MEM] No sufficient info found. Searching external sources...");
        const webData = await this.simulatedWebSearch(topic);

        // 3. Store new knowledge
        console.log("   [MEM] Storing new findings...");
        await this.mem.add(webData, {
            user_id: this.id,
            metadata: { source: 'web_search', query: topic },
            tags: ['knowledge', 'research']
        });

        return webData;
    }
}

async function run() {
    const agent = new ResearchAgent();

    // First run: Needs to search web
    await agent.research("Quantum Computing History");

    // Second run: Should recall from memory
    await agent.research("Quantum Computing History");
}

run().catch(console.error);
