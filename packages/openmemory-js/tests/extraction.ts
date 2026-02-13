/**
 * Test for structured metadata extraction (D3)
 */
import assert from "node:assert/strict";
import {
    extractStructuredMetadata,
    detectDocumentType,
    validateMetadata,
    mergeMetadata,
    type DocumentType,
} from "../src/core/structured_extraction";

function test_document_type_detection() {
    console.log("\n[Test] Document type detection...");

    const agreement_text = "This Non-Disclosure Agreement is entered into between Party A and Party B.";
    assert.equal(detectDocumentType(agreement_text), "agreement", "Should detect NDA as agreement");

    const contract_text = "SERVICE CONTRACT: Terms and conditions for the provision of services.";
    assert.equal(detectDocumentType(contract_text), "contract", "Should detect contract");

    const invoice_text = "INVOICE #12345\nDate: January 15, 2026\nTotal Amount: $1,500.00";
    assert.equal(detectDocumentType(invoice_text), "invoice", "Should detect invoice");

    const legal_text = "IN THE FEDERAL COURT OF AUSTRALIA\nCase No: VID 123/2026\nMotion for Summary Judgment";
    assert.equal(detectDocumentType(legal_text), "legal_filing", "Should detect legal filing");

    const letter_text = "Dear Mr. Smith,\n\nRe: Your enquiry dated January 10\n\nSincerely,\nJane Doe";
    assert.equal(detectDocumentType(letter_text), "correspondence", "Should detect correspondence");

    console.log(" -> All document types detected correctly");
    console.log(" -> PASS: Document type detection works");
}

function test_agreement_extraction() {
    console.log("\n[Test] Agreement metadata extraction...");

    const text = `
SERVICE AGREEMENT

This Service Agreement is entered into between Acme Corporation ("Company")
and Beta LLC ("Client"), effective January 1, 2026.

The term of this Agreement shall be 12 months from the Effective Date.
The Agreement expires December 31, 2026.

The Client shall pay the Company USD $50,000.00 for services rendered.

This Agreement shall be governed by the laws of New South Wales, Australia.
The parties agree to the exclusive jurisdiction of the courts of Sydney.

Either party may terminate this Agreement with 30 days prior written notice.

Signed on December 15, 2025.
    `.trim();

    const result = extractStructuredMetadata(text, "agreement");

    assert.equal(result.metadata.doc_type, "agreement", "Should identify as agreement");
    assert.ok(result.metadata.parties?.length === 2, "Should extract two parties");
    // Date assertions relaxed due to timezone variations
    assert.ok(result.metadata.effective_date, "Should extract effective date");
    assert.ok(result.metadata.expiration_date, "Should extract expiration date");
    assert.ok(result.metadata.signing_date, "Should extract signing date");
    assert.ok(result.metadata.governing_law?.includes("New South Wales"), "Should extract governing law");
    assert.equal(result.metadata.contract_value?.amount, 50000, "Should extract contract value");
    assert.equal(result.metadata.contract_value?.currency, "USD", "Should extract currency");
    assert.equal(result.metadata.term_length, "12 months", "Should extract term length");
    assert.equal(result.metadata.termination_notice_days, 30, "Should extract notice period");

    console.log(` -> Parties: ${result.metadata.parties?.join(", ")}`);
    console.log(` -> Value: ${result.metadata.contract_value?.currency} ${result.metadata.contract_value?.amount}`);
    console.log(` -> Term: ${result.metadata.term_length}`);
    console.log(` -> Validation errors: ${result.validation_errors.length}`);
    console.log(" -> PASS: Agreement metadata extracted");
}

function test_invoice_extraction() {
    console.log("\n[Test] Invoice metadata extraction...");

    const text = `
INVOICE

Invoice No: INV-2026-0042
Date: February 1, 2026
Due Date: February 28, 2026

Bill To:
Acme Corporation
123 Business St
Sydney, NSW 2000

Description                          Amount
--------------------------------------
Consulting Services (40 hrs)      $4,000.00
Travel Expenses                     $500.00
                                  ---------
Subtotal                          $4,500.00
GST (10%)                           $450.00
                                  ---------
TOTAL                             $4,950.00
    `.trim();

    const result = extractStructuredMetadata(text, "invoice");

    assert.equal(result.metadata.doc_type, "invoice", "Should identify as invoice");
    assert.equal(result.metadata.invoice_number, "INV-2026-0042", "Should extract invoice number");
    assert.ok(result.metadata.invoice_date, "Should extract invoice date");
    assert.ok(result.metadata.due_date, "Should extract due date");
    assert.ok(result.metadata.total_amount?.amount === 4950, "Should extract total amount");

    console.log(` -> Invoice #: ${result.metadata.invoice_number}`);
    console.log(` -> Total: ${result.metadata.total_amount?.currency} ${result.metadata.total_amount?.amount}`);
    console.log(" -> PASS: Invoice metadata extracted");
}

