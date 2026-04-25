
import { Memory } from "../src/core/memory";
import { run_async, q } from "../src/core/db";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup() {
    await run_async(`DELETE FROM memories`);
    try { await run_async(`DELETE FROM vectors`); } catch { }
    try { await run_async(`DELETE FROM openmemory_vectors`); } catch { }
    try { await run_async(`DELETE FROM waypoints`); } catch { }
}

// Force synthetic embeddings for reliability during tests
process.env.OM_EMBEDDINGS = "synthetic";

async function test_project_isolation() {
    console.log("\n[Test] Project-Level Memory Isolation");
    const mem = new Memory();
    const uid = "test_user";
    await cleanup();
    await sleep(500);

    const projA = "project_alpha";
    const projB = "project_beta";
    const globalScope = "system_global";

    // 1. Add memory to Project Alpha
    console.log(` -> Adding memory to ${projA}...`);
    await mem.add("Project Alpha confidential strategy: operation midnight.", { 
        user_id: uid, 
        project_id: projA 
    });

    // 2. Add memory to Project Beta
    console.log(` -> Adding memory to ${projB}...`);
    await mem.add("Project Beta roadmap: launch in Q4.", { 
        user_id: uid, 
        project_id: projB 
    });

    // 3. Add Global memory
    console.log(` -> Adding global memory...`);
    await mem.add("General coding standard: use camelCase for variables.", { 
        user_id: uid, 
        project_id: globalScope 
    });

    await sleep(1000); // Wait for indexing

    // --- Verification ---

    // A. Query from Project Alpha
    console.log(` -> Querying from ${projA}...`);
    const hitsA = await mem.search("midnight", { user_id: uid, project_id: projA });
    
    const hasAlpha = hitsA.some(h => h.content.includes("Alpha"));
    const hasBetaInA = hitsA.some(h => h.content.includes("Beta"));
    const hasGlobalInA = await mem.search("coding standard", { user_id: uid, project_id: projA });

    if (!hasAlpha) throw new Error(`FAIL: ${projA} could not find its own memory.`);
    if (hasBetaInA) throw new Error(`FAIL: ${projA} found memory from ${projB}.`);
    if (hasGlobalInA.length === 0) throw new Error(`FAIL: ${projA} could not find global memory.`);
    console.log(`    [PASS] ${projA} is isolated from ${projB} but sees global.`);

    // B. Query from Project Beta
    console.log(` -> Querying from ${projB}...`);
    const hitsB = await mem.search("roadmap", { user_id: uid, project_id: projB });
    
    const hasBeta = hitsB.some(h => h.content.includes("Beta"));
    const hasAlphaInB = hitsB.some(h => h.content.includes("Alpha"));

    if (!hasBeta) throw new Error(`FAIL: ${projB} could not find its own memory.`);
    if (hasAlphaInB) throw new Error(`FAIL: ${projB} found memory from ${projA}.`);
    console.log(`    [PASS] ${projB} is isolated from ${projA}.`);

    // C. Global query (No project filter)
    // Note: If no project_id is provided, it currently filters by user_id only (or no filter if user_id is null)
    // But our hsg_query logic filters by project_id OR system_global OR NULL if project_id is provided.
    // If project_id is NOT provided, it doesn't apply the project filter.
    console.log(` -> Global query (no project filter)...`);
    const hitsGlobal = await mem.search("Project", { user_id: uid });
    if (hitsGlobal.length < 2) throw new Error("FAIL: Global query should see both projects if no filter applied.");
    console.log(`    [PASS] Global query sees all.`);

    console.log("\n[SUCCESS] Project isolation verified.");
}

async function run() {
    try {
        await test_project_isolation();
        process.exit(0);
    } catch (e) {
        console.error("\n[FAILURE]:", e);
        process.exit(1);
    }
}

run();
