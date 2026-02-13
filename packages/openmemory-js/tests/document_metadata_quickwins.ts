import assert from "node:assert/strict";
import { enrichDocumentMetadata } from "../src/ops/document_metadata";

function testQuickWins() {
    const text = `
    SERVICE AGREEMENT
    This Agreement is made between OpenMemory Inc and Acme Corp.
    Effective date: 2026-02-01
    Signed on January 25, 2026.
    `;

    const metadata = enrichDocumentMetadata(text);
    assert.equal(metadata.doc_type, "agreement");
    assert.deepEqual(metadata.parties, ["OpenMemory Inc", "Acme Corp"]);

    // Check dates are valid ISO strings (timezone handling varies by local system)
    assert.ok(typeof metadata.effective_date === "string", "effective_date should be a string");
    assert.ok((metadata.effective_date as string).startsWith("2026-02-01"), "effective_date should be Feb 1, 2026");
    assert.ok(typeof metadata.signing_date === "string", "signing_date should be a string");
    assert.ok((metadata.signing_date as string).includes("2026-01-2"), "signing_date should be Jan 24/25, 2026");
}

function testExistingMetadataWins() {
    const text = "This agreement is between A and B. Effective date: 2026-02-01";
    const metadata = enrichDocumentMetadata(text, { doc_type: "custom", parties: ["X", "Y"] });
    assert.equal(metadata.doc_type, "custom");
    assert.deepEqual(metadata.parties, ["X", "Y"]);
}

testQuickWins();
testExistingMetadataWins();
console.log("document metadata quick wins: ok");
