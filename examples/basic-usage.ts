/**
 * Basic OpenMemory Client Usage Example
 *
 * This example shows how to use OpenMemory as a library without running a server.
 * Perfect for serverless environments like Cloud Run, Lambda, or Edge Functions.
 *
 * Prerequisites:
 * 1. Set up a PostgreSQL database (Supabase recommended)
 * 2. Enable pgvector extension: CREATE EXTENSION vector;
 * 3. Set DATABASE_URL environment variable
 *
 * Run:
 *   DATABASE_URL=postgresql://user:pass@host:5432/db tsx examples/basic-usage.ts
 */

import { OpenMemory } from '../packages/openmemory-js/src/client';

async function main() {
    console.log("🧠 OpenMemory Client - Basic Usage Example\n");

    // Initialize OpenMemory client
    const memory = new OpenMemory({
        connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/openmemory",
        tenant_id: "demo_tenant",
        user_id: "demo_user",
        pgvector_enabled: true,
        autoMigrate: true
    });

    console.log("✅ OpenMemory client initialized\n");

    // Example 1: Add episodic memories (events and experiences)
    console.log("📝 Adding episodic memories...");
    await memory.add({
        content: "Had a productive meeting with the engineering team about the Q1 roadmap",
        tags: ["meeting", "engineering", "planning"],
        metadata: { date: "2024-01-15", duration_minutes: 60 }
    });

    await memory.add({
        content: "Launched the new user dashboard feature to production",
        tags: ["deployment", "feature", "dashboard"],
        metadata: { version: "2.1.0", environment: "production" }
    });

    await memory.add({
        content: "Coffee chat with Sarah about career growth and mentorship",
        tags: ["coffee-chat", "mentorship", "career"],
        metadata: { participant: "Sarah" }
    });

    console.log("✅ Added 3 episodic memories\n");

    // Example 2: Add semantic memories (facts and knowledge)
    console.log("📚 Adding semantic memories...");
    await memory.add({
        content: "PostgreSQL is a powerful open-source relational database",
        tags: ["database", "knowledge", "technology"]
    });

    await memory.add({
        content: "pgvector is a PostgreSQL extension for vector similarity search",
        tags: ["pgvector", "postgresql", "vectors"]
    });

    console.log("✅ Added 2 semantic memories\n");

    // Example 3: Add procedural memories (how-to knowledge)
    console.log("🔧 Adding procedural memories...");
    await memory.add({
        content: "To deploy to production: 1) Run tests 2) Build Docker image 3) Push to registry 4) Deploy to Cloud Run",
        tags: ["deployment", "procedure", "cloud-run"]
    });

    console.log("✅ Added 1 procedural memory\n");

    // Example 4: Query all memories
    console.log("🔍 Querying: 'What happened this week?'\n");
    const results = await memory.query({
        query: "What happened this week?",
        k: 5
    });

    console.log(`Found ${results.length} relevant memories:\n`);
    results.forEach((result, index) => {
        console.log(`${index + 1}. [${result.primary_sector}] ${result.content}`);
        console.log(`   Score: ${result.score.toFixed(3)}, Salience: ${result.salience.toFixed(3)}`);
        if (result.tags && result.tags.length > 0) {
            console.log(`   Tags: ${result.tags.join(', ')}`);
        }
        console.log();
    });

    // Example 5: Sector-specific query
    console.log("🔍 Querying episodic sector: 'meetings and discussions'\n");
    const episodicResults = await memory.query({
        query: "meetings and discussions",
        sectors: ["episodic"],
        k: 3
    });

    console.log(`Found ${episodicResults.length} episodic memories:\n`);
    episodicResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.content}`);
        console.log(`   Score: ${result.score.toFixed(3)}\n`);
    });

    // Example 6: Query with filters
    console.log("🔍 Querying with salience filter (min 0.8): 'deployment'\n");
    const filteredResults = await memory.query({
        query: "deployment",
        minSalience: 0.8,
        k: 3
    });

    console.log(`Found ${filteredResults.length} high-salience memories:\n`);
    filteredResults.forEach((result, index) => {
        console.log(`${index + 1}. ${result.content}`);
        console.log(`   Salience: ${result.salience.toFixed(3)}\n`);
    });

    // Example 7: Update a memory
    if (results.length > 0) {
        const memoryToUpdate = results[0];
        console.log(`📝 Updating memory: ${memoryToUpdate.id}\n`);

        await memory.update({
            id: memoryToUpdate.id,
            content: memoryToUpdate.content + " [UPDATED]",
            tags: [...(memoryToUpdate.tags || []), "updated"]
        });

        console.log("✅ Memory updated\n");
    }

    // Example 8: List all memories
    console.log("📋 Listing all memories (paginated):\n");
    const allMemories = await memory.list(10, 0);

    console.log(`Total memories retrieved: ${allMemories.length}\n`);
    allMemories.forEach((mem, index) => {
        console.log(`${index + 1}. [${mem.primary_sector}] ${mem.content.substring(0, 60)}...`);
    });

    console.log("\n✅ Example completed successfully!");

    // Clean up
    await memory.close();
}

// Run the example
main().catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
});
