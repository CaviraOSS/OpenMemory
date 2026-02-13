/**
 * Clause Similarity API Routes (D8)
 *
 * Provides endpoints for clause segmentation and similarity search.
 */

import {
    segment_into_clauses,
    store_clauses,
    find_similar_clauses,
    get_clauses_for_memory,
    delete_clauses_for_memory,
    get_clause_stats,
    type ClauseType,
} from "../../core/clause_similarity";
import { q } from "../../core/db";
import { audit_log } from "../../core/audit";

export function clauses(app: any) {
    /**
     * GET /memory/:id/clauses
     *
     * Get all clauses for a memory.
     */
    app.get("/memory/:id/clauses", async (req: any, res: any) => {
        try {
            const { id } = req.params;

            // Check memory exists
            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            const clauses = await get_clauses_for_memory(id);

            res.json({
                memory_id: id,
                count: clauses.length,
                clauses: clauses.map(c => ({
                    id: c.id,
                    clause_number: c.clause_number,
                    clause_type: c.clause_type,
                    heading: c.heading,
                    word_count: c.word_count,
                    content_preview: c.content.substring(0, 200) + (c.content.length > 200 ? "..." : ""),
                })),
            });
        } catch (e: any) {
            console.error("[clauses] get clauses failed:", e);
            res.status(500).json({ err: "clause_retrieval_failed" });
        }
    });

    /**
     * GET /memory/:id/clauses/:clause_id
     *
     * Get a specific clause with full content.
     */
    app.get("/memory/:id/clauses/:clause_id", async (req: any, res: any) => {
        try {
            const { id, clause_id } = req.params;

            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            const clauses = await get_clauses_for_memory(id);
            const clause = clauses.find(c => c.id === clause_id);

            if (!clause) {
                return res.status(404).json({ err: "clause_not_found" });
            }

            res.json(clause);
        } catch (e: any) {
            console.error("[clauses] get clause failed:", e);
            res.status(500).json({ err: "clause_retrieval_failed" });
        }
    });

    /**
     * POST /memory/:id/clauses/segment
     *
     * Segment a memory into clauses and store them.
     */
    app.post("/memory/:id/clauses/segment", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { user_id, replace = true } = req.body || {};

            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            // Check ownership
            if (user_id && mem.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            // Delete existing clauses if replacing
            if (replace) {
                await delete_clauses_for_memory(id);
            }

            // Segment and store
            const clauses = segment_into_clauses(mem.content, id);
            await store_clauses(clauses, user_id || mem.user_id);

            res.json({
                ok: true,
                memory_id: id,
                segmented: clauses.length,
                clauses: clauses.map(c => ({
                    id: c.id,
                    clause_number: c.clause_number,
                    clause_type: c.clause_type,
                    heading: c.heading,
                    word_count: c.word_count,
                })),
            });

            // Audit log
            audit_log("memory", id, "update", {
                actor_id: user_id || mem.user_id,
                metadata: { action: "clause_segmentation", count: clauses.length },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[clauses] segmentation failed:", e);
            res.status(500).json({ err: "segmentation_failed" });
        }
    });

    /**
     * POST /clauses/segment
     *
     * Segment arbitrary text into clauses without storing.
     * Useful for preview/analysis.
     */
    app.post("/clauses/segment", async (req: any, res: any) => {
        try {
            const { text } = req.body || {};

            if (!text) {
                return res.status(400).json({ err: "missing_text" });
            }

            const clauses = segment_into_clauses(text, "preview");

            res.json({
                count: clauses.length,
                clauses: clauses.map(c => ({
                    clause_number: c.clause_number,
                    clause_type: c.clause_type,
                    heading: c.heading,
                    word_count: c.word_count,
                    content: c.content,
                })),
                by_type: clauses.reduce((acc, c) => {
                    acc[c.clause_type] = (acc[c.clause_type] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>),
            });
        } catch (e: any) {
            console.error("[clauses] text segmentation failed:", e);
            res.status(500).json({ err: "segmentation_failed" });
        }
    });

    /**
     * POST /clauses/similar
     *
     * Find clauses similar to given text or clause.
     */
    app.post("/clauses/similar", async (req: any, res: any) => {
        try {
            const {
                text,
                clause_id,
                k = 10,
                threshold = 0.7,
                exclude_memory_id,
                clause_type,
                user_id,
            } = req.body || {};

            if (!text && !clause_id) {
                return res.status(400).json({ err: "missing_text_or_clause_id" });
            }

            let query: string;
            if (clause_id) {
                // Fetch clause content
                const clauses = await get_clauses_for_memory(clause_id.split("-")[0]);
                const clause = clauses.find(c => c.id === clause_id);
                if (!clause) {
                    return res.status(404).json({ err: "clause_not_found" });
                }
                query = clause.heading ? `${clause.heading}: ${clause.content}` : clause.content;
            } else {
                query = text;
            }

            const similar = await find_similar_clauses(query, {
                k,
                threshold,
                exclude_memory_id,
                clause_type: clause_type as ClauseType,
                user_id,
            });

            res.json({
                count: similar.length,
                threshold,
                similar: similar.map(s => ({
                    clause_id: s.clause_id,
                    memory_id: s.memory_id,
                    clause_number: s.clause_number,
                    clause_type: s.clause_type,
                    heading: s.heading,
                    similarity: Math.round(s.similarity * 100) / 100,
                    content_preview: s.content.substring(0, 300) + (s.content.length > 300 ? "..." : ""),
                })),
            });
        } catch (e: any) {
            console.error("[clauses] similarity search failed:", e);
            res.status(500).json({ err: "similarity_search_failed" });
        }
    });

    /**
     * GET /clauses/stats
     *
     * Get clause statistics.
     */
    app.get("/clauses/stats", async (req: any, res: any) => {
        try {
            const { memory_id } = req.query;
            const stats = await get_clause_stats(memory_id);

            res.json({
                memory_id: memory_id || null,
                ...stats,
            });
        } catch (e: any) {
            console.error("[clauses] stats failed:", e);
            res.status(500).json({ err: "stats_failed" });
        }
    });

    /**
     * DELETE /memory/:id/clauses
     *
     * Delete all clauses for a memory.
     */
    app.delete("/memory/:id/clauses", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { user_id } = req.body || {};

            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            // Check ownership
            if (user_id && mem.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            await delete_clauses_for_memory(id);

            res.json({
                ok: true,
                memory_id: id,
                message: "Clauses deleted",
            });

            // Audit log
            audit_log("memory", id, "update", {
                actor_id: user_id || mem.user_id,
                metadata: { action: "clause_deletion" },
            }).catch(e => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[clauses] deletion failed:", e);
            res.status(500).json({ err: "deletion_failed" });
        }
    });
}
