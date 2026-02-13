/**
 * Structured Metadata Extraction API Routes (D3)
 *
 * Provides endpoints for extracting and validating structured metadata.
 */

import {
    extractStructuredMetadata,
    validateMetadata,
    detectDocumentType,
    mergeMetadata,
    type DocumentType,
} from "../../core/structured_extraction";
import { q } from "../../core/db";
import { audit_log } from "../../core/audit";

export function extraction(app: any) {
    /**
     * POST /extract/metadata
     *
     * Extract structured metadata from text.
     * Returns typed, validated metadata based on document type.
     */
    app.post("/extract/metadata", async (req: any, res: any) => {
        try {
            const { text, doc_type } = req.body || {};

            if (!text) {
                return res.status(400).json({ err: "missing_text" });
            }

            const result = extractStructuredMetadata(text, doc_type as DocumentType);

            res.json({
                ok: true,
                detected_type: result.metadata.doc_type,
                metadata: result.metadata,
                validation_errors: result.validation_errors,
                has_errors: result.validation_errors.length > 0,
            });
        } catch (e: any) {
            console.error("[extraction] metadata extraction failed:", e);
            res.status(500).json({ err: "extraction_failed" });
        }
    });

    /**
     * POST /extract/detect-type
     *
     * Detect document type from text content.
     */
    app.post("/extract/detect-type", async (req: any, res: any) => {
        try {
            const { text } = req.body || {};

            if (!text) {
                return res.status(400).json({ err: "missing_text" });
            }

            const doc_type = detectDocumentType(text);

            res.json({
                ok: true,
                doc_type,
            });
        } catch (e: any) {
            console.error("[extraction] type detection failed:", e);
            res.status(500).json({ err: "detection_failed" });
        }
    });

    /**
     * POST /extract/validate
     *
     * Validate existing metadata against the schema for a document type.
     */
    app.post("/extract/validate", async (req: any, res: any) => {
        try {
            const { metadata, doc_type } = req.body || {};

            if (!metadata) {
                return res.status(400).json({ err: "missing_metadata" });
            }

            const result = validateMetadata(metadata, doc_type as DocumentType);

            res.json({
                ok: true,
                valid: result.valid,
                errors: result.errors,
            });
        } catch (e: any) {
            console.error("[extraction] validation failed:", e);
            res.status(500).json({ err: "validation_failed" });
        }
    });

    /**
     * POST /memory/:id/extract
     *
     * Extract metadata from a memory's content and merge with existing metadata.
     * Optionally updates the memory with the merged metadata.
     */
    app.post("/memory/:id/extract", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { update = false, user_id } = req.body || {};

            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            // Check ownership if provided
            if (user_id && mem.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            // Extract from content
            const extraction = extractStructuredMetadata(mem.content);

            // Parse existing metadata
            const existing_meta = typeof mem.meta === "string"
                ? JSON.parse(mem.meta || "{}")
                : (mem.meta || {});

            // Merge
            const merged = mergeMetadata(existing_meta, extraction.metadata);

            // Update memory if requested
            if (update) {
                await q.upd_mem.run(
                    mem.content,
                    mem.tags,
                    JSON.stringify(merged),
                    Date.now(),
                    id
                );

                // Audit log
                audit_log("memory", id, "update", {
                    actor_id: user_id || mem.user_id,
                    changes: {
                        metadata: { from: existing_meta, to: merged },
                    },
                    metadata: { action: "metadata_extraction" },
                }).catch(e => console.error("[audit] log failed:", e));
            }

            res.json({
                ok: true,
                memory_id: id,
                extracted: extraction.metadata,
                merged,
                validation_errors: extraction.validation_errors,
                updated: update,
            });
        } catch (e: any) {
            console.error("[extraction] memory extraction failed:", e);
            res.status(500).json({ err: "extraction_failed" });
        }
    });

    /**
     * GET /extract/schemas
     *
     * Get information about available extraction schemas.
     */
    app.get("/extract/schemas", async (_req: any, res: any) => {
        try {
            res.json({
                document_types: [
                    {
                        type: "agreement",
                        description: "Contracts and agreements",
                        fields: ["parties", "effective_date", "expiration_date", "signing_date", "governing_law", "jurisdiction", "contract_value", "term_length", "termination_notice_days"],
                    },
                    {
                        type: "contract",
                        description: "Same as agreement",
                        fields: ["parties", "effective_date", "expiration_date", "signing_date", "governing_law", "jurisdiction", "contract_value", "term_length", "termination_notice_days"],
                    },
                    {
                        type: "invoice",
                        description: "Bills and invoices",
                        fields: ["invoice_number", "invoice_date", "due_date", "vendor", "customer", "total_amount", "tax_amount", "line_items"],
                    },
                    {
                        type: "legal_filing",
                        description: "Court filings and legal documents",
                        fields: ["case_number", "court", "judge", "filing_date", "parties", "document_type", "matter"],
                    },
                    {
                        type: "correspondence",
                        description: "Letters and emails",
                        fields: ["from", "to", "cc", "subject", "date", "is_reply", "reference_number"],
                    },
                    {
                        type: "unknown",
                        description: "Generic document",
                        fields: ["keywords", "summary", "sections"],
                    },
                ],
                base_fields: ["doc_type", "title", "author", "created_date", "language", "word_count", "confidence"],
            });
        } catch (e: any) {
            console.error("[extraction] schemas failed:", e);
            res.status(500).json({ err: "schemas_failed" });
        }
    });
}
