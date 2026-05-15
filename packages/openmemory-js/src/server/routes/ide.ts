import { q } from "../../core/db";
import { add_hsg_memory, hsg_query } from "../../memory/hsg";
import { update_user_summary } from "../../memory/user_summary";
import { j, p } from "../../utils";
import * as crypto from "crypto";
import { require_tenant, reject_tenant_mismatch } from "../middleware/tenant";
import { parse_or_400, schema } from "../middleware/validate";

const event_schema: schema = {
    event_type: { type: "string", required: true, max_length: 64 },
    file_path: { type: "string", max_length: 4096 },
    content: { type: "string", max_length: 5_000_000 },
    session_id: { type: "string", max_length: 256 },
    metadata: { type: "object" },
    user_id: { type: "string", max_length: 256 },
};

const context_schema: schema = {
    query: { type: "string", required: true, min_length: 1, max_length: 8192 },
    k: { type: "integer", min: 1, max: 200 },
    limit: { type: "integer", min: 1, max: 200 },
    session_id: { type: "string", max_length: 256 },
    file_path: { type: "string", max_length: 4096 },
};

const session_start_schema: schema = {
    user_id: { type: "string", max_length: 256 },
    project_name: { type: "string", max_length: 256 },
    ide_name: { type: "string", max_length: 256 },
};

const session_end_schema: schema = {
    session_id: { type: "string", required: true, max_length: 256 },
    user_id: { type: "string", max_length: 256 },
};

