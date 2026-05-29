/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename: packages/openmemory-js/src/api/index.ts
 - what is the file used for: creates and starts the openmemory http server app
*/

import { env } from "../configuration/index";
import { routes } from "./routes";
import {
  authenticate_api_request,
  log_authenticated_request,
} from "./middleware/auth";
import { send_telemetry } from "../configuration/telemetry";
import { createHttpApp } from "./httpApp";

export function createApp() {
  const app = createHttpApp({ max_payload_size: env.max_payload_size });

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

  return app;
}

export function startServer() {
  const app = createApp();

  console.log(`[SERVER] Starting on port ${env.port}`);
  app.listen(env.port, () => {
    console.log(`[SERVER] Running on http://localhost:${env.port}`);
    send_telemetry().catch(() => {});
  });

  return app;
}
