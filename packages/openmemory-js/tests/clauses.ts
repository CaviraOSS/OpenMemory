/**
 * Test for clause similarity detection (D8)
 */
import assert from "node:assert/strict";
import {
    segment_into_clauses,
} from "../src/core/clause_similarity";

function test_basic_segmentation() {
    console.log("\n[Test] Basic clause segmentation...");

    const text = `
SERVICE AGREEMENT

1. DEFINITIONS
In this Agreement, the following terms have the meanings set out below.

2. SERVICES
The Provider shall provide the services described in Schedule A.

3. PAYMENT
The Client shall pay the fees set out in Schedule B.

4. TERM
This Agreement commences on the Effective Date and continues for 12 months.

5. TERMINATION
Either party may terminate this Agreement with 30 days written notice.
    `.trim();

    const clauses = segment_into_clauses(text, "test-memory");

    assert.ok(clauses.length >= 5, `Should have at least 5 clauses, got ${clauses.length}`);

    // Check clause numbering
    const numbers = clauses.map(c => c.clause_number);
    assert.deepEqual(numbers, [...Array(clauses.length).keys()], "Clauses should be numbered sequentially");

    console.log(` -> Segmented into ${clauses.length} clauses`);
    clauses.forEach(c => console.log(`    - ${c.clause_number}: ${c.heading?.substring(0, 40) || "(no heading)"}`));
    console.log(" -> PASS: Basic segmentation works");
}

function test_clause_type_detection() {
    console.log("\n[Test] Clause type detection...");

    const text = `
1. DEFINITIONS
"Agreement" means this service agreement.
"Client" means the party receiving services.

2. CONFIDENTIALITY
Each party shall keep confidential all proprietary information.

3. INDEMNIFICATION
The Provider shall indemnify and hold harmless the Client.

4. LIMITATION OF LIABILITY
Neither party shall be liable for indirect or consequential damages.

5. TERMINATION
This Agreement may be terminated upon 30 days notice.

6. DISPUTE RESOLUTION
Any disputes shall be resolved through arbitration.
    `.trim();

    const clauses = segment_into_clauses(text, "test-memory");

    const types = clauses.map(c => c.clause_type);

    assert.ok(types.includes("definition"), "Should detect definition clause");
    assert.ok(types.includes("confidentiality"), "Should detect confidentiality clause");
    assert.ok(types.includes("indemnity"), "Should detect indemnity clause");
    assert.ok(types.includes("limitation_of_liability"), "Should detect limitation clause");
    assert.ok(types.includes("termination"), "Should detect termination clause");
    assert.ok(types.includes("dispute_resolution"), "Should detect dispute resolution clause");

    console.log(` -> Detected types: ${[...new Set(types)].join(", ")}`);
    console.log(" -> PASS: Clause type detection works");
}

function test_various_numbering_formats() {
    console.log("\n[Test] Various numbering formats...");

    const text = `
ARTICLE I - INTRODUCTION
This agreement is entered into between the parties.

A. SCOPE
The scope of this agreement includes all services.

1.1 Subsection One
Details of subsection one.

1.2 Subsection Two
Details of subsection two.

(a) First item
Content of first item.

(b) Second item
Content of second item.
    `.trim();

    const clauses = segment_into_clauses(text, "test-memory");

    assert.ok(clauses.length >= 4, "Should detect multiple numbering formats");

    console.log(` -> Found ${clauses.length} clauses with various formats`);
    clauses.forEach(c => console.log(`    - ${c.heading?.substring(0, 50) || "(no heading)"}`));
    console.log(" -> PASS: Various numbering formats detected");
}

function test_word_count() {
    console.log("\n[Test] Word count tracking...");

    const text = `
1. SHORT CLAUSE
This is a short clause with few words.

2. LONGER CLAUSE
This clause is intentionally longer and contains many more words to test
the word counting functionality. It should have a significantly higher
word count than the previous clause.
    `.trim();

    const clauses = segment_into_clauses(text, "test-memory");

    assert.ok(clauses.length >= 2, "Should have at least 2 clauses");
    assert.ok(clauses[0].word_count < clauses[1].word_count, "Second clause should have more words");

    console.log(` -> Clause 1 word count: ${clauses[0].word_count}`);
    console.log(` -> Clause 2 word count: ${clauses[1].word_count}`);
    console.log(" -> PASS: Word count tracking works");
}

