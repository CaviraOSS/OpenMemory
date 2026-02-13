/**
 * Test for redline/change classification system (D4)
 */
import assert from "node:assert/strict";
import {
    compute_word_diff,
    generate_redline,
    generate_change_narrative,
    type ChangeCategory,
} from "../src/core/redline";

function test_word_diff_basic() {
    console.log("\n[Test] Basic word diff...");

    const old_text = "The quick brown fox";
    const new_text = "The slow brown dog";

    const diff = compute_word_diff(old_text, new_text);

    const added = diff.filter((c) => c.type === "added").map((c) => c.text);
    const removed = diff.filter((c) => c.type === "removed").map((c) => c.text);
    const unchanged = diff.filter((c) => c.type === "unchanged").map((c) => c.text);

    assert.ok(added.includes("slow") || added.includes("dog"), "Should detect added words");
    assert.ok(removed.includes("quick") || removed.includes("fox"), "Should detect removed words");
    assert.ok(unchanged.length > 0, "Should have unchanged words");

    console.log(` -> Added: ${added.join(", ")}`);
    console.log(` -> Removed: ${removed.join(", ")}`);
    console.log(` -> Unchanged: ${unchanged.join(", ")}`);
    console.log(" -> PASS: Basic word diff works");
}

function test_financial_classification() {
    console.log("\n[Test] Financial change classification...");

    const old_text = "The payment amount is $1,000.00";
    const new_text = "The payment amount is $2,500.00";

    const redline = generate_redline(old_text, new_text);

    assert.ok(
        redline.summary.by_category.financial > 0,
        "Should detect financial changes"
    );
    assert.ok(
        redline.classified_changes.financial.added.length > 0 ||
        redline.classified_changes.financial.removed.length > 0,
        "Should have financial classified changes"
    );

    console.log(` -> Financial changes: ${redline.summary.by_category.financial}`);
    console.log(` -> Severity: ${redline.summary.severity}`);
    console.log(" -> PASS: Financial classification works");
}

function test_date_classification() {
    console.log("\n[Test] Date change classification...");

    const old_text = "The effective date is January 1, 2026";
    const new_text = "The effective date is March 15, 2026";

    const redline = generate_redline(old_text, new_text);

    assert.ok(
        redline.summary.by_category.date > 0,
        "Should detect date changes"
    );

    console.log(` -> Date changes: ${redline.summary.by_category.date}`);
    console.log(` -> Added: ${redline.classified_changes.date.added.join(", ")}`);
    console.log(` -> Removed: ${redline.classified_changes.date.removed.join(", ")}`);
    console.log(" -> PASS: Date classification works");
}

function test_party_classification() {
    console.log("\n[Test] Party change classification...");

    const old_text = "Agreement between Acme Inc. and Beta Corp.";
    const new_text = "Agreement between Acme Inc. and Gamma LLC";

    const redline = generate_redline(old_text, new_text);

    assert.ok(
        redline.summary.by_category.party > 0,
        "Should detect party changes"
    );

    console.log(` -> Party changes: ${redline.summary.by_category.party}`);
    console.log(" -> PASS: Party classification works");
}

function test_legal_term_classification() {
    console.log("\n[Test] Legal term change classification...");

    const old_text = "The Seller shall deliver the goods";
    const new_text = "The Seller may deliver the goods";

    const redline = generate_redline(old_text, new_text);

    assert.ok(
        redline.summary.by_category.legal_term > 0,
        "Should detect legal term changes"
    );

    console.log(` -> Legal term changes: ${redline.summary.by_category.legal_term}`);
    console.log(" -> PASS: Legal term classification works");
}

function test_severity_calculation() {
    console.log("\n[Test] Severity calculation...");

    // Minor change
    const minor = generate_redline("Hello world", "Hello there");
    assert.ok(
        ["minor", "moderate"].includes(minor.summary.severity),
        "Simple text change should be minor/moderate"
    );

    // Major change with financial
    const major = generate_redline(
        "The fee is $100",
        "The fee is $10,000 and includes additional charges"
    );
    assert.ok(
        ["major", "critical"].includes(major.summary.severity),
        "Financial change should be major/critical"
    );

    console.log(` -> Minor example severity: ${minor.summary.severity}`);
    console.log(` -> Major example severity: ${major.summary.severity}`);
    console.log(" -> PASS: Severity calculation works");
}

