/**
 * Test for background task observability module (C3)
 */
import assert from "node:assert/strict";
import {
    TASK_NAMES,
    task_start,
    task_success,
    task_failure,
    get_all_task_metrics,
    get_task_summary,
    with_observability,
} from "../src/core/observability";

async function test_task_success_tracking() {
    console.log("\n[Test] Task success tracking...");

    const start = task_start(TASK_NAMES.DECAY);
    await new Promise((r) => setTimeout(r, 50)); // Simulate work
    task_success(TASK_NAMES.DECAY, start, { decayed: 5, processed: 10 });

    const metrics = get_all_task_metrics();
    const decay_metrics = metrics.find((m) => m.task_name === TASK_NAMES.DECAY);

    assert.ok(decay_metrics, "Decay metrics should exist");
    assert.equal(decay_metrics.run_count, 1, "Run count should be 1");
    assert.equal(decay_metrics.success_count, 1, "Success count should be 1");
    assert.equal(decay_metrics.failure_count, 0, "Failure count should be 0");
    assert.ok(decay_metrics.last_duration_ms! >= 50, "Duration should be >= 50ms");
    assert.deepEqual(decay_metrics.last_result, { decayed: 5, processed: 10 });

    console.log(" -> PASS: Task success tracking works");
}

async function test_task_failure_tracking() {
    console.log("\n[Test] Task failure tracking...");

    const start = task_start(TASK_NAMES.PRUNE);
    task_failure(TASK_NAMES.PRUNE, start, new Error("Database connection failed"));

    const metrics = get_all_task_metrics();
    const prune_metrics = metrics.find((m) => m.task_name === TASK_NAMES.PRUNE);

    assert.ok(prune_metrics, "Prune metrics should exist");
    assert.equal(prune_metrics.run_count, 1, "Run count should be 1");
    assert.equal(prune_metrics.success_count, 0, "Success count should be 0");
    assert.equal(prune_metrics.failure_count, 1, "Failure count should be 1");
    assert.equal(prune_metrics.last_error, "Database connection failed");

    console.log(" -> PASS: Task failure tracking works");
}

async function test_task_summary() {
    console.log("\n[Test] Task summary aggregation...");

    const summary = get_task_summary();

    assert.ok(summary.total_runs >= 2, "Should have at least 2 total runs");
    assert.ok(summary.total_successes >= 1, "Should have at least 1 success");
    assert.ok(summary.total_failures >= 1, "Should have at least 1 failure");
    assert.ok(summary.failure_rate > 0, "Failure rate should be > 0");

    console.log(` -> Summary: ${summary.total_runs} runs, ${summary.total_successes} successes, ${summary.total_failures} failures`);
    console.log(" -> PASS: Task summary aggregation works");
}

async function test_with_observability_wrapper() {
    console.log("\n[Test] with_observability wrapper...");

    // Test successful task
    const successful_task = with_observability(TASK_NAMES.REFLECT, async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { created: 3, clusters: 2 };
    });

    const success_result = await successful_task();
    assert.equal(success_result.success, true);
    assert.deepEqual(success_result.result, { created: 3, clusters: 2 });
    assert.ok(success_result.duration_ms >= 20);

    // Test failing task
    const failing_task = with_observability(TASK_NAMES.USER_SUMMARY, async () => {
        throw new Error("Simulated failure");
    });

    const failure_result = await failing_task();
    assert.equal(failure_result.success, false);
    assert.equal(failure_result.error, "Simulated failure");

    console.log(" -> PASS: with_observability wrapper works");
}

async function test_recent_failures_detection() {
    console.log("\n[Test] Recent failures detection...");

    const summary = get_task_summary();

    // We had failures in the tests above, so there should be recent failures
    assert.ok(
        summary.tasks_with_recent_failures.length >= 1,
        "Should detect recent failures"
    );
    assert.ok(
        summary.tasks_with_recent_failures.includes(TASK_NAMES.PRUNE) ||
            summary.tasks_with_recent_failures.includes(TASK_NAMES.USER_SUMMARY),
        "Should include tasks that failed"
    );

    console.log(` -> Tasks with recent failures: ${summary.tasks_with_recent_failures.join(", ")}`);
    console.log(" -> PASS: Recent failures detection works");
}

async function run_all() {
    try {
        await test_task_success_tracking();
        await test_task_failure_tracking();
        await test_task_summary();
        await test_with_observability_wrapper();
        await test_recent_failures_detection();

        console.log("\n[OBSERVABILITY TESTS] ALL PASSED ✓");
        process.exit(0);
    } catch (e) {
        console.error("\n[OBSERVABILITY TESTS] FAILED:", e);
        process.exit(1);
    }
}

run_all();