function test_position_tracking() {
    console.log("\n[Test] Position tracking...");

    const text = `
1. FIRST CLAUSE
Content of the first clause.

2. SECOND CLAUSE
Content of the second clause.

3. THIRD CLAUSE
Content of the third clause.
    `.trim();

    const clauses = segment_into_clauses(text, "test-memory");

    // Check positions are sequential and non-overlapping
    for (let i = 0; i < clauses.length - 1; i++) {
        assert.ok(clauses[i].end_position < clauses[i + 1].start_position,
            "Clause positions should be sequential");
    }

    // First clause should start near the beginning
    assert.ok(clauses[0].start_position >= 0, "First clause should start at or after 0");

    console.log(` -> Position ranges:`);
    clauses.forEach(c => console.log(`    - Clause ${c.clause_number}: ${c.start_position}-${c.end_position}`));
    console.log(" -> PASS: Position tracking works");
}

function test_minimum_clause_length() {
    console.log("\n[Test] Minimum clause length filtering...");

    const text = `
1. VALID CLAUSE
This clause has enough content to be considered valid.

2.
Short

3. ANOTHER VALID CLAUSE
This is another clause with sufficient content.
    `.trim();

    const clauses = segment_into_clauses(text, "test-memory");

    // Very short clauses should be filtered out
    for (const clause of clauses) {
        assert.ok(clause.content.length > 20, "All clauses should have minimum length");
    }

    console.log(` -> ${clauses.length} clauses after filtering (short ones removed)`);
    console.log(" -> PASS: Minimum length filtering works");
}

function test_complex_document() {
    console.log("\n[Test] Complex document segmentation...");

    const text = `
PROFESSIONAL SERVICES AGREEMENT

RECITALS

WHEREAS, Company desires to engage Consultant to provide certain services;
WHEREAS, Consultant is willing to provide such services;

NOW, THEREFORE, the parties agree as follows:

ARTICLE I - DEFINITIONS

1.1 "Agreement" means this Professional Services Agreement.
1.2 "Confidential Information" means all non-public information.
1.3 "Services" means the services described in Exhibit A.

ARTICLE II - SERVICES

2.1 Engagement
Consultant shall provide the Services to Company during the Term.

2.2 Standard of Performance
Consultant shall perform the Services in a professional manner.

ARTICLE III - COMPENSATION

3.1 Fees
Company shall pay Consultant the fees set forth in Exhibit B.

3.2 Expenses
Company shall reimburse Consultant for reasonable expenses.

ARTICLE IV - CONFIDENTIALITY

4.1 Confidential Information
Each party agrees to maintain the confidentiality of proprietary information.

4.2 Permitted Disclosures
Confidential Information may be disclosed as required by law.

ARTICLE V - TERMINATION

5.1 Termination for Convenience
Either party may terminate this Agreement upon 30 days written notice.

5.2 Effect of Termination
Upon termination, Consultant shall return all Company materials.

ARTICLE VI - INDEMNIFICATION

6.1 Consultant Indemnification
Consultant shall indemnify Company against claims arising from negligence.

6.2 Company Indemnification
Company shall indemnify Consultant against claims arising from Company's acts.

ARTICLE VII - LIMITATION OF LIABILITY

7.1 Limitation
Neither party shall be liable for indirect or consequential damages.

7.2 Cap
Total liability shall not exceed the fees paid under this Agreement.

ARTICLE VIII - DISPUTE RESOLUTION

8.1 Negotiation
The parties shall first attempt to resolve disputes through negotiation.

8.2 Mediation
If negotiation fails, the parties shall proceed to mediation.

8.3 Arbitration
If mediation fails, disputes shall be resolved through binding arbitration.

ARTICLE IX - GENERAL PROVISIONS

9.1 Governing Law
This Agreement shall be governed by the laws of California.

9.2 Entire Agreement
This Agreement constitutes the entire agreement between the parties.
    `.trim();

    const clauses = segment_into_clauses(text, "test-memory");

    assert.ok(clauses.length >= 8, `Should have multiple clauses, got ${clauses.length}`);

    // Check various types are present
    const types = new Set(clauses.map(c => c.clause_type));
    console.log(` -> Found ${clauses.length} clauses`);
    console.log(` -> Types present: ${[...types].join(", ")}`);

    // Check at least some key types are detected
    assert.ok(types.has("confidentiality"), "Should have confidentiality clauses");
    assert.ok(types.has("termination"), "Should have termination clauses");
    assert.ok(types.has("indemnity"), "Should have indemnity clauses");
    assert.ok(types.has("dispute_resolution"), "Should have dispute resolution clauses");

    console.log(" -> PASS: Complex document handled");
}

async function run_all() {
    try {
        test_basic_segmentation();
        test_clause_type_detection();
        test_various_numbering_formats();
        test_word_count();
        test_position_tracking();
        test_minimum_clause_length();
        test_complex_document();

        console.log("\n[CLAUSE TESTS] ALL PASSED ✓");
        process.exit(0);
    } catch (e) {
        console.error("\n[CLAUSE TESTS] FAILED:", e);
        process.exit(1);
    }
}

run_all();
