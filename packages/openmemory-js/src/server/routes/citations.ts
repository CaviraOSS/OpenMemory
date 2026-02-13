/**
 * Citation Tracking API Routes (D2)
 *
 * Provides endpoints for citation extraction, retrieval, and reverse-lookup.
 */

import {
    extract_citations,
    store_citations,
    get_citations_for_memory,
    find_memories_by_citation,
    get_citation_stats,
    delete_citations_for_memory,
    type CitationType,
} from "../../core/citations";
import { q } from "../../core/db";
import { audit_log } from "../../core/audit";

export function citations(app: any) {
    /**
     * GET /memory/:id/citations
     *
     * Get all citations extracted from a memory.
     */
    app.get("/memory/:id/citations", async (req: any, res: any) => {
        try {
            const { id } = req.params;

            // Check memory exists
            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            const citations = await get_citations_for_memory(id);

            res.json({
                memory_id: id,
                count: citations.length,
                citations,
            });
        } catch (e: any) {
            console.error("[citations] get citations failed:", e);
            res.status(500).json({ err: "citation_retrieval_failed" });
        }
    });

    /**
     * POST /memory/:id/citations/extract
     *
     * Extract and store citations from a memory's content.
     * This can be called manually or happens automatically on ingest.
     */
    app.post("/memory/:id/citations/extract", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { user_id } = req.body || {};

            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            // Check ownership if provided
            if (user_id && mem.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            // Extract citations from content
            const citations = extract_citations(mem.content, id);

            // Store them
            await store_citations(id, citations, mem.content);

            res.json({
                ok: true,
                memory_id: id,
                extracted: citations.length,
                citations: citations.map(c => ({
                    id: c.id,
                    raw_text: c.raw_text,
                    normalized: c.normalized,
                    citation_type: c.citation_type,
                })),
            });

            // Audit log
            audit_log("memory", id, "update", {
                actor_id: user_id || mem.user_id,
                metadata: { action: "citation_extraction", count: citations.length },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[citations] extraction failed:", e);
            res.status(500).json({ err: "citation_extraction_failed" });
        }
    });

    /**
     * GET /citations/search
     *
     * Search for memories that cite a specific reference.
     * Supports partial matching and type filtering.
     */
    app.get("/citations/search", async (req: any, res: any) => {
        try {
            const { citation, type } = req.query;

            if (!citation) {
                return res.status(400).json({ err: "missing_citation_query" });
            }

            const citation_type = type as CitationType | undefined;
            const memories = await find_memories_by_citation(citation, citation_type);

            res.json({
                query: citation,
                type: type || "all",
                count: memories.length,
                memories,
            });
        } catch (e: any) {
            console.error("[citations] search failed:", e);
            res.status(500).json({ err: "citation_search_failed" });
        }
    });

    /**
     * GET /citations/stats
     *
     * Get citation statistics, optionally for a specific memory.
     */
    app.get("/citations/stats", async (req: any, res: any) => {
        try {
            const { memory_id } = req.query;
            const stats = await get_citation_stats(memory_id);

            res.json({
                memory_id: memory_id || null,
                ...stats,
            });
        } catch (e: any) {
            console.error("[citations] stats failed:", e);
            res.status(500).json({ err: "citation_stats_failed" });
        }
    });

    /**
     * POST /citations/extract
     *
     * Extract citations from arbitrary text without storing.
     * Useful for preview/analysis.
     */
    app.post("/citations/extract", async (req: any, res: any) => {
        try {
            const { text } = req.body || {};

            if (!text) {
                return res.status(400).json({ err: "missing_text" });
            }

            const citations = extract_citations(text);

            res.json({
                count: citations.length,
                citations: citations.map(c => ({
                    raw_text: c.raw_text,
                    normalized: c.normalized,
                    citation_type: c.citation_type,
                    metadata: c.metadata,
                })),
                by_type: citations.reduce((acc, c) => {
                    acc[c.citation_type] = (acc[c.citation_type] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
            });
        } catch (e: any) {
            console.error("[citations] text extraction failed:", e);
            res.status(500).json({ err: "citation_extraction_failed" });
        }
    });

    /**
     * DELETE /memory/:id/citations
     *
     * Remove all citation links for a memory.
     * Used when memory content changes significantly or memory is deleted.
     */
    app.delete("/memory/:id/citations", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { user_id } = req.body || {};

            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            // Check ownership if provided
            if (user_id && mem.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            await delete_citations_for_memory(id);

            res.json({
                ok: true,
                memory_id: id,
                message: "Citations cleared",
            });

            // Audit log
            audit_log("memory", id, "update", {
                actor_id: user_id || mem.user_id,
                metadata: { action: "citation_deletion" },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[citations] deletion failed:", e);
            res.status(500).json({ err: "citation_deletion_failed" });
        }
    });
}