function test_redline_html_generation() {
    console.log("\n[Test] Redline HTML generation...");

    const old_text = "The price is $100";
    const new_text = "The price is $200";

    const redline = generate_redline(old_text, new_text);

    assert.ok(redline.redline_html.includes("<ins"), "Should have insertion tags");
    assert.ok(redline.redline_html.includes("<del"), "Should have deletion tags");
    assert.ok(redline.redline_html.includes("redline-add"), "Should have add class");
    assert.ok(redline.redline_html.includes("redline-del"), "Should have del class");
    assert.ok(redline.redline_html.includes("data-category"), "Should have category data");

    console.log(` -> HTML length: ${redline.redline_html.length} chars`);
    console.log(` -> Sample: ${redline.redline_html.substring(0, 100)}...`);
    console.log(" -> PASS: Redline HTML generation works");
}

function test_change_narrative() {
    console.log("\n[Test] Change narrative generation...");

    const redline = generate_redline(
        "The Buyer shall pay $1,000 by January 1, 2026",
        "The Seller may receive $2,000 by March 15, 2026"
    );

    const narrative = generate_change_narrative(redline);

    assert.ok(narrative.includes("severity"), "Should include severity");
    assert.ok(narrative.includes("Total changes"), "Should include total changes");

    console.log(` -> Narrative:\n${narrative}`);
    console.log(" -> PASS: Change narrative generation works");
}

function test_complex_document_diff() {
    console.log("\n[Test] Complex document diff...");

    const old_doc = `
SERVICE AGREEMENT

This Agreement is made between OpenMemory Inc. ("Company") and Acme Corp. ("Client").

1. SERVICES
The Company shall provide software services to the Client.

2. PAYMENT
The Client shall pay $5,000 per month, due on the 1st of each month.
Payment shall be made within 30 days of invoice.

3. TERM
This Agreement is effective from January 1, 2026 until December 31, 2026.
    `.trim();

    const new_doc = `
SERVICE AGREEMENT

This Agreement is made between OpenMemory Inc. ("Company") and Beta LLC ("Client").

1. SERVICES
The Company may provide software services to the Client.

2. PAYMENT
The Client shall pay $7,500 per month, due on the 15th of each month.
Payment shall be made within 45 days of invoice.

3. TERM
This Agreement is effective from March 1, 2026 until December 31, 2027.
    `.trim();

    const redline = generate_redline(old_doc, new_doc);

    console.log(` -> Total changes: ${redline.summary.total_changes}`);
    console.log(` -> By category:`);
    for (const [cat, count] of Object.entries(redline.summary.by_category)) {
        if (count > 0) {
            console.log(`    - ${cat}: ${count}`);
        }
    }
    console.log(` -> Severity: ${redline.summary.severity}`);

    assert.ok(redline.summary.by_category.financial > 0, "Should detect financial changes");
    assert.ok(redline.summary.by_category.date > 0, "Should detect date changes");
    assert.ok(redline.summary.by_category.party > 0, "Should detect party changes");
    assert.ok(redline.summary.by_category.legal_term > 0, "Should detect legal term changes");

    console.log(" -> PASS: Complex document diff works");
}

async function run_all() {
    try {
        test_word_diff_basic();
        test_financial_classification();
        test_date_classification();
        test_party_classification();
        test_legal_term_classification();
        test_severity_calculation();
        test_redline_html_generation();
        test_change_narrative();
        test_complex_document_diff();

        console.log("\n[REDLINE TESTS] ALL PASSED ✓");
        process.exit(0);
    } catch (e) {
        console.error("\n[REDLINE TESTS] FAILED:", e);
        process.exit(1);
    }
}

run_all();
