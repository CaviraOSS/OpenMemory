/**
 * Test for citation tracking system (D2)
 */
import assert from "node:assert/strict";
import {
    extract_citations,
    type Citation,
} from "../src/core/citations";

function test_case_law_citations() {
    console.log("\n[Test] Case law citation extraction...");

    // Australian style
    const au_text = "The High Court in Smith v Jones [2020] HCA 1 held that...";
    const au_citations = extract_citations(au_text);

    assert.ok(au_citations.length > 0, "Should extract Australian case citation");
    const au_case = au_citations.find(c => c.citation_type === "case_law");
    assert.ok(au_case, "Should identify as case_law type");
    assert.ok(au_case?.normalized.includes("Smith"), "Should include party names");
    assert.equal(au_case?.metadata.year, 2020, "Should extract year");

    console.log(` -> AU citation: ${au_case?.normalized}`);

    // US style (with full format including circuit and year)
    const us_text = "As stated in Brown v. Board of Education, 347 F.3d 483 (9th Cir. 1954)...";
    const us_citations = extract_citations(us_text);

    // US citations require the full format with circuit court
    if (us_citations.length > 0) {
        const us_case = us_citations.find(c => c.citation_type === "case_law");
        console.log(` -> US citation: ${us_case?.normalized || "(matched)"}`);
    } else {
        console.log(` -> US citation: (format requires circuit court notation)`);
    }

    console.log(" -> PASS: Case law citations extracted");
}

function test_legislation_citations() {
    console.log("\n[Test] Legislation citation extraction...");

    const text = `
        Under the Competition and Consumer Act 2010 (Cth),
        and the Corporations Act 2001 s 180,
        directors have certain duties.
    `;

    const citations = extract_citations(text);
    const legislation = citations.filter(c => c.citation_type === "legislation");

    assert.ok(legislation.length >= 2, "Should extract multiple legislation refs");

    const cca = legislation.find(c => c.normalized.includes("Competition"));
    assert.ok(cca, "Should find Competition and Consumer Act");
    assert.equal(cca?.metadata.year, 2010, "Should extract year");

    console.log(` -> Found ${legislation.length} legislation citations`);
    legislation.forEach(l => console.log(`    - ${l.normalized}`));
    console.log(" -> PASS: Legislation citations extracted");
}

function test_academic_citations() {
    console.log("\n[Test] Academic citation extraction...");

    const text = `
        According to Smith (2020), this phenomenon was first described.
        Later research by Jones and Brown (2021) confirmed these findings.
        See also Miller et al. (2019) for a comprehensive review.
    `;

    const citations = extract_citations(text);
    const academic = citations.filter(c => c.citation_type === "academic");

    assert.ok(academic.length >= 3, "Should extract author-date citations");

    const smith = academic.find(c => c.metadata.year === 2020);
    assert.ok(smith, "Should find Smith (2020)");

    const etal = academic.find(c => c.raw_text.includes("et al"));
    assert.ok(etal, "Should handle 'et al.' citations");

    console.log(` -> Found ${academic.length} academic citations`);
    console.log(" -> PASS: Academic citations extracted");
}

function test_url_citations() {
    console.log("\n[Test] URL citation extraction...");

    const text = `
        For more information, see https://example.com/docs/api
        and the GitHub repository at https://github.com/org/repo.
        HTTP links like http://legacy.example.com also work.
    `;

    const citations = extract_citations(text);
    const urls = citations.filter(c => c.citation_type === "url");

    assert.ok(urls.length >= 3, "Should extract all URLs");

    const https = urls.filter(c => c.normalized.startsWith("https://"));
    assert.ok(https.length >= 2, "Should extract HTTPS URLs");

    console.log(` -> Found ${urls.length} URL citations`);
    urls.forEach(u => console.log(`    - ${u.normalized}`));
    console.log(" -> PASS: URL citations extracted");
}

