const server = require("./server.js");
import { env, tier } from "../configuration/index";
import { run_decay_process, prune_weak_waypoints } from "../retention/hsg";
import { mcp } from "../intelligence/mcp";
import { routes } from "./routes";
import {
  authenticate_api_request,
  log_authenticated_request,
} from "./middleware/auth";
import { start_reflection } from "../retention/reflect";
import { start_userSummary_reflection } from "../retention/userSummary";
import { sendTelemetry } from "../configuration/telemetry";

export function createApp() {
  const app = server({ max_payload_size: env.max_payload_size });

  app.use((req: any, res: any, next: any) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
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

  return app;
}

function startBackgroundJobs() {
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

  setTimeout(() => {
    run_decay_process()
      .then((result: any) => {
        console.log(
          `[INIT] Initial decay: ${result.decayed}/${result.processed} memories updated`,
        );
      })
      .catch(console.error);
  }, 3000);

  start_reflection();
  start_userSummary_reflection();
}

export function startServer() {
  if (env.emb_kind !== "synthetic" && (tier === "hybrid" || tier === "fast")) {
    console.warn(
      `[CONFIG] WARNING: Embedding configuration mismatch detected!\n` +
        `         OM_EMBEDDINGS=${env.emb_kind} but OM_TIER=${tier}\n` +
        `         Storage will use ${env.emb_kind} embeddings, but queries will use synthetic embeddings.\n` +
        `         This causes semantic search to fail. Set OM_TIER=deep to fix.`,
    );
  }

  const app = createApp();
  startBackgroundJobs();

  console.log(`[SERVER] Starting on port ${env.port}`);
  app.listen(env.port, () => {
    console.log(`[SERVER] Running on http://localhost:${env.port}`);
    sendTelemetry().catch(() => {});
  });

  return app;
}