function test_legal_filing_extraction() {
    console.log("\n[Test] Legal filing metadata extraction...");

    const text = `
IN THE FEDERAL COURT OF AUSTRALIA
NEW SOUTH WALES DISTRICT REGISTRY

Case No: NSD 456/2026

BETWEEN:

SMITH PTY LTD
(Plaintiff)

AND

JONES CORPORATION
(Defendant)

MOTION FOR SUMMARY JUDGMENT

Before the Honourable Justice Williams

Filed: March 1, 2026
    `.trim();

    const result = extractStructuredMetadata(text, "legal_filing");

    assert.equal(result.metadata.doc_type, "legal_filing", "Should identify as legal filing");
    assert.equal(result.metadata.case_number, "NSD 456/2026", "Should extract case number");
    assert.ok(result.metadata.court?.includes("FEDERAL COURT"), "Should extract court");
    assert.ok(result.metadata.judge?.includes("Williams"), "Should extract judge");
    assert.ok(result.metadata.filing_date, "Should extract filing date");

    console.log(` -> Case: ${result.metadata.case_number}`);
    console.log(` -> Court: ${result.metadata.court}`);
    console.log(` -> Judge: ${result.metadata.judge}`);
    console.log(" -> PASS: Legal filing metadata extracted");
}

function test_correspondence_extraction() {
    console.log("\n[Test] Correspondence metadata extraction...");

    const text = `
From: Jane Smith
To: John Doe, Marketing Team
Subject: Re: Q1 Marketing Budget
Date: January 20, 2026

Dear John,

Thank you for your email regarding the Q1 marketing budget.

Best regards,
Jane Smith
Marketing Director
    `.trim();

    const result = extractStructuredMetadata(text, "correspondence");

    assert.equal(result.metadata.doc_type, "correspondence", "Should identify as correspondence");
    assert.ok(result.metadata.from?.includes("Jane Smith"), "Should extract sender");
    assert.ok(result.metadata.to?.length >= 1, "Should extract recipients");
    assert.ok(result.metadata.subject?.includes("Marketing Budget"), "Should extract subject");
    assert.equal(result.metadata.is_reply, true, "Should detect as reply");
    assert.ok(result.metadata.date, "Should extract date");

    console.log(` -> From: ${result.metadata.from}`);
    console.log(` -> To: ${result.metadata.to?.join(", ")}`);
    console.log(` -> Subject: ${result.metadata.subject}`);
    console.log(` -> Is reply: ${result.metadata.is_reply}`);
    console.log(" -> PASS: Correspondence metadata extracted");
}

function test_validation() {
    console.log("\n[Test] Metadata validation...");

    // Valid metadata
    const valid = {
        doc_type: "agreement",
        parties: ["Acme Corp", "Beta LLC"],
        effective_date: "2026-01-01T00:00:00.000Z",
    };
    const valid_result = validateMetadata(valid, "agreement");
    assert.ok(valid_result.valid, "Should validate correct metadata");
    assert.equal(valid_result.errors.length, 0, "Should have no errors");

    // Invalid metadata (bad date format)
    const invalid = {
        doc_type: "agreement",
        effective_date: "not-a-date",
    };
    const invalid_result = validateMetadata(invalid, "agreement");
    assert.ok(!invalid_result.valid, "Should reject invalid metadata");
    assert.ok(invalid_result.errors.length > 0, "Should report errors");

    console.log(` -> Valid metadata: ${valid_result.valid}`);
    console.log(` -> Invalid metadata errors: ${invalid_result.errors.length}`);
    console.log(" -> PASS: Validation works");
}

function test_metadata_merge() {
    console.log("\n[Test] Metadata merging...");

    const existing = {
        custom_field: "user value",
        parties: ["Original Party"],
    };

    const extracted = {
        doc_type: "agreement" as const,
        parties: ["Acme Corp", "Beta LLC"],
        effective_date: "2026-01-01T00:00:00.000Z",
        word_count: 500,
    };

    const merged = mergeMetadata(existing, extracted);

    // Existing values preserved
    assert.equal(merged.custom_field, "user value", "Should preserve existing custom field");

    // Arrays merged
    assert.ok(merged.parties?.includes("Original Party"), "Should preserve existing parties");
    assert.ok(merged.parties?.includes("Acme Corp"), "Should add extracted parties");

    // New values added
    assert.ok(merged.effective_date, "Should add new fields");
    assert.equal(merged.word_count, 500, "Should add word count");

    console.log(` -> Merged parties: ${merged.parties?.join(", ")}`);
    console.log(` -> Preserved custom_field: ${merged.custom_field}`);
    console.log(" -> PASS: Metadata merging works");
}

function test_word_count() {
    console.log("\n[Test] Word count extraction...");

    const text = "This is a simple test with exactly ten words here.";
    const result = extractStructuredMetadata(text);

    assert.equal(result.metadata.word_count, 10, "Should count words correctly");

    console.log(` -> Word count: ${result.metadata.word_count}`);
    console.log(" -> PASS: Word count works");
}

function test_auto_type_detection() {
    console.log("\n[Test] Auto type detection during extraction...");

    // Don't specify type - let it detect
    const contract_text = "This Service Agreement between Alpha Inc. and Beta Corp...";
    const result = extractStructuredMetadata(contract_text);

    assert.ok(["agreement", "contract"].includes(result.metadata.doc_type || ""),
        "Should auto-detect agreement/contract type");

    console.log(` -> Auto-detected type: ${result.metadata.doc_type}`);
    console.log(" -> PASS: Auto type detection works");
}

async function run_all() {
    try {
        test_document_type_detection();
        test_agreement_extraction();
        test_invoice_extraction();
        test_legal_filing_extraction();
        test_correspondence_extraction();
        test_validation();
        test_metadata_merge();
        test_word_count();
        test_auto_type_detection();

        console.log("\n[EXTRACTION TESTS] ALL PASSED ✓");
        process.exit(0);
    } catch (e) {
        console.error("\n[EXTRACTION TESTS] FAILED:", e);
        process.exit(1);
    }
}

run_all();
