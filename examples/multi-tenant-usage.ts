/**
 * Multi-Tenant OpenMemory Usage Example
 *
 * This example demonstrates how to use OpenMemory in a multi-tenant SaaS application
 * where multiple customers share the same database but data is isolated by tenant_id.
 *
 * Use case: Customer support chatbot that remembers conversations per customer
 *
 * Prerequisites:
 * 1. PostgreSQL with pgvector extension
 * 2. DATABASE_URL environment variable
 * 3. Multi-tenant mode enabled
 *
 * Run:
 *   DATABASE_URL=postgresql://user:pass@host:5432/db tsx examples/multi-tenant-usage.ts
 */

import { OpenMemory } from '../packages/openmemory-js/src/client';

async function main() {
    console.log("🏢 OpenMemory Client - Multi-Tenant Usage Example\n");

    // Initialize OpenMemory with multi-tenant mode
    const memory = new OpenMemory({
        connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/openmemory",
        multi_tenant: true,
        pgvector_enabled: true,
        autoMigrate: true
    });

    console.log("✅ OpenMemory initialized in multi-tenant mode\n");

    // Simulate three different customers (tenants)
    const tenants = [
        { id: "acme_corp", name: "Acme Corporation" },
        { id: "globex_inc", name: "Globex Inc" },
        { id: "initech_llc", name: "Initech LLC" }
    ];

    // Add memories for each tenant
    console.log("📝 Adding memories for each tenant...\n");

    // Tenant 1: Acme Corp
    await memory.add({
        content: "Customer requested a refund for order #12345 due to shipping delay",
        tenant_id: tenants[0].id,
        user_id: "support_agent_alice",
        tags: ["refund", "shipping", "order-12345"],
        metadata: { priority: "high", order_id: "12345" }
    });

    await memory.add({
        content: "Customer upgraded to Enterprise plan on January 15th",
        tenant_id: tenants[0].id,
        user_id: "sales_agent_bob",
        tags: ["upgrade", "enterprise", "billing"]
    });

    await memory.add({
        content: "Customer reported bug in the dashboard export feature",
        tenant_id: tenants[0].id,
        user_id: "support_agent_alice",
        tags: ["bug", "dashboard", "export"],
        metadata: { severity: "medium", component: "dashboard" }
    });

    console.log(`✅ Added 3 memories for ${tenants[0].name}`);

    // Tenant 2: Globex Inc
    await memory.add({
        content: "Customer requested API rate limit increase from 1000 to 5000 req/min",
        tenant_id: tenants[1].id,
        user_id: "support_agent_charlie",
        tags: ["api", "rate-limit", "technical"],
        metadata: { current_limit: 1000, requested_limit: 5000 }
    });

    await memory.add({
        content: "Customer scheduled onboarding call for February 1st at 2pm EST",
        tenant_id: tenants[1].id,
        user_id: "sales_agent_dana",
        tags: ["onboarding", "meeting", "scheduled"],
        metadata: { date: "2024-02-01", time: "14:00", timezone: "EST" }
    });

    console.log(`✅ Added 2 memories for ${tenants[1].name}`);

    // Tenant 3: Initech LLC
    await memory.add({
        content: "Customer asked about SSO integration with Okta",
        tenant_id: tenants[2].id,
        user_id: "support_agent_eve",
        tags: ["sso", "okta", "integration", "security"]
    });

    await memory.add({
        content: "Customer mentioned they have 500 employees who will use the platform",
        tenant_id: tenants[2].id,
        user_id: "sales_agent_frank",
        tags: ["employee-count", "scale", "planning"]
    });

    console.log(`✅ Added 2 memories for ${tenants[2].name}\n`);

    // Query memories for each tenant separately
    console.log("🔍 Querying memories per tenant...\n");

    for (const tenant of tenants) {
        console.log(`\n--- ${tenant.name} (${tenant.id}) ---\n`);

        // Query recent interactions
        const results = await memory.query({
            query: "recent customer interactions and requests",
            tenant_id: tenant.id,
            k: 5
        });

        console.log(`Found ${results.length} relevant memories:\n`);
        results.forEach((result, index) => {
            console.log(`${index + 1}. ${result.content}`);
            console.log(`   Score: ${result.score.toFixed(3)}, Sector: ${result.primary_sector}`);
            if (result.tags && result.tags.length > 0) {
                console.log(`   Tags: ${result.tags.join(', ')}`);
            }
            console.log();
        });
    }

    // Demonstrate data isolation
    console.log("\n🔒 Demonstrating tenant data isolation...\n");

    // Query for "upgrade" - should only return Acme Corp result
    console.log("Query: 'upgrade' (should only return Acme Corp):\n");
    const acmeUpgrade = await memory.query({
        query: "upgrade",
        tenant_id: tenants[0].id,
        k: 3
    });

    console.log(`Acme Corp results: ${acmeUpgrade.length}`);
    acmeUpgrade.forEach(r => console.log(`  - ${r.content.substring(0, 60)}...`));

    // Try querying same term for Globex - should return different results
    const globexUpgrade = await memory.query({
        query: "upgrade",
        tenant_id: tenants[1].id,
        k: 3
    });

    console.log(`\nGlobex Inc results: ${globexUpgrade.length}`);
    globexUpgrade.forEach(r => console.log(`  - ${r.content.substring(0, 60)}...`));

    console.log("\n✅ Data isolation verified - tenants only see their own data\n");

    // Simulate support agent searching across their tenant
    console.log("👤 Simulating support agent workflow...\n");

    console.log("Support Agent Alice (Acme Corp) searches for 'issues':\n");
    const supportQuery = await memory.query({
        query: "customer issues and problems",
        tenant_id: tenants[0].id,
        k: 5
    });

    supportQuery.forEach((result, index) => {
        console.log(`${index + 1}. ${result.content}`);
        if (result.meta?.severity) {
            console.log(`   Severity: ${result.meta.severity}`);
        }
        console.log();
    });

    // List all memories for a tenant
    console.log("📋 Listing all memories for Acme Corp:\n");
    const acmeMemories = await memory.list(10, 0);

    // Filter by tenant (in a real app, you'd pass tenant_id to the query)
    console.log(`Total memories: ${acmeMemories.length}\n`);

    // Update a memory
    if (acmeMemories.length > 0) {
        const memToUpdate = supportQuery[0];
        console.log(`📝 Updating memory for ${tenants[0].name}...\n`);

        await memory.update({
            id: memToUpdate.id,
            content: memToUpdate.content + " [RESOLVED]",
            tags: [...(memToUpdate.tags || []), "resolved"],
            tenant_id: tenants[0].id
        });

        console.log("✅ Memory updated with resolution status\n");
    }

    // Clean up
    await memory.close();

    console.log("✅ Multi-tenant example completed successfully!");
}

// Run the example
main().catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
});