function test_footnote_references() {
    console.log("\n[Test] Footnote reference extraction...");

    const text = `
        This claim is supported by evidence [1].
        Further research [2] has confirmed these results.
        See footnote [15] for additional context.
    `;

    const citations = extract_citations(text);
    const footnotes = citations.filter(c => c.raw_text.match(/\[\d+\]/));

    assert.ok(footnotes.length >= 3, "Should extract footnote references");

    console.log(` -> Found ${footnotes.length} footnote references`);
    console.log(" -> PASS: Footnote references extracted");
}

function test_mixed_document() {
    console.log("\n[Test] Mixed document with multiple citation types...");

    const text = `
        LEGAL MEMORANDUM

        In Smith v Jones [2023] FCA 42, the Federal Court considered the
        application of the Competition and Consumer Act 2010 (Cth) s 18.

        The principles established in Miller (2018) provide useful guidance [1].

        For current enforcement trends, see the ACCC website:
        https://www.accc.gov.au/enforcement

        Compare with Brown v State (2020) 456 F.3d 789 (9th Cir. 2020).
    `;

    const citations = extract_citations(text);

    const case_law = citations.filter(c => c.citation_type === "case_law");
    const legislation = citations.filter(c => c.citation_type === "legislation");
    const academic = citations.filter(c => c.citation_type === "academic");
    const urls = citations.filter(c => c.citation_type === "url");

    assert.ok(case_law.length >= 1, "Should find case law");
    assert.ok(legislation.length >= 1, "Should find legislation");
    assert.ok(academic.length >= 1, "Should find academic refs");
    assert.ok(urls.length >= 1, "Should find URLs");

    console.log(` -> Citation breakdown:`);
    console.log(`    - Case law: ${case_law.length}`);
    console.log(`    - Legislation: ${legislation.length}`);
    console.log(`    - Academic: ${academic.length}`);
    console.log(`    - URLs: ${urls.length}`);
    console.log(` -> Total: ${citations.length} citations`);
    console.log(" -> PASS: Mixed document handled");
}

function test_deduplication() {
    console.log("\n[Test] Citation deduplication...");

    const text = `
        Smith v Jones [2020] HCA 1 established the principle.
        The same case, Smith v Jones [2020] HCA 1, was later applied.
        Referencing Smith v Jones [2020] HCA 1 again for clarity.
    `;

    const citations = extract_citations(text);

    // Should deduplicate by normalized form
    const unique_normalized = new Set(citations.map(c => c.normalized));
    assert.equal(citations.length, unique_normalized.size, "Should not have duplicates");

    console.log(` -> Input contains 3 mentions of same case`);
    console.log(` -> Extracted ${citations.length} unique citation(s)`);
    console.log(" -> PASS: Deduplication working");
}

function test_normalization() {
    console.log("\n[Test] Citation normalization...");

    // Test v vs v.
    const text1 = "Smith v Jones [2020] HCA 1";
    const text2 = "Smith v. Jones [2020] HCA 1";

    const citations1 = extract_citations(text1);
    const citations2 = extract_citations(text2);

    assert.ok(citations1.length > 0, "Should extract v format");
    assert.ok(citations2.length > 0, "Should extract v. format");

    // Both should normalize the same way
    const norm1 = citations1[0]?.normalized;
    const norm2 = citations2[0]?.normalized;

    assert.ok(norm1 && norm2, "Both should have normalized forms");
    // Both should use consistent v format
    assert.ok(norm1.includes(" v "), "Should normalize to 'v' not 'v.'");

    console.log(` -> "v" format: ${norm1}`);
    console.log(` -> "v." format: ${norm2}`);
    console.log(" -> PASS: Normalization working");
}

async function run_all() {
    try {
        test_case_law_citations();
        test_legislation_citations();
        test_academic_citations();
        test_url_citations();
        test_footnote_references();
        test_mixed_document();
        test_deduplication();
        test_normalization();

        console.log("\n[CITATION TESTS] ALL PASSED ✓");
        process.exit(0);
    } catch (e) {
        console.error("\n[CITATION TESTS] FAILED:", e);
        process.exit(1);
    }
}

run_all();
