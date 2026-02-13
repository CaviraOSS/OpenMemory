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
