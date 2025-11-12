#!/usr/bin/env tsx

import { get_proxy_instance } from "./server/proxy";
import { env } from "./core/cfg";
import { runMigration } from "./scripts/migrate-agent-tables";

const server = require("./server/server.js");

const ASC = `   ____  __  __  _____   _____
  / __ \\|  \\/  |/ ____| |  __ \\
 | |  | | \\  / | |      | |__) | __ _____  ___   _ 
 | |  | | |\\/| | |      |  ___/ '__/ _ \\ \\/ / | | |
 | |__| | |  | | |____  | |   | | | (_) >  <| |_| |
  \\____/|_|  |_|\\____| |_|   |_|  \\___/_/\\_\\\\__, |
                                             __/ |
              MCP Proxy Service              |___/ `;

async function startProxyServer() {
    console.log(ASC);
    console.log(`[MCP PROXY] Starting standalone MCP proxy service...`);
    console.log(`[CONFIG] Port: ${env.port}`);
    console.log(`[CONFIG] Database: ${env.db_path}`);

    try {
        // Run database migration to ensure agent tables exist
        console.log("[MIGRATION] Running agent registration migration...");
        await runMigration();

        // Create Express app
        const app = server({ max_payload_size: env.max_payload_size });

        // CORS middleware
        app.use((req: any, res: any, next: any) => {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader(
                "Access-Control-Allow-Methods", 
                "GET,POST,PUT,DELETE,OPTIONS"
            );
            res.setHeader(
                "Access-Control-Allow-Headers",
                "Content-Type,Authorization,x-api-key"
            );
            if (req.method === "OPTIONS") {
                res.status(200).end();
                return;
            }
            next();
        });

        // Initialize and get proxy instance
        const proxy = get_proxy_instance();
        
        // Add proxy routes only
        const { proxy_routes } = await import("./server/proxy");
        proxy_routes(app);

        // Root endpoint
        app.get("/", (req: any, res: any) => {
            res.json({
                service: "OpenMemory MCP Proxy",
                version: "1.0.0",
                description: "Multi-agent namespace-aware MCP proxy for OpenMemory",
                endpoints: {
                    mcp: "/mcp-proxy",
                    agents: "/api/agents", 
                    namespaces: "/api/namespaces",
                    info: "/api/proxy-info",
                    templates: "/api/registration-template",
                    health: "/api/proxy-health"
                },
                documentation: "See /api/proxy-info for detailed service information"
            });
        });

        // Start server
        app.listen(env.port, () => {
            console.log(`[MCP PROXY] ✅ Service running on http://localhost:${env.port}`);
            console.log(`[MCP PROXY] 📚 API Documentation: http://localhost:${env.port}/api/proxy-info`);
            console.log(`[MCP PROXY] 🔗 MCP Endpoint: http://localhost:${env.port}/mcp-proxy`);
            console.log(`[MCP PROXY] ❤️  Health Check: http://localhost:${env.port}/api/proxy-health`);
        });

    } catch (error) {
        console.error("❌ Failed to start MCP proxy server:", error);
        process.exit(1);
    }
}

// Start the proxy server if this is the main module
if (require.main === module) {
    startProxyServer();
}

export { startProxyServer };