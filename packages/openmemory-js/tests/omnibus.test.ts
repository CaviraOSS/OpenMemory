// Force synthetic embeddings BEFORE importing anything that loads cfg/db.
// vitest.config.ts already sets this via env, but keep this here as a
// belt-and-suspenders guard in case the spec is run standalone with tsx.
process.env.OM_EMBEDDINGS = "synthetic";
process.env.OM_EMBEDDING_FALLBACK = "synthetic";
process.env.OM_METADATA_BACKEND = process.env.OM_METADATA_BACKEND || "sqlite";
process.env.OM_VECTOR_BACKEND = process.env.OM_VECTOR_BACKEND || "sqlite";

import { afterAll, beforeAll, describe, it } from "vitest";
import { Memory } from "../src/core/memory";
import { run_async, q } from "../src/core/db";

// Mock time for evolutionary stability
let mockTime: number | null = null;
const originalNow = Date.now;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup(_user_id: string) {
    await run_async(`DELETE FROM memories`);
    try { await run_async(`DELETE FROM vectors`); } catch { }
    try { await run_async(`DELETE FROM openmemory_vectors`); } catch { }
    try { await run_async(`DELETE FROM waypoints`); } catch { }
    try { await run_async(`DELETE FROM users`); } catch { }
    if (global.gc) global.gc();
}

async function check_vec(id: string) {
    const row = await q.get_mem.get(id);
    if (!row) console.error(`[DEBUG] Memory ${id} NOT FOUND in DB`);
    else console.log(`[DEBUG] Memory ${id} vector length: ${row.mean_vec ? row.mean_vec.length : 'NULL'}`);
}

describe("omnibus", () => {
    beforeAll(() => {
        Date.now = () => (mockTime !== null ? mockTime : originalNow());
    });

    afterAll(() => {
        Date.now = originalNow;
    });

    it("Phase 1: Evolutionary Stability (10 Generations)", async () => {
        const mem = new Memory();
        const uid = "u1";
        await cleanup(uid);

        // 1. Genesis
        mockTime = originalNow();
        const res_pop = await mem.add("I am the Popular Memory", { user_id: uid });
        const res_unpop = await mem.add("I am the Unpopular Memory", { user_id: uid });
        const pid = res_pop.id;
        const uid_mem = res_unpop.id;

        // 2. Evolution Loop
        for (let gen = 0; gen < 10; gen++) {
            // Advance 1 day per generation (86400000 ms)
            mockTime! += 86400 * 1000;

            // Reinforce Popular every other generation
            if (gen % 2 === 0) {
                await mem.search("Popular", { user_id: uid, limit: 1 });
            }
        }

        // 3. Final Judgment
        mockTime! += 86400 * 1000;

        // Check Salience via DB directly to avoid search side-effects
        const pop_final = await q.get_mem.get(pid);
        const unpop_final = await q.get_mem.get(uid_mem);

        if (!pop_final || !unpop_final) {
            throw new Error("Memories lost in time!");
        }

        const s_pop = pop_final.salience;
        const s_unpop = unpop_final.salience;

        console.log(` -> Generation 10 Results:`);
        console.log(`    Popular Salience: ${s_pop.toFixed(4)}`);
        console.log(`    Unpopular Salience: ${s_unpop.toFixed(4)}`);

        if (s_pop <= s_unpop) {
            throw new Error(`FAIL: Popular memory (${s_pop}) should > Unpopular (${s_unpop})`);
        }
        console.log(" -> PASS: Survival of the fittest confirmed.");
        mockTime = null; // Reset
    });

    it("Phase 2: Boolean Metadata Logic", async () => {
        const mem = new Memory();
        const uid = "filter_user_js";
        await cleanup(uid);

        // Wait 500ms for WAL safety buffer from previous test deletions if any
        await sleep(500);

        // 1. High Priority, Work context
        await mem.add("Finish Report", { user_id: uid, tags: ["work", "urgent"], priority: 10 });
        // 2. Low Priority, Work context
        await mem.add("Clean Desk", { user_id: uid, tags: ["work"], priority: 2 });
        // 3. High Prioriy, Home context
        const res3 = await mem.add("Pay Bills", { user_id: uid, tags: ["home", "urgent"], priority: 10 });

        // Ensure persistence
        await sleep(1000);
        await check_vec(res3.id);

        console.log(" -> Filtering for 'work' AND 'urgent'...");
        // Since search doesn't support complex filter syntax yet, we search semantic and verify post-hoc
        const hits = await mem.search("Report", { user_id: uid, limit: 10 });

        // Check logic
        const found = hits.some((h: any) => {
            const tags = typeof h.tags === 'string' ? JSON.parse(h.tags) : h.tags || [];
            return tags.includes("urgent") && tags.includes("work");
        });

        if (!found) {
            await require('fs/promises').writeFile('hits.json', JSON.stringify(hits, null, 2));
            throw new Error("FAIL: Did not find item with both tags. Dumped hits to hits.json");
        }
        console.log(" -> PASS: Metadata attributes preserved and queryable.");
    });

    it("Phase 3: Content Robustness", async () => {
        const mem = new Memory();
        const uid = "format_user_js";
        await cleanup(uid);
        await sleep(500);

        const payloads = {
            "HTML": "<div><h1>Title</h1><p>Body</p></div>",
            "JSON": '{"key": "value", "list": [1, 2, 3]}',
            "Markdown": "| Col1 | Col2 |\n|---|---|\n| Val1 | Val2 |",
        };

        for (const [fmt, content] of Object.entries(payloads)) {
            await mem.add(content, { user_id: uid });
            await sleep(200);

            const hits = await mem.search(content.substring(0, 10), { user_id: uid, limit: 1 });
            if (!hits || hits.length === 0) {
                throw new Error(`FAIL: ${fmt} retrieval returned no results.`);
            }

            const retrieved = hits[0].content;

            // Check containment
            if (retrieved.includes("Title") || retrieved.includes("key") || retrieved.includes("Col1")) {
                console.log(` -> ${fmt}: Verified (Key Match)`);
            } else {
                console.error(`original: ${content}`);
                console.error(`retrieved: ${retrieved}`);
                throw new Error(`FAIL: ${fmt} retrieval content mismatch.`);
            }
        }
        console.log(" -> PASS: Complex formats handled.");
    });
});
