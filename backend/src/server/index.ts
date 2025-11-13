const server = require("./server.js");
import { env, tier } from "../core/cfg";
import { run_decay_process, prune_weak_waypoints } from "../memory/hsg";
import { mcp } from "../ai/mcp";
import { routes } from "./routes";
import { proxy_routes } from "./proxy";
import {
    authenticate_api_request,
    log_authenticated_request,
} from "./middleware/auth";
import { start_reflection } from "../memory/reflect";
import { start_user_summary_reflection } from "../memory/user_summary";
import { sendTelemetry } from "../core/telemetry";
import { req_tracker_mw } from "./routes/dashboard";
import { runMigration } from "../scripts/migrate-agent-tables";

const ASC = `   ____                   __  __                                 
  / __ \\                 |  \\/  |                                
 | |  | |_ __   ___ _ __ | \\  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \\ / _ \\ '_ \\| |\\/| |/ _ \\ '_ \` _ \\ / _ \\| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \\____/| .__/ \\___|_| |_|_|  |_|\\___|_| |_| |_|\\___/|_|   \\__, |
        | |                                                 __/ |
        |_|                                                |___/ `;

// Initialize server components in the correct order
async function initializeServer() {
    console.log("[DEBUG] initializeServer started");
    
    // Run migrations first before any server setup if proxy is enabled
    const proxyEnabled = process.env.OM_MCP_PROXY_ENABLED !== 'false';
    console.log("[DEBUG] proxyEnabled:", proxyEnabled);
    
    if (proxyEnabled) {
        console.log("[MCP PROXY] Running migrations before server initialization...");
        try {
            await runMigration();
            console.log("[MCP PROXY] Migration completed successfully");
        } catch (error) {
            console.error("[MCP PROXY] Migration failed:", error);
            // Continue anyway, but note the failure
        }
    }

    const app = server({ max_payload_size: env.max_payload_size });

    console.log(ASC);
    console.log(`[CONFIG] Vector Dimension: ${env.vec_dim}`);
    console.log(`[CONFIG] Cache Segments: ${env.cache_segments}`);
    console.log(`[CONFIG] Max Active Queries: ${env.max_active}`);

    app.use(req_tracker_mw());

    app.use((req: any, res: any, next: any) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader(
            "Access-Control-Allow-Methods",
            "GET,POST,PUT,DELETE,OPTIONS",
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

    // Setup Swagger documentation before authentication middleware
    const { setupSwagger } = await import("./swagger");
    setupSwagger(app);

    app.use(authenticate_api_request);

    if (process.env.OM_LOG_AUTH === "true") {
        app.use(log_authenticated_request);
    }

    routes(app);

    mcp(app);

    // Setup proxy routes if enabled
    if (proxyEnabled) {
        console.log("[MCP PROXY] Setting up proxy routes...");
        
        proxy_routes(app);
        
        console.log("[OpenMemory] MCP Proxy service initialized on port", env.port);
        console.log("[OpenMemory] Proxy endpoints:");
        console.log("  POST /mcp-proxy - MCP protocol endpoint");
        console.log("  GET /api/agents - List registered agents");
        console.log("  GET /api/agents/:id - Get specific agent");
        console.log("  GET /api/namespaces - List namespaces");
        console.log("  GET /api/proxy-info - Service information");
        console.log("  GET /api/registration-template/:format - Registration templates");
        console.log("  GET /api/proxy-health - Health check");
    } else {
        console.log("[MCP PROXY] Proxy service disabled");
    }

    if (env.mode === "langgraph") {
        console.log("[MODE] LangGraph integration enabled");
    }

    const decayIntervalMs = env.decay_interval_minutes * 60 * 1000;
    console.log(
        `[DECAY] Interval: ${env.decay_interval_minutes} minutes (${decayIntervalMs / 1000}s)`,
    );

    setInterval(async () => {
        console.log("[DECAY] Running HSG decay process...");
        try {
            const result = await run_decay_process();
            console.log(
                `[DECAY] Completed: ${result.decayed}/${result.processed} memories updated`,
            );
        } catch (error) {
            console.error("[DECAY] Process failed:", error);
        }
    }, decayIntervalMs);
    
    setInterval(
        async () => {
            console.log("[PRUNE] Pruning weak waypoints...");
            try {
                const pruned = await prune_weak_waypoints();
                console.log(`[PRUNE] Completed: ${pruned} waypoints removed`);
            } catch (error) {
                console.error("[PRUNE] Failed:", error);
            }
        },
        7 * 24 * 60 * 60 * 1000,
    );
    
    run_decay_process()
        .then((result: any) => {
            console.log(
                `[INIT] Initial decay: ${result.decayed}/${result.processed} memories updated`,
            );
        })
        .catch(console.error);

    start_reflection();
    start_user_summary_reflection();

    console.log(`[SERVER] Starting on port ${env.port}`);
    app.listen(env.port, () => {
        console.log(`[SERVER] Running on http://localhost:${env.port}`);
    });
    sendTelemetry().catch(() => {
        // ignore telemetry failures
    });
}

// Initialize server
initializeServer().catch((error) => {
    console.error("[SERVER] Failed to initialize:", error);
    process.exit(1);
});
