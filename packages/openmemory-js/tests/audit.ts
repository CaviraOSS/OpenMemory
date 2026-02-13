/**
 * Test for audit trail system (D5)
 */
import assert from "node:assert/strict";

// Set up environment before importing audit module
process.env.OM_EMBEDDINGS = "synthetic";

import { run_async, all_async, get_async } from "../src/core/db";
import {
    audit_log,
    query_audit_logs,
    count_audit_logs,
    get_resource_history,
} from "../src/core/audit";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cleanup() {
    try {
        await run_async("DELETE FROM audit_logs");
    } catch (e) {
        // Table may not exist yet
    }
}

async function test_audit_log_create() {
    console.log("\n[Test] Audit log creation...");

    const id = await audit_log("memory", "test-mem-123", "create", {
        actor_id: "user-456",
        actor_type: "user",
        changes: { content: "new" },
        metadata: { sector: "semantic" },
    });

    assert.ok(id, "Should return audit log ID");
    assert.equal(typeof id, "string", "ID should be string");

    console.log(` -> Created audit log: ${id}`);
    console.log(" -> PASS: Audit log creation works");
}

async function test_audit_query() {
    console.log("\n[Test] Audit log querying...");

    // Create a few more logs
    await audit_log("memory", "test-mem-123", "update", {
        actor_id: "user-456",
        changes: { tags: ["updated"] },
    });

    await audit_log("memory", "test-mem-789", "create", {
        actor_id: "user-999",
    });

    await audit_log("memory", "test-mem-123", "delete", {
        actor_id: "user-456",
    });

    // Query all
    const all_logs = await query_audit_logs({ limit: 100 });
    assert.ok(all_logs.length >= 4, `Should have at least 4 logs, got ${all_logs.length}`);

    // Query by resource_id
    const resource_logs = await query_audit_logs({
        resource_id: "test-mem-123",
    });
    assert.ok(resource_logs.length >= 3, "Should have at least 3 logs for test-mem-123");

    // Query by action
    const create_logs = await query_audit_logs({ action: "create" });
    assert.ok(create_logs.length >= 2, "Should have at least 2 create logs");

    // Query by actor
    const user_logs = await query_audit_logs({ actor_id: "user-456" });
    assert.ok(user_logs.length >= 3, "Should have at least 3 logs for user-456");

    console.log(` -> Total logs: ${all_logs.length}`);
    console.log(` -> Logs for test-mem-123: ${resource_logs.length}`);
    console.log(` -> Create actions: ${create_logs.length}`);
    console.log(` -> User-456 actions: ${user_logs.length}`);
    console.log(" -> PASS: Audit log querying works");
}

async function test_audit_count() {
    console.log("\n[Test] Audit log counting...");

    const total = await count_audit_logs({});
    const creates = await count_audit_logs({ action: "create" });
    const user_actions = await count_audit_logs({ actor_id: "user-456" });

    assert.ok(total >= 4, `Total should be >= 4, got ${total}`);
    assert.ok(creates >= 2, `Creates should be >= 2, got ${creates}`);

    console.log(` -> Total: ${total}, Creates: ${creates}, User-456: ${user_actions}`);
    console.log(" -> PASS: Audit log counting works");
}

async function test_resource_history() {
    console.log("\n[Test] Resource history...");

    const history = await get_resource_history("memory", "test-mem-123", 10);

    assert.ok(history.length >= 3, "Should have at least 3 history entries");
    assert.equal(history[0].action, "delete", "Most recent should be delete");
    assert.ok(
        history.every((h) => h.resource_id === "test-mem-123"),
        "All entries should be for test-mem-123"
    );

    console.log(` -> History entries: ${history.length}`);
    console.log(` -> Actions: ${history.map((h) => h.action).join(" -> ")}`);
    console.log(" -> PASS: Resource history works");
}

async function test_audit_data_integrity() {
    console.log("\n[Test] Audit data integrity...");

    const logs = await query_audit_logs({ resource_id: "test-mem-123" });
    const create_log = logs.find((l) => l.action === "create");

    assert.ok(create_log, "Should find create log");
    assert.equal(create_log.resource_type, "memory");
    assert.equal(create_log.actor_id, "user-456");
    assert.equal(create_log.actor_type, "user");
    assert.ok(create_log.changes?.content === "new", "Changes should contain content");
    assert.ok(create_log.metadata?.sector === "semantic", "Metadata should contain sector");

    console.log(` -> Create log: ${JSON.stringify(create_log, null, 2)}`);
    console.log(" -> PASS: Audit data integrity works");
}

async function run_all() {
    try {
        // Wait for DB to initialise
        await sleep(1000);
        await cleanup();

        await test_audit_log_create();
        await test_audit_query();
        await test_audit_count();
        await test_resource_history();
        await test_audit_data_integrity();

        console.log("\n[AUDIT TESTS] ALL PASSED ✓");
        process.exit(0);
    } catch (e) {
        console.error("\n[AUDIT TESTS] FAILED:", e);
        process.exit(1);
    }
}

run_all();
