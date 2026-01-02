"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server = require("./server.js");
const cfg_1 = require("../core/cfg");
const hsg_1 = require("../memory/hsg");
const mcp_1 = require("../ai/mcp");
const routes_1 = require("./routes");
const auth_1 = require("./middleware/auth");
const reflect_1 = require("../memory/reflect");
const user_summary_1 = require("../memory/user_summary");
const telemetry_1 = require("../core/telemetry");
const dashboard_1 = require("./routes/dashboard");
const ASC = `   ____                   __  __                                 
  / __ \\                 |  \\/  |                                
 | |  | |_ __   ___ _ __ | \\  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \\ / _ \\ '_ \\| |\\/| |/ _ \\ '_ \` _ \\ / _ \\| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \\____/| .__/ \\___|_| |_|_|  |_|\\___|_| |_| |_|\\___/|_|   \\__, |
        | |                                                 __/ |
        |_|                                                |___/ `;
const app = server({ max_payload_size: cfg_1.env.max_payload_size });
console.log(ASC);
console.log(`[CONFIG] Vector Dimension: ${cfg_1.env.vec_dim}`);
console.log(`[CONFIG] Cache Segments: ${cfg_1.env.cache_segments}`);
console.log(`[CONFIG] Max Active Queries: ${cfg_1.env.max_active}`);
// Warn about configuration mismatch that causes embedding incompatibility
if (cfg_1.env.emb_kind !== "synthetic" && (cfg_1.tier === "hybrid" || cfg_1.tier === "fast")) {
    console.warn(`[CONFIG] ⚠️  WARNING: Embedding configuration mismatch detected!\n` +
        `         OM_EMBEDDINGS=${cfg_1.env.emb_kind} but OM_TIER=${cfg_1.tier}\n` +
        `         Storage will use ${cfg_1.env.emb_kind} embeddings, but queries will use synthetic embeddings.\n` +
        `         This causes semantic search to fail. Set OM_TIER=deep to fix.`);
}
app.use((0, dashboard_1.req_tracker_mw)());
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-api-key");
    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }
    next();
});
app.use(auth_1.authenticate_api_request);
if (process.env.OM_LOG_AUTH === "true") {
    app.use(auth_1.log_authenticated_request);
}
(0, routes_1.routes)(app);
(0, mcp_1.mcp)(app);
if (cfg_1.env.mode === "langgraph") {
    console.log("[MODE] LangGraph integration enabled");
}
const decayIntervalMs = cfg_1.env.decay_interval_minutes * 60 * 1000;
console.log(`[DECAY] Interval: ${cfg_1.env.decay_interval_minutes} minutes (${decayIntervalMs / 1000}s)`);
setInterval(async () => {
    console.log("[DECAY] Running HSG decay process...");
    try {
        const result = await (0, hsg_1.run_decay_process)();
        console.log(`[DECAY] Completed: ${result.decayed}/${result.processed} memories updated`);
    }
    catch (error) {
        console.error("[DECAY] Process failed:", error);
    }
}, decayIntervalMs);
setInterval(async () => {
    console.log("[PRUNE] Pruning weak waypoints...");
    try {
        const pruned = await (0, hsg_1.prune_weak_waypoints)();
        console.log(`[PRUNE] Completed: ${pruned} waypoints removed`);
    }
    catch (error) {
        console.error("[PRUNE] Failed:", error);
    }
}, 7 * 24 * 60 * 60 * 1000);
setTimeout(() => {
    (0, hsg_1.run_decay_process)()
        .then((result) => {
        console.log(`[INIT] Initial decay: ${result.decayed}/${result.processed} memories updated`);
    })
        .catch(console.error);
}, 3000);
(0, reflect_1.start_reflection)();
(0, user_summary_1.start_user_summary_reflection)();
console.log(`[SERVER] Starting on port ${cfg_1.env.port}`);
app.listen(cfg_1.env.port, () => {
    console.log(`[SERVER] Running on http://localhost:${cfg_1.env.port}`);
    (0, telemetry_1.sendTelemetry)().catch(() => {
        // ignore telemetry failures
    });
});
