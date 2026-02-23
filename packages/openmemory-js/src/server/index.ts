const server = require("./server.js");
import { env, tier } from "../core/cfg";
import { run_decay_process, prune_weak_waypoints } from "../memory/hsg";
import { mcp } from "../ai/mcp";
import { routes } from "./routes";
import {
    authenticate_api_request,
    log_authenticated_request,
} from "./middleware/auth";
import { start_reflection } from "../memory/reflect";
import { start_user_summary_reflection } from "../memory/user_summary";
import { sendTelemetry } from "../core/telemetry";
import { req_tracker_mw } from "./routes/dashboard";
import {
    TASK_NAMES,
    task_start,
    task_success,
    task_failure,
} from "../core/observability";
import {
    http_requests_total,
    http_request_duration_seconds,
    normalise_path,
    maintenance_pruned_embed_logs,
    maintenance_expired_memories,
    orphan_memories,
    memories_growth_7d,
} from "../core/metrics";
import { all_async, run_async, memories_table } from "../core/db";

const ASC = `   ____                   __  __
  / __ \\                 |  \\/  |
 | |  | |_ __   ___ _ __ | \\  / | ___ _ __ ___   ___  _ __ _   _
 | |  | | '_ \\ / _ \\ '_ \\| |\\/| |/ _ \\ '_ \` _ \\ / _ \\| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \\____/| .__/ \\___|_| |_|_|  |_|\\___|_| |_| |_|\\___/|_|   \\__, |
        | |                                                 __/ |
        |_|                                                |___/ `;

const app = server({ max_payload_size: env.max_payload_size });

console.log(ASC);
console.log(`[CONFIG] Vector Dimension: ${env.vec_dim}`);
console.log(`[CONFIG] Cache Segments: ${env.cache_segments}`);
console.log(`[CONFIG] Max Active Queries: ${env.max_active}`);


if (env.emb_kind !== "synthetic" && (tier === "hybrid" || tier === "fast")) {
    console.warn(
        `[CONFIG] ⚠️  WARNING: Embedding configuration mismatch detected!\n` +
        `         OM_EMBEDDINGS=${env.emb_kind} but OM_TIER=${tier}\n` +
        `         Storage will use ${env.emb_kind} embeddings, but queries will use synthetic embeddings.\n` +
        `         This causes semantic search to fail. Set OM_TIER=deep to fix.`
    );
}

app.use(req_tracker_mw());

app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin;

    // If CORS allowlist is configured, check if origin is allowed
    if (env.cors_allowed_origins && env.cors_allowed_origins.length > 0) {
        if (origin && env.cors_allowed_origins.includes(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
        }
        // If origin is not in allowlist, don't set permissive CORS headers
    } else {
        // No allowlist configured, use wildcard (backward compatible)
        res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,Authorization,x-api-key",
    );
    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }
    next();
});

// Prometheus request metrics middleware
app.use((req: any, res: any, next: any) => {
    const path = req.path || req.url;

    // Skip metrics and health endpoints to avoid self-referential noise
    if (path === "/metrics" || path === "/health") {
        return next();
    }

    const start = process.hrtime.bigint();
    const method = req.method;
    const normalised_path = normalise_path(path);

    res.on("finish", () => {
        const duration_ns = process.hrtime.bigint() - start;
        const duration_s = Number(duration_ns) / 1e9;

        http_requests_total.inc({
            method,
            path: normalised_path,
            status_code: res.statusCode.toString(),
        });

        http_request_duration_seconds.observe(
            { method, path: normalised_path },
            duration_s
        );
    });

    next();
});

app.use(authenticate_api_request);

if (process.env.OM_LOG_AUTH === "true") {
    app.use(log_authenticated_request);
}

routes(app);

mcp(app);
if (env.mode === "langgraph") {
    console.log("[MODE] LangGraph integration enabled");
}

const decayIntervalMs = env.decay_interval_minutes * 60 * 1000;
console.log(
    `[DECAY] Interval: ${env.decay_interval_minutes} minutes (${decayIntervalMs / 1000}s)`,
);

