#!/usr/bin/env npx tsx
/**
 * Re-embed All Memories Script
 *
 * This script iterates through all memories in the database and re-embeds them
 * using the currently configured embedding provider (e.g., Voyage).
 *
 * Usage:
 *   cd packages/openmemory-js
 *   npx tsx scripts/reembed-all.ts [--dry-run] [--batch-size=50] [--delay=500]
 *
 * Environment:
 *   Requires OM_* environment variables to be set (database, embedding provider)
 *
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --batch-size=N  Process N memories per batch (default: 50)
 *   --delay=MS      Delay MS milliseconds between batches (default: 500)
 */

import { all_async, get_async, run_async, init_db } from "../src/core/db";
import { embedMultiSector } from "../src/memory/embed";
import { env } from "../src/core/cfg";

const SECTORS = ["episodic", "semantic", "procedural", "emotional", "reflective"];

interface Args {
    dryRun: boolean;
    batchSize: number;
    delayMs: number;
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    return {
        dryRun: args.includes("--dry-run"),
        batchSize: parseInt(args.find(a => a.startsWith("--batch-size="))?.split("=")[1] || "50"),
        delayMs: parseInt(args.find(a => a.startsWith("--delay="))?.split("=")[1] || "500"),
    };
}

async function getMemories(limit: number, offset: number): Promise<any[]> {
    const is_pg = env.metadata_backend === "postgres";
    const schema = process.env.OM_PG_SCHEMA || "public";
    const table = process.env.OM_PG_TABLE || "openmemory_memories";

    const query = is_pg
        ? `SELECT id, content, primary_sector FROM "${schema}"."${table}" ORDER BY created_at LIMIT $1 OFFSET $2`
        : `SELECT id, content, primary_sector FROM memories ORDER BY created_at LIMIT ? OFFSET ?`;

    return all_async(query, [limit, offset]);
}

async function getTotalCount(): Promise<number> {
    const is_pg = env.metadata_backend === "postgres";
    const schema = process.env.OM_PG_SCHEMA || "public";
    const table = process.env.OM_PG_TABLE || "openmemory_memories";

    const query = is_pg
        ? `SELECT COUNT(*) as count FROM "${schema}"."${table}"`
        : `SELECT COUNT(*) as count FROM memories`;

    const row = await get_async(query);
    return Number(row?.count || 0);
}

async function deleteVectors(memoryId: string): Promise<void> {
    const is_pg = env.metadata_backend === "postgres";
    const schema = process.env.OM_PG_SCHEMA || "public";
    const vecTable = process.env.OM_VECTOR_TABLE || "openmemory_vectors";

    const query = is_pg
        ? `DELETE FROM "${schema}"."${vecTable}" WHERE id = $1`
        : `DELETE FROM vectors WHERE id = ?`;

    await run_async(query, [memoryId]);
}

async function main() {
    const args = parseArgs();

    console.log("=".repeat(60));
    console.log("OpenMemory Re-embedding Script");
    console.log("=".repeat(60));
    console.log(`Provider:     ${env.emb_kind}`);
    console.log(`Dry run:      ${args.dryRun}`);
    console.log(`Batch size:   ${args.batchSize}`);
    console.log(`Delay:        ${args.delayMs}ms`);
    console.log("=".repeat(60));

    // Wait for DB to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    const total = await getTotalCount();
    console.log(`\nTotal memories: ${total}`);

    if (total === 0) {
        console.log("No memories to re-embed.");
        process.exit(0);
    }

    let processed = 0;
    let success = 0;
    let failed = 0;
    const startTime = Date.now();

    while (processed < total) {
        const memories = await getMemories(args.batchSize, processed);
        if (memories.length === 0) break;

        for (const mem of memories) {
            const text = mem.content || "";
            if (!text.trim()) {
                console.log(`[SKIP] ${mem.id.slice(0, 8)}... (empty content)`);
                processed++;
                continue;
            }

            try {
                if (args.dryRun) {
                    console.log(`[DRY-RUN] Would re-embed ${mem.id.slice(0, 8)}... (${text.length} chars)`);
                } else {
                    // Delete old vectors
                    await deleteVectors(mem.id);

                    // Re-embed with current provider
                    const results = await embedMultiSector(mem.id, text, SECTORS);

                    console.log(`[OK] ${mem.id.slice(0, 8)}... (${results.length} sectors, ${results[0]?.dim || 0} dims)`);
                }
                success++;
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error(`[FAIL] ${mem.id.slice(0, 8)}... ${msg}`);
                failed++;
            }

            processed++;
        }

        // Progress update
        const pct = ((processed / total) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`\n--- Progress: ${processed}/${total} (${pct}%) | Elapsed: ${elapsed}s | Success: ${success} | Failed: ${failed} ---\n`);

        // Rate limiting delay
        if (!args.dryRun && processed < total) {
            await new Promise(resolve => setTimeout(resolve, args.delayMs));
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("Re-embedding Complete");
    console.log("=".repeat(60));
    console.log(`Total processed: ${processed}`);
    console.log(`Successful:      ${success}`);
    console.log(`Failed:          ${failed}`);
    console.log(`Time elapsed:    ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log("=".repeat(60));

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error("Fatal error:", e);
    process.exit(1);
});