export function ide(app: any) {
    app.post("/api/ide/events", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{
            event_type: string;
            file_path?: string;
            content?: string;
            session_id?: string;
            metadata?: Record<string, unknown>;
            user_id?: string;
        }>(res, req.body, event_schema);
        if (!b) return;
        if (reject_tenant_mismatch(res, tenant, b.user_id)) return;

        try {
            const event_type = b.event_type;
            const file_path = b.file_path || "unknown";
            const content = b.content || "";
            const session_id = b.session_id || "default";
            const metadata = b.metadata || {};

            let memory_content = "";
            if (event_type === "open") {
                memory_content = `Opened file: ${file_path}`;
            } else if (event_type === "save") {
                memory_content = content
                    ? `Saved file: ${file_path}\n\n${content}`
                    : `Saved file: ${file_path}`;
            } else if (event_type === "close") {
                memory_content = `Closed file: ${file_path}`;
            } else {
                memory_content =
                    `[${event_type}] ${file_path}\n${content}`.trim();
            }

            const full_metadata = {
                ...metadata,
                ide_event_type: event_type,
                ide_file_path: file_path,
                ide_session_id: session_id,
                ide_timestamp: Date.now(),
                ide_mode: true,
            };

            const result = await add_hsg_memory(
                memory_content,
                undefined,
                full_metadata,
                tenant,
            );

            update_user_summary(tenant).catch((err) =>
                console.error("[IDE] Failed to update user summary:", err),
            );

            res.json({
                success: true,
                memory_id: result.id,
                primary_sector: result.primary_sector,
                sectors: result.sectors,
            });
        } catch (err) {
            console.error("[IDE] Error storing IDE event:", err);
            res.status(500).json({ err: "internal" });
        }
    });

    app.post("/api/ide/context", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{
            query: string;
            k?: number;
            limit?: number;
            session_id?: string;
            file_path?: string;
        }>(res, req.body, context_schema);
        if (!b) return;

        try {
            const k = b.k || b.limit || 5;
            const session_id = b.session_id;
            const file_path = b.file_path;

            const results = await hsg_query(b.query, k, { user_id: tenant });
            let filtered = results;

            if (session_id) {
                filtered = [];
                for (const r of results) {
                    const mem = await q.get_mem.get(r.id);
                    if (mem) {
                        const meta = p(mem.meta);
                        if (meta && meta.ide_session_id === session_id) {
                            filtered.push(r);
                        }
                    }
                }
            }

            if (file_path) {
                filtered = filtered.filter((r: any) =>
                    r.content.includes(file_path),
                );
            }

            const formatted = filtered.map((r: any) => ({
                memory_id: r.id,
                content: r.content,
                primary_sector: r.primary_sector,
                sectors: r.sectors,
                score: r.score,
                salience: r.salience,
                last_seen_at: r.last_seen_at,
                path: r.path,
            }));

            res.json({
                success: true,
                memories: formatted,
                total: formatted.length,
                query: b.query,
            });
        } catch (err) {
            console.error("[IDE] Error retrieving IDE context:", err);
            res.status(500).json({ err: "internal" });
        }
    });

    app.post("/api/ide/session/start", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{
            user_id?: string;
            project_name?: string;
            ide_name?: string;
        }>(res, req.body, session_start_schema);
        if (!b) return;
        if (reject_tenant_mismatch(res, tenant, b.user_id)) return;

        try {
            const project_name = b.project_name || "unknown";
            const ide_name = b.ide_name || "unknown";

            const session_id = `session_${Date.now()}_${crypto.randomBytes(7).toString("hex")}`;
            const now_ts = Date.now();

            const content = `Session started: ${tenant} in ${project_name} using ${ide_name}`;
            const metadata = {
                ide_session_id: session_id,
                ide_user_id: tenant,
                ide_project_name: project_name,
                ide_name: ide_name,
                session_start_time: now_ts,
                session_type: "ide_session",
                ide_mode: true,
            };

            const result = await add_hsg_memory(
                content,
                undefined,
                metadata,
                tenant,
            );

            update_user_summary(tenant).catch((err) =>
                console.error(
                    "[IDE] Failed to update summary on session start:",
                    err,
                ),
            );

            res.json({
                success: true,
                session_id,
                memory_id: result.id,
                started_at: now_ts,
                user_id: tenant,
                project_name,
                ide_name,
            });
        } catch (err) {
            console.error("[IDE] Error starting IDE session:", err);
            res.status(500).json({ err: "internal" });
        }
    });

    app.post("/api/ide/session/end", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        const b = parse_or_400<{ session_id: string; user_id?: string }>(
            res,
            req.body,
            session_end_schema,
        );
        if (!b) return;
        if (reject_tenant_mismatch(res, tenant, b.user_id)) return;

        try {
            const session_id = b.session_id;
            const now_ts = Date.now();

            // Scope session-end aggregation to the authenticated tenant.
            const all_memories = await q.all_mem_by_user.all(tenant, 10000, 0);
            const session_memories = all_memories.filter((m: any) => {
                try {
                    const meta = p(m.meta);
                    return meta && meta.ide_session_id === session_id;
                } catch {
                    return false;
                }
            });

            const total_events = session_memories.length;
            const sectors: Record<string, number> = {};
            const files = new Set<string>();

            for (const m of session_memories) {
                sectors[m.primary_sector] =
                    (sectors[m.primary_sector] || 0) + 1;
                try {
                    const meta = p(m.meta);
                    if (
                        meta &&
                        meta.ide_file_path &&
                        meta.ide_file_path !== "unknown"
                    ) {
                        files.add(meta.ide_file_path);
                    }
                } catch {}
            }

            const summary = `Session ${session_id} ended. Events: ${total_events}, Files: ${files.size}, Sectors: ${j(sectors)}`;
            const metadata = {
                ide_session_id: session_id,
                session_end_time: now_ts,
                session_type: "ide_session_end",
                total_events,
                sectors_distribution: sectors,
                files_touched: Array.from(files),
                ide_mode: true,
            };

            const result = await add_hsg_memory(
                summary,
                undefined,
                metadata,
                tenant,
            );

            update_user_summary(tenant).catch((err) =>
                console.error(
                    "[IDE] Failed to update summary on session end:",
                    err,
                ),
            );

            res.json({
                success: true,
                session_id,
                ended_at: now_ts,
                summary_memory_id: result.id,
                statistics: {
                    total_events,
                    sectors,
                    unique_files: files.size,
                    files: Array.from(files),
                },
            });
        } catch (err) {
            console.error("[IDE] Error ending IDE session:", err);
            res.status(500).json({ err: "internal" });
        }
    });

    app.get("/api/ide/patterns/:session_id", async (req: any, res: any) => {
        const tenant = require_tenant(req, res);
        if (!tenant) return;
        try {
            const session_id = req.params.session_id;
            if (!session_id)
                return res.status(400).json({ err: "session_id_required" });

            // Scope pattern detection to the authenticated tenant.
            const all_memories = await q.all_mem_by_user.all(tenant, 10000, 0);
            const procedural = all_memories.filter((m: any) => {
                if (m.primary_sector !== "procedural") return false;
                try {
                    const meta = p(m.meta);
                    return meta && meta.ide_session_id === session_id;
                } catch {
                    return false;
                }
            });

            const patterns = procedural.map((m: any) => ({
                pattern_id: m.id,
                description: m.content,
                salience: m.salience,
                detected_at: m.created_at,
                last_reinforced: m.last_seen_at,
            }));

            res.json({
                success: true,
                session_id,
                pattern_count: patterns.length,
                patterns,
            });
        } catch (err) {
            console.error("[IDE] Error detecting patterns:", err);
            res.status(500).json({ err: "internal" });
        }
    });
}
