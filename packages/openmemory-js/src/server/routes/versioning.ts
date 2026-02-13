/**
 * Document Versioning API Routes (D1)
 *
 * Provides endpoints for version history, comparison, and restoration.
 */

import { q } from "../../core/db";
import {
    get_versions,
    get_version,
    diff_versions,
    restore_version,
    count_versions,
    save_version,
    compute_diff,
    generate_change_summary,
} from "../../core/versioning";
import { audit_log } from "../../core/audit";
import {
    generate_redline,
    generate_change_narrative,
} from "../../core/redline";

export function versioning(app: any) {
    /**
     * GET /memory/:id/versions
     *
     * Get version history for a memory.
     */
    app.get("/memory/:id/versions", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const limit = req.query.limit
                ? Math.min(100, parseInt(req.query.limit, 10))
                : 50;

            // Check memory exists
            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            const [versions, total] = await Promise.all([
                get_versions(id, limit),
                count_versions(id),
            ]);

            // Include current version info
            res.json({
                memory_id: id,
                current_version: mem.version,
                total_versions: total,
                versions,
            });
        } catch (e: any) {
            console.error("[versioning] get versions failed:", e);
            res.status(500).json({ err: "versioning_failed" });
        }
    });

    /**
     * GET /memory/:id/versions/:version
     *
     * Get a specific version of a memory.
     */
    app.get("/memory/:id/versions/:version", async (req: any, res: any) => {
        try {
            const { id, version } = req.params;
            const version_number = parseInt(version, 10);

            if (isNaN(version_number)) {
                return res.status(400).json({ err: "invalid_version_number" });
            }

            const ver = await get_version(id, version_number);
            if (!ver) {
                return res.status(404).json({ err: "version_not_found" });
            }

            res.json(ver);
        } catch (e: any) {
            console.error("[versioning] get version failed:", e);
            res.status(500).json({ err: "versioning_failed" });
        }
    });

    /**
     * GET /memory/:id/diff/:version_a/:version_b
     *
     * Get diff between two versions.
     */
    app.get(
        "/memory/:id/diff/:version_a/:version_b",
        async (req: any, res: any) => {
            try {
                const { id, version_a, version_b } = req.params;
                const va = parseInt(version_a, 10);
                const vb = parseInt(version_b, 10);

                if (isNaN(va) || isNaN(vb)) {
                    return res.status(400).json({ err: "invalid_version_numbers" });
                }

                const diff = await diff_versions(id, va, vb);
                if (!diff) {
                    return res.status(404).json({ err: "versions_not_found" });
                }

                res.json({
                    memory_id: id,
                    ...diff,
                });
            } catch (e: any) {
                console.error("[versioning] diff failed:", e);
                res.status(500).json({ err: "diff_failed" });
            }
        }
    );

    /**
     * POST /memory/:id/version
     *
     * Create a version snapshot (manual checkpoint).
     */
    app.post("/memory/:id/version", async (req: any, res: any) => {
        try {
            const { id } = req.params;
            const { change_summary, user_id } = req.body || {};

            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            // Check user ownership if provided
            if (user_id && mem.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            const version_id = await save_version(
                id,
                mem.content,
                mem.tags,
                mem.meta,
                mem.primary_sector,
                mem.version,
                change_summary || `Manual snapshot at v${mem.version}`,
                user_id || mem.user_id
            );

            res.json({
                ok: true,
                version_id,
                version_number: mem.version,
            });

            // Audit log
            audit_log("memory", id, "version", {
                actor_id: user_id || mem.user_id,
                metadata: { version: mem.version, type: "manual_snapshot" },
            }).catch((e) => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[versioning] create snapshot failed:", e);
            res.status(500).json({ err: "snapshot_failed" });
        }
    });

    /**
     * POST /memory/:id/restore/:version
     *
     * Restore memory to a previous version.
     */
    app.post("/memory/:id/restore/:version", async (req: any, res: any) => {
        try {
            const { id, version } = req.params;
            const { user_id } = req.body || {};
            const version_number = parseInt(version, 10);

            if (isNaN(version_number)) {
                return res.status(400).json({ err: "invalid_version_number" });
            }

            const mem = await q.get_mem.get(id);
            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }

            // Check user ownership if provided
            if (user_id && mem.user_id !== user_id) {
                return res.status(403).json({ err: "forbidden" });
            }

            const result = await restore_version(id, version_number, user_id);

            res.json({
                ok: true,
                restored_from: version_number,
                new_version: result.new_version,
            });

            // Audit log
            audit_log("memory", id, "version", {
                actor_id: user_id || mem.user_id,
                changes: { restored_from: version_number },
                metadata: { type: "restore", new_version: result.new_version },
            }).catch((e) => console.error("[audit] log failed:", e));
        } catch (e: any) {
            console.error("[versioning] restore failed:", e);
            if (e.message.includes("not found")) {
                res.status(404).json({ err: "version_not_found" });
            } else {
                res.status(500).json({ err: "restore_failed" });
            }
        }
    });

    /**
     * GET /memory/:id/diff/current/:version
     *
     * Get diff between current memory state and a specific version.
     */
    app.get("/memory/:id/diff/current/:version", async (req: any, res: any) => {
        try {
            const { id, version } = req.params;
            const version_number = parseInt(version, 10);

            if (isNaN(version_number)) {
                return res.status(400).json({ err: "invalid_version_number" });
            }

            const [mem, ver] = await Promise.all([
                q.get_mem.get(id),
                get_version(id, version_number),
            ]);

            if (!mem) {
                return res.status(404).json({ err: "memory_not_found" });
            }
            if (!ver) {
                return res.status(404).json({ err: "version_not_found" });
            }

            const diff = compute_diff(ver.content, mem.content);

            res.json({
                memory_id: id,
                current_version: mem.version,
                compared_version: version_number,
                ...diff,
                summary: generate_change_summary(diff),
            });
        } catch (e: any) {
            console.error("[versioning] current diff failed:", e);
            res.status(500).json({ err: "diff_failed" });
        }
    });

    /**
     * GET /memory/:id/redline/:version_a/:version_b (D4)
     *
     * Get classified redline diff between two versions.
     * Returns word-level changes categorized by type (financial, date, party, legal_term, general).
     */
    app.get(
        "/memory/:id/redline/:version_a/:version_b",
        async (req: any, res: any) => {
            try {
                const { id, version_a, version_b } = req.params;
                const va = parseInt(version_a, 10);
                const vb = parseInt(version_b, 10);

                if (isNaN(va) || isNaN(vb)) {
                    return res.status(400).json({ err: "invalid_version_numbers" });
                }

                const [ver_a, ver_b] = await Promise.all([
                    get_version(id, va),
                    get_version(id, vb),
                ]);

                if (!ver_a || !ver_b) {
                    return res.status(404).json({ err: "versions_not_found" });
                }

                const redline = generate_redline(ver_a.content, ver_b.content);
                const narrative = generate_change_narrative(redline);

                res.json({
                    memory_id: id,
                    version_a: va,
                    version_b: vb,
                    summary: redline.summary,
                    classified_changes: redline.classified_changes,
                    narrative,
                    redline_html: redline.redline_html,
                });
            } catch (e: any) {
                console.error("[versioning] redline failed:", e);
                res.status(500).json({ err: "redline_failed" });
            }
        }
    );

    /**
     * GET /memory/:id/redline/current/:version (D4)
     *
     * Get classified redline diff between current state and a version.
     */
    app.get(
        "/memory/:id/redline/current/:version",
        async (req: any, res: any) => {
            try {
                const { id, version } = req.params;
                const version_number = parseInt(version, 10);

                if (isNaN(version_number)) {
                    return res.status(400).json({ err: "invalid_version_number" });
                }

                const [mem, ver] = await Promise.all([
                    q.get_mem.get(id),
                    get_version(id, version_number),
                ]);

                if (!mem) {
                    return res.status(404).json({ err: "memory_not_found" });
                }
                if (!ver) {
                    return res.status(404).json({ err: "version_not_found" });
                }

                const redline = generate_redline(ver.content, mem.content);
                const narrative = generate_change_narrative(redline);

                res.json({
                    memory_id: id,
                    current_version: mem.version,
                    compared_version: version_number,
                    summary: redline.summary,
                    classified_changes: redline.classified_changes,
                    narrative,
                    redline_html: redline.redline_html,
                });
            } catch (e: any) {
                console.error("[versioning] current redline failed:", e);
                res.status(500).json({ err: "redline_failed" });
            }
        }
    );

    /**
     * POST /redline/compare (D4)
     *
     * Compare two arbitrary text strings and return classified redline.
     * Useful for comparing documents without storing them.
     */
    app.post("/redline/compare", async (req: any, res: any) => {
        try {
            const { old_text, new_text } = req.body || {};

            if (!old_text || !new_text) {
                return res.status(400).json({ err: "missing_text" });
            }

            const redline = generate_redline(old_text, new_text);
            const narrative = generate_change_narrative(redline);

            res.json({
                summary: redline.summary,
                classified_changes: redline.classified_changes,
                narrative,
                redline_html: redline.redline_html,
            });
        } catch (e: any) {
            console.error("[redline] compare failed:", e);
            res.status(500).json({ err: "redline_failed" });
        }
    });
}
