
import { Memory } from 'openmemory-js';

// ==================================================================================
// USER PROFILING PATTERN
// ==================================================================================
// Building a dynamic user profile by extracting and aggregating facts.
// We treat the "profile" as a set of persistent memories tagged 'trait' or 'preference'.
// ==================================================================================

class UserProfiler {
    private mem: Memory;

    constructor() {
        this.mem = new Memory();
    }

    async extractTraits(userId: string, message: string) {
        // Simple heuristic extraction (in prod use an extraction chain)
        if (message.includes("I like")) {
            const preference = message.split("I like")[1].trim();
            console.log(`   -> Extracted preference: ${preference}`);

            await this.mem.add(`Preference: ${preference}`, {
                user_id: userId,
                metadata: { type: 'profile_trait', category: 'preference' },
                tags: ['profile', 'preference']
            });
        }
        if (message.includes("I am a")) {
            const role = message.split("I am a")[1].trim();
            console.log(`   -> Extracted role: ${role}`);

            await this.mem.add(`Role: ${role}`, {
                user_id: userId,
                metadata: { type: 'profile_trait', category: 'role' },
                tags: ['profile', 'role']
            });
        }
    }

    async getProfile(userId: string): Promise<string[]> {
        // Recall all memories tagged 'profile'
        // Using "User profile traits" as a semantic query to bias towards relevant info
        // + filtering if backend supported tag filters strictly.
        // Here we rely on the semantic query aligning with the content "Preference: ..."
        const traits = await this.mem.search("User personality profile traits preferences roles", {
            user_id: userId,
            limit: 10
        });

        return traits.map(t => t.content);
    }
}

async function start() {
    const profiler = new UserProfiler();
    const use = "user_dave";

    console.log("Analyzing chat stream...");
    await profiler.extractTraits(use, "Hello bot!");
    await profiler.extractTraits(use, "I like minimalist design and dark mode.");
    await profiler.extractTraits(use, "I am a frontend developer.");

    console.log("\nReconstructing Profile:");
    const profile = await profiler.getProfile(use);
    profile.forEach(p => console.log(` - ${p}`));
}

start().catch(console.error);

