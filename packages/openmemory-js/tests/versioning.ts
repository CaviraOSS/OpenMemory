/**
 * Test for document versioning system (D1)
 */
import assert from "node:assert/strict";

// Set up environment before importing
process.env.OM_EMBEDDINGS = "synthetic";

import { run_async, all_async, q } from "../src/core/db";
import {
    save_version,
    get_versions,
    get_version,
    compute_diff,
    generate_change_summary,
    diff_versions,
    count_versions,
} from "../src/core/versioning";
import { add_hsg_memory, update_memory } from "../src/memory/hsg";
import { j } from "../src/utils";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cleanup() {
    try {
        await run_async("DELETE FROM version_history");
        await run_async("DELETE FROM memories");
        await run_async("DELETE FROM vectors");
    } catch (e) {
        // Tables may not exist yet
    }
}

async function test_compute_diff() {
    console.log("\n[Test] Compute diff...");

    const old_content = "Line 1\nLine 2\nLine 3";
    const new_content = "Line 1\nLine 2 modified\nLine 3\nLine 4";

    const diff = compute_diff(old_content, new_content);

    assert.ok(diff.added.length > 0, "Should have added lines");
    assert.ok(diff.removed.length > 0, "Should have removed lines");
    assert.ok(diff.unchanged.length > 0, "Should have unchanged lines");
    assert.ok(diff.similarity >= 0 && diff.similarity <= 1, "Similarity should be 0-1");
    assert.ok(
        ["minor", "moderate", "major"].includes(diff.change_type),
        "Should have valid change type"
    );

    const summary = generate_change_summary(diff);
    assert.ok(summary.includes("change"), "Summary should describe change");

    console.log(` -> Diff: +${diff.added.length}, -${diff.removed.length}, =${diff.unchanged.length}`);
    console.log(` -> Similarity: ${diff.similarity}, Type: ${diff.change_type}`);
    console.log(` -> Summary: ${summary}`);
    console.log(" -> PASS: Compute diff works");
}

async function test_save_and_get_version() {
    console.log("\n[Test] Save and get version...");

    // Create a test memory
    const mem = await add_hsg_memory(
        "Original content for versioning test",
        j(["test", "versioning"]),
        { test: true },
        "version-test-user"
    );

    // Save a version
    const version_id = await save_version(
        mem.id,
        "Original content for versioning test",
        j(["test", "versioning"]),
        j({ test: true }),
        mem.primary_sector,
        1,
        "Initial version",
        "version-test-user"
    );

    assert.ok(version_id, "Should return version ID");

    // Get the version
    const version = await get_version(mem.id, 1);
    assert.ok(version, "Should find version");
    assert.equal(version.memory_id, mem.id);
    assert.equal(version.version_number, 1);
    assert.equal(version.content, "Original content for versioning test");
    assert.equal(version.change_summary, "Initial version");

    console.log(` -> Saved version: ${version_id}`);
    console.log(` -> Version content: ${version.content.substring(0, 30)}...`);
    console.log(" -> PASS: Save and get version works");

    return mem;
}

async function test_version_history(mem: any) {
    console.log("\n[Test] Version history...");

    // Save another version
    await save_version(
        mem.id,
        "Modified content",
        j(["test", "modified"]),
        j({ test: true, modified: true }),
        mem.primary_sector,
        2,
        "Second version with modifications",
        "version-test-user"
    );

    const versions = await get_versions(mem.id, 10);
    assert.ok(versions.length >= 2, `Should have at least 2 versions, got ${versions.length}`);

    // Versions should be ordered by version_number DESC
    assert.ok(
        versions[0].version_number > versions[1].version_number,
        "Versions should be in descending order"
    );

    const count = await count_versions(mem.id);
    assert.equal(count, versions.length, "Count should match versions length");

    console.log(` -> Total versions: ${count}`);
    console.log(` -> Version numbers: ${versions.map((v) => v.version_number).join(", ")}`);
    console.log(" -> PASS: Version history works");

    return mem;
}

async function test_diff_versions(mem: any) {
    console.log("\n[Test] Diff between versions...");

    const diff = await diff_versions(mem.id, 1, 2);
    assert.ok(diff, "Should return diff");
    assert.ok(diff.added.length > 0 || diff.removed.length > 0, "Should have changes");
    assert.equal(diff.version_a.version_number, 1);
    assert.equal(diff.version_b.version_number, 2);

    console.log(` -> Diff v1 -> v2: +${diff.added.length}, -${diff.removed.length}`);
    console.log(` -> Change type: ${diff.change_type}`);
    console.log(" -> PASS: Diff between versions works");
}

async function test_auto_versioning() {
    console.log("\n[Test] Auto-versioning on update...");

    // Create a new memory
    const mem = await add_hsg_memory(
        "Content to be updated",
        j(["auto-version"]),
        {},
        "auto-version-user"
    );

    // Update it with new content
    const result = await update_memory(
        mem.id,
        "Updated content with changes",
        ["auto-version", "updated"],
        { updated: true },
        { user_id: "auto-version-user" }
    );

    assert.ok(result.updated, "Should be updated");
    assert.ok(result.version >= 2, "Version should be incremented");

    // Check that a version was auto-saved
    await sleep(100); // Give async save time to complete
    const versions = await get_versions(mem.id, 10);

    // We should have at least 1 version (the pre-update snapshot)
    assert.ok(versions.length >= 1, "Should have at least 1 version snapshot");

    console.log(` -> Update result version: ${result.version}`);
    console.log(` -> Saved versions: ${versions.length}`);
    if (versions.length > 0) {
        console.log(` -> Last version summary: ${versions[0].change_summary}`);
    }
    console.log(" -> PASS: Auto-versioning on update works");
}

async function run_all() {
    try {
        // Wait for DB to initialize
        await sleep(1000);
        await cleanup();

        await test_compute_diff();
        const mem = await test_save_and_get_version();
        await test_version_history(mem);
        await test_diff_versions(mem);
        await test_auto_versioning();

        console.log("\n[VERSIONING TESTS] ALL PASSED ✓");
        process.exit(0);
    } catch (e) {
        console.error("\n[VERSIONING TESTS] FAILED:", e);
        process.exit(1);
    }
}

run_all();