setInterval(async () => {
    const start = task_start(TASK_NAMES.DECAY);
    try {
        const result = await run_decay_process();
        task_success(TASK_NAMES.DECAY, start, {
            decayed: result.decayed,
            processed: result.processed,
        });
    } catch (error) {
        task_failure(TASK_NAMES.DECAY, start, error);
    }
}, decayIntervalMs);

setInterval(
    async () => {
        const start = task_start(TASK_NAMES.PRUNE);
        try {
            const pruned = await prune_weak_waypoints();
            task_success(TASK_NAMES.PRUNE, start, { pruned });
        } catch (error) {
            task_failure(TASK_NAMES.PRUNE, start, error);
        }
    },
    7 * 24 * 60 * 60 * 1000,
);

// Maintenance scheduler: runs every 24h after decay
const run_maintenance = async () => {
    const start = task_start(TASK_NAMES.MAINTENANCE);
    try {
        const results: Record<string, unknown> = {};

        // 1. Prune old embed_logs
        const log_cutoff = Date.now() - env.embed_log_retention_days * 24 * 60 * 60 * 1000;
        const log_del = await run_async(`DELETE FROM embed_logs WHERE created_at < ?`, [log_cutoff]);
        results.pruned_embed_logs = (log_del as any)?.changes ?? 0;
        maintenance_pruned_embed_logs.set(results.pruned_embed_logs as number);

        // 2. Expire dead memories (low salience + no waypoints + old)
        const age_cutoff = Date.now() - env.dead_memory_max_age_days * 24 * 60 * 60 * 1000;
        const expired = await all_async(
            `SELECT id FROM ${memories_table} WHERE salience < ? AND last_seen_at < ? AND COALESCE(json_extract(meta, '$.decay_disabled'), 'false') != 'true' AND NOT EXISTS (SELECT 1 FROM waypoints w WHERE w.src_id = ${memories_table}.id OR w.dst_id = ${memories_table}.id)`,
            [env.dead_memory_min_salience, age_cutoff],
        );
        for (const row of expired) {
            await run_async(`DELETE FROM ${memories_table} WHERE id = ?`, [row.id]);
        }
        results.expired_memories = expired.length;
        maintenance_expired_memories.set(expired.length);

        // 3. Update operational gauges
        const [orphan_row] = await all_async(
            `SELECT COUNT(*) as cnt FROM ${memories_table} m WHERE NOT EXISTS (SELECT 1 FROM waypoints w WHERE w.src_id = m.id OR w.dst_id = m.id)`,
            [],
        );
        orphan_memories.set(orphan_row?.cnt ?? 0);

        const seven_days_ago = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const [growth_row] = await all_async(
            `SELECT COUNT(*) as cnt FROM ${memories_table} WHERE created_at > ?`,
            [seven_days_ago],
        );
        memories_growth_7d.set(growth_row?.cnt ?? 0);

        // 4. SQLite VACUUM (only for sqlite backend)
        if (env.metadata_backend === "sqlite") {
            await run_async("VACUUM", []);
            results.vacuumed = true;
        }

        task_success(TASK_NAMES.MAINTENANCE, start, results);
    } catch (error) {
        task_failure(TASK_NAMES.MAINTENANCE, start, error);
    }
};

// Run maintenance on the same interval as decay (after each decay cycle)
setInterval(run_maintenance, decayIntervalMs);

setTimeout(() => {
    const start = task_start(TASK_NAMES.DECAY);
    run_decay_process()
        .then((result: any) => {
            task_success(TASK_NAMES.DECAY, start, {
                decayed: result.decayed,
                processed: result.processed,
                initial: true,
            });
        })
        .catch((error) => {
            task_failure(TASK_NAMES.DECAY, start, error);
        });
}, 3000);

start_reflection();
start_user_summary_reflection();

console.log(`[SERVER] Starting on port ${env.port}`);
app.listen(env.port, () => {
    console.log(`[SERVER] Running on http://localhost:${env.port}`);
    sendTelemetry().catch(() => {

    });
});
