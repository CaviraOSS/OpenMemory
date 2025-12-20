
import { Memory } from "../src/core/memory";
import { env } from "../src/core/cfg";
import { q } from "../src/core/db";

async function runTest() {
    console.log("\\n[TEST] 🧪 Starting JS Deep Sector & Vector Verification...");
    console.log(`[TEST] Target Vector Dim: ${env.vec_dim}`);

    const uid = "js_sector_tester_v1";
    // We need to implement delete_all in JS if not present?
    // JS `Memory` class likely has it? Checked API parity.
    // If not, we can use `q` directly.
    try {
        await q.conn.run("DELETE FROM memories WHERE user_id = ?", [uid]);
    } catch (e) {
        console.log("Cleanup warning:", e);
    }

    const mem = new Memory(uid);
    console.log(`[TEST] Cleared memory for user: ${uid}`);

    const testCases = [
        {
            type: "episodic",
            text: "Yesterday I went to the park at 4:00 PM and saw a dog.",
            expected: "episodic"
        },
        {
            type: "emotional",
            text: "I feel absolutely amazing and excited about this new project! Wow!",
            expected: "emotional"
        },
        {
            type: "procedural",
            text: "To install the package, first run npm install, then configure the settings.",
            expected: "procedural"
        },
        {
            type: "reflective",
            text: "I realized that the pattern of failure was due to my own lack of patience.",
            expected: "reflective"
        },
        {
            type: "semantic",
            text: "Python is a high-level programming language known for its readability.",
            expected: "semantic"
        }
    ];

    console.log("\\n[TEST] Ingesting Samples...");
    let passed = true;

    for (const c of testCases) {
        console.log(`  > Ingesting (${c.type}): "${c.text.substring(0, 40)}..."`);
        const res = await mem.add(c.text);
        const mid = res.id;

        // Wait for WAL
        await new Promise(r => setTimeout(r, 500));

        // Get from DB
        const row = await q.get_mem.get(mid);
        if (!row) {
            console.log("    FAIL: Memory not found in DB");
            passed = false;
            continue;
        }

        const actual = row.primary_sector;
        const status = actual === c.expected ? "PASS" : `FAIL (Got: ${actual})`;
        console.log(`    - ID: ${mid}`);
        console.log(`    - Assigned Sector: ${actual.toUpperCase()} ${status}`);

        if (actual !== c.expected) passed = false;

        console.log(`    - Checking Vector Dimensions...`);
        const vecBuf = row.mean_vec;
        if (!vecBuf) {
            console.log("    FAIL: No vector generated!");
            passed = false;
        } else {
            // Buffer in Node/Bun.
            const vecLen = vecBuf.length; // bytes
            const dim = vecLen / 4;
            if (dim === 1536) {
                console.log(`    PASS: Vector Dim ${dim} (Size: ${vecLen} bytes)`);
            } else {
                console.log(`    FAIL: Vector Dim ${dim} (Expected 1536)`);
                passed = false;
            }
        }
    }

    console.log("\\n[TEST] Summary:");
    if (passed) {
        console.log("ALL JS SECTOR & VECTOR TESTS PASSED.");
    } else {
        console.log("SOME TESTS FAILED.");
        process.exit(1);
    }
}

runTest().catch(console.error);
