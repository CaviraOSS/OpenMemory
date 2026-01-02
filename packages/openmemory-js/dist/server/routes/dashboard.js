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
exports.track_req = track_req;
exports.req_tracker_mw = req_tracker_mw;
exports.dash = dash;
const db_1 = require("../../core/db");
const cfg_1 = require("../../core/cfg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const is_pg = cfg_1.env.metadata_backend === "postgres";
const get_mem_table = () => {
    if (is_pg) {
        const sc = process.env.OM_PG_SCHEMA || "public";
        const tbl = process.env.OM_PG_TABLE || "openmemory_memories";
        return `"${sc}"."${tbl}"`;
    }
    return "memories";
};
let reqz = {
    win_start: Date.now(),
    win_cnt: 0,
    qps_hist: [],
};
const log_metric = async (type, value) => {
    try {
        const sc = process.env.OM_PG_SCHEMA || "public";
        const sql = is_pg
            ? `insert into "${sc}"."stats"(type,count,ts) values($1,$2,$3)`
            : "insert into stats(type,count,ts) values(?,?,?)";
        await (0, db_1.run_async)(sql, [type, value, Date.now()]);
    }
    catch (e) {
        console.error("[metrics] log err:", e);
    }
};
function track_req(success) {
    const now = Date.now();
    if (now - reqz.win_start >= 1000) {
        const qps = reqz.win_cnt;
        reqz.qps_hist.push(qps);
        if (reqz.qps_hist.length > 5)
            reqz.qps_hist.shift();
        // Log metrics to database every second
        log_metric("qps", qps).catch(console.error);
        if (!success)
            log_metric("error", 1).catch(console.error);
        reqz.win_start = now;
        reqz.win_cnt = 1;
    }
    else {
        reqz.win_cnt++;
    }
}
function req_tracker_mw() {
    return (req, res, next) => {
        if (req.url.startsWith("/dashboard") || req.url.startsWith("/health")) {
            return next();
        }
        const orig = res.json.bind(res);
        res.json = (data) => {
            track_req(res.statusCode < 400);
            return orig(data);
        };
        next();
    };
}
const get_db_sz = async () => {
    try {
        if (is_pg) {
            const db_name = process.env.OM_PG_DB || "openmemory";
            const result = await (0, db_1.all_async)(`SELECT pg_database_size('${db_name}') as size`);
            return result[0]?.size
                ? Math.round(result[0].size / 1024 / 1024)
                : 0;
        }
        else {
            const dbp = path.resolve(process.cwd(), "./backend", cfg_1.env.db_path);
            if (fs.existsSync(dbp)) {
                const st = fs.statSync(dbp);
                return Math.round(st.size / 1024 / 1024);
            }
            return 0;
        }
    }
    catch (e) {
        console.error("[db_sz] err:", e);
        return 0;
    }
};
function dash(app) {
    app.get("/dashboard/stats", async (_req, res) => {
        try {
            const mem_table = get_mem_table();
            const totmem = await (0, db_1.all_async)(`SELECT COUNT(*) as count FROM ${mem_table}`);
            const sectcnt = await (0, db_1.all_async)(`
                SELECT primary_sector, COUNT(*) as count
                FROM ${mem_table}
                GROUP BY primary_sector
            `);
            const dayago = Date.now() - 24 * 60 * 60 * 1000;
            const recmem = await (0, db_1.all_async)(is_pg
                ? `SELECT COUNT(*) as count FROM ${mem_table} WHERE created_at > $1`
                : `SELECT COUNT(*) as count FROM ${mem_table} WHERE created_at > ?`, [dayago]);
            const avgsal = await (0, db_1.all_async)(`SELECT AVG(salience) as avg FROM ${mem_table}`);
            const decst = await (0, db_1.all_async)(`
                SELECT
                    COUNT(*) as total,
                    AVG(decay_lambda) as avg_lambda,
                    MIN(salience) as min_salience,
                    MAX(salience) as max_salience
                FROM ${mem_table}
            `);
            const upt = process.uptime();
            // Calculate QPS stats from database (last hour)
            const hour_ago = Date.now() - 60 * 60 * 1000;
            const sc = process.env.OM_PG_SCHEMA || "public";
            const qps_data = await (0, db_1.all_async)(is_pg
                ? `SELECT count, ts FROM "${sc}"."stats" WHERE type=$1 AND ts > $2 ORDER BY ts DESC`
                : "SELECT count, ts FROM stats WHERE type=? AND ts > ? ORDER BY ts DESC", ["qps", hour_ago]);
            const err_data = await (0, db_1.all_async)(is_pg
                ? `SELECT COUNT(*) as total FROM "${sc}"."stats" WHERE type=$1 AND ts > $2`
                : "SELECT COUNT(*) as total FROM stats WHERE type=? AND ts > ?", ["error", hour_ago]);
            const peak_qps = qps_data.length > 0
                ? Math.max(...qps_data.map((d) => d.count))
                : 0;
            const avg_qps = reqz.qps_hist.length > 0
                ? Math.round((reqz.qps_hist.reduce((a, b) => a + b, 0) /
                    reqz.qps_hist.length) *
                    100) / 100
                : 0;
            const total_reqs = qps_data.reduce((sum, d) => sum + d.count, 0);
            const total_errs = err_data[0]?.total || 0;
            const err_rate = total_reqs > 0
                ? ((total_errs / total_reqs) * 100).toFixed(1)
                : "0.0";
            const dbsz = await get_db_sz();
            const dbpct = dbsz > 0 ? Math.min(100, Math.round((dbsz / 1024) * 100)) : 0;
            const cachit = totmem[0]?.count > 0
                ? Math.round((totmem[0].count /
                    (totmem[0].count + total_errs * 2)) *
                    100)
                : 0;
            res.json({
                totalMemories: totmem[0]?.count || 0,
                recentMemories: recmem[0]?.count || 0,
                sectorCounts: sectcnt.reduce((acc, row) => {
                    acc[row.primary_sector] = row.count;
                    return acc;
                }, {}),
                avgSalience: Number(avgsal[0]?.avg || 0).toFixed(3),
                decayStats: {
                    total: decst[0]?.total || 0,
                    avgLambda: Number(decst[0]?.avg_lambda || 0).toFixed(3),
                    minSalience: Number(decst[0]?.min_salience || 0).toFixed(3),
                    maxSalience: Number(decst[0]?.max_salience || 0).toFixed(3),
                },
                requests: {
                    total: total_reqs,
                    errors: total_errs,
                    errorRate: err_rate,
                    lastHour: qps_data.length,
                },
                qps: { peak: peak_qps, average: avg_qps, cacheHitRate: cachit },
                system: {
                    memoryUsage: dbpct,
                    heapUsed: dbsz,
                    heapTotal: 1024,
                    uptime: {
                        seconds: Math.floor(upt),
                        days: Math.floor(upt / 86400),
                        hours: Math.floor((upt % 86400) / 3600),
                    },
                },
                config: {
                    port: cfg_1.env.port,
                    vecDim: cfg_1.env.vec_dim,
                    cacheSegments: cfg_1.env.cache_segments,
                    maxActive: cfg_1.env.max_active,
                    decayInterval: cfg_1.env.decay_interval_minutes,
                    embedProvider: cfg_1.env.emb_kind,
                },
            });
        }
        catch (e) {
            console.error("[dash] stats err:", e);
            res.status(500).json({ err: "internal", message: e.message });
        }
    });
    app.get("/dashboard/health", async (_req, res) => {
        try {
            const memusg = process.memoryUsage();
            const upt = process.uptime();
            res.json({
                memory: {
                    heapUsed: Math.round(memusg.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memusg.heapTotal / 1024 / 1024),
                    rss: Math.round(memusg.rss / 1024 / 1024),
                    external: Math.round(memusg.external / 1024 / 1024),
                },
                uptime: {
                    seconds: Math.floor(upt),
                    days: Math.floor(upt / 86400),
                    hours: Math.floor((upt % 86400) / 3600),
                },
                process: {
                    pid: process.pid,
                    version: process.version,
                    platform: process.platform,
                },
            });
        }
        catch (e) {
            res.status(500).json({ err: "internal", message: e.message });
        }
    });
    app.get("/dashboard/activity", async (req, res) => {
        try {
            const mem_table = get_mem_table();
            const lim = parseInt(req.query.limit || "50");
            const recmem = await (0, db_1.all_async)(is_pg
                ? `SELECT id, content, primary_sector, salience, created_at, updated_at, last_seen_at
                       FROM ${mem_table} ORDER BY updated_at DESC LIMIT $1`
                : `SELECT id, content, primary_sector, salience, created_at, updated_at, last_seen_at
                       FROM ${mem_table} ORDER BY updated_at DESC LIMIT ?`, [lim]);
            res.json({
                activities: recmem.map((m) => ({
                    id: m.id,
                    type: "memory_updated",
                    sector: m.primary_sector,
                    content: m.content.substring(0, 100) + "...",
                    salience: m.salience,
                    timestamp: m.updated_at || m.created_at,
                })),
            });
        }
        catch (e) {
            res.status(500).json({ err: "internal", message: e.message });
        }
    });
    app.get("/dashboard/sectors/timeline", async (req, res) => {
        try {
            const mem_table = get_mem_table();
            const hrs = parseInt(req.query.hours || "24");
            const strt = Date.now() - hrs * 60 * 60 * 1000;
            // Use different grouping based on time range
            let displayFormat;
            let sortFormat;
            let timeKey;
            if (hrs <= 24) {
                // For 24 hours or less, group by date+hour for sorting, display only hour
                displayFormat = is_pg
                    ? "to_char(to_timestamp(created_at/1000), 'HH24:00')"
                    : "strftime('%H:00', datetime(created_at/1000, 'unixepoch', 'localtime'))";
                sortFormat = is_pg
                    ? "to_char(to_timestamp(created_at/1000), 'YYYY-MM-DD HH24:00')"
                    : "strftime('%Y-%m-%d %H:00', datetime(created_at/1000, 'unixepoch', 'localtime'))";
                timeKey = "hour";
            }
            else if (hrs <= 168) {
                // For up to 7 days, group by day
                displayFormat = is_pg
                    ? "to_char(to_timestamp(created_at/1000), 'MM-DD')"
                    : "strftime('%m-%d', datetime(created_at/1000, 'unixepoch', 'localtime'))";
                sortFormat = is_pg
                    ? "to_char(to_timestamp(created_at/1000), 'YYYY-MM-DD')"
                    : "strftime('%Y-%m-%d', datetime(created_at/1000, 'unixepoch', 'localtime'))";
                timeKey = "day";
            }
            else {
                // For longer periods (30 days), group by day showing month-day
                displayFormat = is_pg
                    ? "to_char(to_timestamp(created_at/1000), 'MM-DD')"
                    : "strftime('%m-%d', datetime(created_at/1000, 'unixepoch', 'localtime'))";
                sortFormat = is_pg
                    ? "to_char(to_timestamp(created_at/1000), 'YYYY-MM-DD')"
                    : "strftime('%Y-%m-%d', datetime(created_at/1000, 'unixepoch', 'localtime'))";
                timeKey = "day";
            }
            const tl = await (0, db_1.all_async)(is_pg
                ? `SELECT primary_sector, ${displayFormat} as label, ${sortFormat} as sort_key, COUNT(*) as count
                       FROM ${mem_table} WHERE created_at > $1 GROUP BY primary_sector, ${sortFormat} ORDER BY sort_key`
                : `SELECT primary_sector, ${displayFormat} as label, ${sortFormat} as sort_key, COUNT(*) as count
                       FROM ${mem_table} WHERE created_at > ? GROUP BY primary_sector, ${sortFormat} ORDER BY sort_key`, [strt]);
            res.json({
                timeline: tl.map((row) => ({ ...row, hour: row.label })),
                grouping: timeKey,
            });
        }
        catch (e) {
            res.status(500).json({ err: "internal", message: e.message });
        }
    });
    app.get("/dashboard/top-memories", async (req, res) => {
        try {
            const mem_table = get_mem_table();
            const lim = parseInt(req.query.limit || "10");
            const topm = await (0, db_1.all_async)(is_pg
                ? `SELECT id, content, primary_sector, salience, last_seen_at
                       FROM ${mem_table} ORDER BY salience DESC LIMIT $1`
                : `SELECT id, content, primary_sector, salience, last_seen_at
                       FROM ${mem_table} ORDER BY salience DESC LIMIT ?`, [lim]);
            res.json({
                memories: topm.map((m) => ({
                    id: m.id,
                    content: m.content,
                    sector: m.primary_sector,
                    salience: m.salience,
                    lastSeen: m.last_seen_at,
                })),
            });
        }
        catch (e) {
            res.status(500).json({ err: "internal", message: e.message });
        }
    });
    app.get("/dashboard/maintenance", async (req, res) => {
        try {
            const hrs = parseInt(req.query.hours || "24");
            const strt = Date.now() - hrs * 60 * 60 * 1000;
            const sc = process.env.OM_PG_SCHEMA || "public";
            const ops = await (0, db_1.all_async)(is_pg
                ? `SELECT type, to_char(to_timestamp(ts/1000), 'HH24:00') as hour, SUM(count) as cnt
                       FROM "${sc}"."stats" WHERE ts > $1 GROUP BY type, hour ORDER BY hour`
                : `SELECT type, strftime('%H:00', datetime(ts/1000, 'unixepoch', 'localtime')) as hour, SUM(count) as cnt
                       FROM stats WHERE ts > ? GROUP BY type, hour ORDER BY hour`, [strt]);
            const totals = await (0, db_1.all_async)(is_pg
                ? `SELECT type, SUM(count) as total FROM "${sc}"."stats" WHERE ts > $1 GROUP BY type`
                : `SELECT type, SUM(count) as total FROM stats WHERE ts > ? GROUP BY type`, [strt]);
            const by_hr = {};
            for (const op of ops) {
                if (!by_hr[op.hour])
                    by_hr[op.hour] = {
                        hour: op.hour,
                        decay: 0,
                        reflection: 0,
                        consolidation: 0,
                    };
                if (op.type === "decay")
                    by_hr[op.hour].decay = op.cnt;
                else if (op.type === "reflect")
                    by_hr[op.hour].reflection = op.cnt;
                else if (op.type === "consolidate")
                    by_hr[op.hour].consolidation = op.cnt;
            }
            const tot_decay = totals.find((t) => t.type === "decay")?.total || 0;
            const tot_reflect = totals.find((t) => t.type === "reflect")?.total || 0;
            const tot_consol = totals.find((t) => t.type === "consolidate")?.total || 0;
            const tot_ops = tot_decay + tot_reflect + tot_consol;
            const efficiency = tot_ops > 0
                ? Math.round(((tot_reflect + tot_consol) / tot_ops) * 100)
                : 0;
            res.json({
                operations: Object.values(by_hr),
                totals: {
                    cycles: tot_decay,
                    reflections: tot_reflect,
                    consolidations: tot_consol,
                    efficiency,
                },
            });
        }
        catch (e) {
            res.status(500).json({ err: "internal", message: e.message });
        }
    });
}
