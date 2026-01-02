"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ide = ide;
const db_1 = require("../../core/db");
const hsg_1 = require("../../memory/hsg");
const user_summary_1 = require("../../memory/user_summary");
const utils_1 = require("../../utils");
const crypto = __importStar(require("crypto"));
function ide(app) {
    app.post("/api/ide/events", async (req, res) => {
        try {
            const event_type = req.body.event_type;
            const file_path = req.body.file_path || "unknown";
            const content = req.body.content || "";
            const session_id = req.body.session_id || "default";
            const metadata = req.body.metadata || {};
            const user_id = req.body.user_id || "anonymous";
            if (!event_type)
                return res.status(400).json({ err: "event_type_required" });
            let memory_content = "";
            if (event_type === "open") {
                memory_content = `Opened file: ${file_path}`;
            }
            else if (event_type === "save") {
                if (content) {
                    memory_content = `Saved file: ${file_path}\n\n${content}`;
                }
                else {
                    memory_content = `Saved file: ${file_path}`;
                }
            }
            else if (event_type === "close") {
                memory_content = `Closed file: ${file_path}`;
            }
            else {
                memory_content = `[${event_type}] ${file_path}\n${content}`.trim();
            }
            const full_metadata = {
                ...metadata,
                ide_event_type: event_type,
                ide_file_path: file_path,
                ide_session_id: session_id,
                ide_timestamp: Date.now(),
                ide_mode: true,
            };
            const result = await (0, hsg_1.add_hsg_memory)(memory_content, undefined, full_metadata, user_id);
            // Update user summary asynchronously
            if (user_id && user_id !== "anonymous") {
                (0, user_summary_1.update_user_summary)(user_id).catch(err => console.error("[IDE] Failed to update user summary:", err));
            }
            res.json({
                success: true,
                memory_id: result.id,
                primary_sector: result.primary_sector,
                sectors: result.sectors,
            });
        }
        catch (err) {
            console.error("[IDE] Error storing IDE event:", err);
            res.status(500).json({ err: "internal" });
        }
    });
    app.post("/api/ide/context", async (req, res) => {
        try {
            const query = req.body.query;
            const k = req.body.k || req.body.limit || 5;
            const session_id = req.body.session_id;
            const file_path = req.body.file_path;
            if (!query)
                return res.status(400).json({ err: "query_required" });
            const results = await (0, hsg_1.hsg_query)(query, k);
            let filtered = results;
            if (session_id) {
                filtered = [];
                for (const r of results) {
                    const mem = await db_1.q.get_mem.get(r.id);
                    if (mem) {
                        const meta = (0, utils_1.p)(mem.meta);
                        if (meta && meta.ide_session_id === session_id) {
                            filtered.push(r);
                        }
                    }
                }
            }
            if (file_path) {
                filtered = filtered.filter((r) => r.content.includes(file_path));
            }
            const formatted = filtered.map((r) => ({
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
                query: query,
            });
        }
        catch (err) {
            console.error("[IDE] Error retrieving IDE context:", err);
            res.status(500).json({ err: "internal" });
        }
    });
    app.post("/api/ide/session/start", async (req, res) => {
        try {
            const user_id = req.body.user_id || "anonymous";
            const project_name = req.body.project_name || "unknown";
            const ide_name = req.body.ide_name || "unknown";
            const session_id = `session_${Date.now()}_${crypto.randomBytes(7).toString("hex")}`;
            const now_ts = Date.now();
            const content = `Session started: ${user_id} in ${project_name} using ${ide_name}`;
            const metadata = {
                ide_session_id: session_id,
                ide_user_id: user_id,
                ide_project_name: project_name,
                ide_name: ide_name,
                session_start_time: now_ts,
                session_type: "ide_session",
                ide_mode: true,
            };
            const result = await (0, hsg_1.add_hsg_memory)(content, undefined, metadata, user_id);
            if (user_id && user_id !== "anonymous") {
                (0, user_summary_1.update_user_summary)(user_id).catch(err => console.error("[IDE] Failed to update summary on session start:", err));
            }
            res.json({
                success: true,
                session_id: session_id,
                memory_id: result.id,
                started_at: now_ts,
                user_id: user_id,
                project_name: project_name,
                ide_name: ide_name,
            });
        }
        catch (err) {
            console.error("[IDE] Error starting IDE session:", err);
            res.status(500).json({ err: "internal" });
        }
    });
    app.post("/api/ide/session/end", async (req, res) => {
        try {
            const session_id = req.body.session_id;
            const user_id = req.body.user_id || "anonymous";
            if (!session_id)
                return res.status(400).json({ err: "session_id_required" });
            const now_ts = Date.now();
            const all_memories = await db_1.q.all_mem.all(10000, 0);
            const session_memories = all_memories.filter((m) => {
                try {
                    const meta = (0, utils_1.p)(m.meta);
                    return meta && meta.ide_session_id === session_id;
                }
                catch {
                    return false;
                }
            });
            const total_events = session_memories.length;
            const sectors = {};
            const files = new Set();
            for (const m of session_memories) {
                sectors[m.primary_sector] =
                    (sectors[m.primary_sector] || 0) + 1;
                try {
                    const meta = (0, utils_1.p)(m.meta);
                    if (meta &&
                        meta.ide_file_path &&
                        meta.ide_file_path !== "unknown") {
                        files.add(meta.ide_file_path);
                    }
                }
                catch { }
            }
            const summary = `Session ${session_id} ended. Events: ${total_events}, Files: ${files.size}, Sectors: ${(0, utils_1.j)(sectors)}`;
            const metadata = {
                ide_session_id: session_id,
                session_end_time: now_ts,
                session_type: "ide_session_end",
                total_events: total_events,
                sectors_distribution: sectors,
                files_touched: Array.from(files),
                ide_mode: true,
            };
            const result = await (0, hsg_1.add_hsg_memory)(summary, undefined, metadata, user_id);
            if (user_id && user_id !== "anonymous") {
                (0, user_summary_1.update_user_summary)(user_id).catch(err => console.error("[IDE] Failed to update summary on session end:", err));
            }
            res.json({
                success: true,
                session_id: session_id,
                ended_at: now_ts,
                summary_memory_id: result.id,
                statistics: {
                    total_events: total_events,
                    sectors: sectors,
                    unique_files: files.size,
                    files: Array.from(files),
                },
            });
        }
        catch (err) {
            console.error("[IDE] Error ending IDE session:", err);
            res.status(500).json({ err: "internal" });
        }
    });
    app.get("/api/ide/patterns/:session_id", async (req, res) => {
        try {
            const session_id = req.params.session_id;
            if (!session_id)
                return res.status(400).json({ err: "session_id_required" });
            const all_memories = await db_1.q.all_mem.all(10000, 0);
            const procedural = all_memories.filter((m) => {
                if (m.primary_sector !== "procedural")
                    return false;
                try {
                    const meta = (0, utils_1.p)(m.meta);
                    return meta && meta.ide_session_id === session_id;
                }
                catch {
                    return false;
                }
            });
            const patterns = procedural.map((m) => ({
                pattern_id: m.id,
                description: m.content,
                salience: m.salience,
                detected_at: m.created_at,
                last_reinforced: m.last_seen_at,
            }));
            res.json({
                success: true,
                session_id: session_id,
                pattern_count: patterns.length,
                patterns: patterns,
            });
        }
        catch (err) {
            console.error("[IDE] Error detecting patterns:", err);
            res.status(500).json({ err: "internal" });
        }
    });
}
