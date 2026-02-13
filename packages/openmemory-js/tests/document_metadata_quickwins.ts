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
    assert.equal(metadata.effective_date, "2026-02-01T00:00:00.000Z");
    assert.equal(metadata.signing_date, "2026-01-25T00:00:00.000Z");
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
