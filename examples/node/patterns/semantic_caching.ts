
import { Memory } from 'openmemory-js';
import crypto from 'crypto';

// ==================================================================================
// SEMANTIC CACHING PATTERN
// ==================================================================================
// Using OpenMemory as a semantic cache for expensive LLM calls.
// Instead of exact string matching (Redis), we use semantic similarity.
// strong similarity (>0.95) = Cache Hit.
// ==================================================================================

class SemanticCache {
    private mem: Memory;
    private userId: string = "system_semantic_cache";

    constructor() {
        this.mem = new Memory();
    }

    private mockLLMCall(prompt: string): string {
        return `[LLM GENERATED] Response to: "${prompt}" (Computed at ${Date.now()})`;
    }

    async generate(prompt: string): Promise<string> {
        console.log(`\nInput: "${prompt}"`);

        // 1. Search for similar prompts
        // We store content as `PROMPT: <prompt> | RESPONSE: <response>`
        // So we search for the prompt part.
        const hits = await this.mem.search(`PROMPT: ${prompt}`, {
            user_id: this.userId,
            limit: 1
        });

        // 2. Check similarity threshold
        // Note: Real OpenMemory score is cosine similarity (0-1) or distance.
        // Assuming the SDK returns a 'score' field.
        const best = hits[0];
        if (best && best.score > 0.95) {
            console.log(` ✅ Cache HIT (Score: ${best.score.toFixed(4)})`);
            // Parse response from stored format
            const cachedContent = best.content.split("| RESPONSE:")[1];
            return cachedContent.trim();
        }

        console.log(` ❌ Cache MISS. Calling LLM...`);
        const response = this.mockLLMCall(prompt);

        // 3. Store new pair
        await this.mem.add(`PROMPT: ${prompt} | RESPONSE: ${response}`, {
            user_id: this.userId,
            metadata: { type: 'cache_entry' }
        });

        return response;
    }
}

async function main() {
    const cache = new SemanticCache();

    // First call
    await cache.generate("Explain black holes concisely");

    // Exact repeat
    await cache.generate("Explain black holes concisely");

    // Semantic repeat (different wording, same meaning)
    // Should hit if embedding model is good
    await cache.generate("Give me a short explanation of black holes");
}

main().catch(console.error);
