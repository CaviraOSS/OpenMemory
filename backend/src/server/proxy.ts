import type { IncomingMessage, ServerResponse } from "http";
import { create_proxy_srv } from "../ai/mcp-proxy";
import { env } from "../core/cfg";
import { q } from "../core/db";

// Global proxy instance
let proxyInstance: ReturnType<typeof create_proxy_srv> | null = null;

export const get_proxy_instance = () => {
    if (!proxyInstance) {
        proxyInstance = create_proxy_srv();
    }
    return proxyInstance;
};

export const proxy_routes = (app: any) => {
    // Delay proxy creation until routes are actually called
    const getProxy = () => get_proxy_instance();

    // MCP proxy HTTP endpoint
    app.post("/mcp-proxy", async (req: IncomingMessage, res: ServerResponse) => {
        try {
            const proxy = getProxy();
            await proxy.httpHandler(req, res);
        } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ 
                error: "Proxy service error", 
                message: error instanceof Error ? error.message : String(error)
            }));
        }
    });

    app.options("/mcp-proxy", (_req: any, res: any) => {
        res.statusCode = 204;
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
        res.setHeader(
            "Access-Control-Allow-Headers", 
            "Content-Type,Authorization,Mcp-Session-Id"
        );
        res.end();
    });

    const methodNotAllowed = (_req: IncomingMessage, res: ServerResponse) => {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { 
                code: -32600, 
                message: "Method not supported. Use POST /mcp-proxy with JSON payload." 
            },
            id: null
        }));
    };
    
    app.get("/mcp-proxy", methodNotAllowed);
    app.put("/mcp-proxy", methodNotAllowed);
    app.delete("/mcp-proxy", methodNotAllowed);

    // REST endpoints for direct agent management using database queries
    app.get("/api/agents", async (req: any, res: any) => {
        try {
            const agents = await q.all_agents.all();
            res.json({ 
                agents: agents.map(agent => ({
                    agent_id: agent.agent_id,
                    namespace: agent.namespace,
                    permissions: JSON.parse(agent.permissions),
                    shared_namespaces: JSON.parse(agent.shared_namespaces),
                    description: agent.description,
                    registration_date: new Date(agent.registration_date * 1000).toISOString(),
                    last_access: new Date(agent.last_access * 1000).toISOString()
                })), 
                total: agents.length 
            });
        } catch (error) {
            res.status(500).json({ 
                error: "Failed to list agents", 
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    app.get("/api/agents/:agent_id", async (req: any, res: any) => {
        try {
            const { agent_id } = req.params;
            const agent = await q.get_agent.get(agent_id);
            
            if (!agent) {
                return res.status(404).json({ error: "Agent not found" });
            }

            res.json({
                agent_id: agent.agent_id,
                namespace: agent.namespace,
                permissions: JSON.parse(agent.permissions),
                shared_namespaces: JSON.parse(agent.shared_namespaces),
                description: agent.description,
                registration_date: new Date(agent.registration_date * 1000).toISOString(),
                last_access: new Date(agent.last_access * 1000).toISOString()
            });
        } catch (error) {
            res.status(500).json({ 
                error: "Failed to get agent", 
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    app.post("/api/agents", async (req: any, res: any) => {
        try {
            const { agent_id, namespace, permissions = ['read', 'write'], shared_namespaces = [], description = '' } = req.body;

            // Validate required fields
            if (!agent_id || !namespace) {
                return res.status(400).json({ 
                    error: "Missing required fields", 
                    message: "agent_id and namespace are required" 
                });
            }

            // Validate agent_id format
            if (!/^[a-zA-Z0-9_-]+$/.test(agent_id)) {
                return res.status(400).json({ 
                    error: "Invalid agent_id", 
                    message: "agent_id must contain only alphanumeric characters, hyphens, and underscores" 
                });
            }

            // Check if agent already exists
            const existingAgent = await q.get_agent.get(agent_id);
            const now = Math.floor(Date.now() / 1000);
            
            let api_key: string;
            let operation: string;
            let message: string;

            if (existingAgent) {
                // Update existing agent (idempotent operation)
                api_key = existingAgent.api_key; // Keep existing API key
                operation = 'update';
                message = `Agent '${agent_id}' updated successfully`;

                // Database query parameter order differs between PostgreSQL and SQLite
                if (env.metadata_backend === 'postgres') {
                    // PostgreSQL: agent_id, namespace, permissions, shared_namespaces, description, last_access
                    await q.upd_agent.run(
                        agent_id,
                        namespace,
                        JSON.stringify(permissions),
                        JSON.stringify(shared_namespaces),
                        description,
                        now
                    );
                } else {
                    // SQLite: namespace, permissions, shared_namespaces, description, last_access, agent_id
                    await q.upd_agent.run(
                        namespace,
                        JSON.stringify(permissions),
                        JSON.stringify(shared_namespaces),
                        description,
                        now,
                        agent_id
                    );
                }
            } else {
                // Create new agent
                const generateApiKey = () => 'omp_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
                api_key = generateApiKey();
                operation = 'register';
                message = `Agent '${agent_id}' registered successfully`;

                await q.ins_agent.run(
                    agent_id,
                    namespace,
                    JSON.stringify(permissions),
                    JSON.stringify(shared_namespaces),
                    api_key,
                    description,
                    now,  // registration_date
                    now,  // last_access
                    1     // active
                );
            }

            // Log the operation
            await q.ins_access_log.run(
                agent_id,
                operation,
                namespace,
                now,
                1,    // success
                null  // error_message
            );

            res.json({
                success: true,
                agent_id: agent_id,
                api_key: api_key,
                namespace: namespace,
                permissions: permissions,
                shared_namespaces: shared_namespaces,
                description: description,
                message: message
            });

        } catch (error) {
            console.error('[AGENT REGISTRATION] Error:', error);
            res.status(500).json({ 
                error: "Failed to register agent", 
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    app.get("/api/namespaces", async (req: any, res: any) => {
        try {
            const namespaces = await q.all_namespaces.all();
            res.json({ 
                namespaces: namespaces.map(ns => ({
                    namespace: ns.namespace,
                    group_type: ns.group_type,
                    description: ns.description,
                    created_by: ns.created_by,
                    created_at: new Date(ns.created_at * 1000).toISOString(),
                    updated_at: new Date(ns.updated_at * 1000).toISOString()
                })), 
                total: namespaces.length 
            });
        } catch (error) {
            res.status(500).json({ 
                error: "Failed to list namespaces", 
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    app.get("/api/proxy-info", async (req: any, res: any) => {
        try {
            const agentCount = (await q.all_agents.all()).length;
            const namespaceCount = (await q.all_namespaces.all()).length;
            
            const info = {
                service: "OpenMemory MCP Proxy",
                version: "1.0.0",
                capabilities: [
                    "Agent Registration",
                    "Namespace Management",
                    "Memory Operations",
                    "Access Control",
                    "Registration Templates"
                ],
                statistics: {
                    registered_agents: agentCount,
                    namespaces: namespaceCount,
                    port: env.port,
                    database: env.db_path
                },
                endpoints: {
                    mcp: "/mcp-proxy",
                    agents: "/api/agents",
                    namespaces: "/api/namespaces",
                    templates: "/api/registration-template",
                    health: "/api/proxy-health"
                }
            };
            
            res.json(info);
        } catch (error) {
            res.status(500).json({ 
                error: "Failed to get proxy info", 
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    app.get("/api/registration-template/:format?", async (req: any, res: any) => {
        try {
            const format = req.params.format || 'json';
            
            const baseTemplate = {
                agent_id: "my-ai-agent-v1",
                namespace: "agent-workspace",
                permissions: ["read", "write"],
                shared_namespaces: ["team-shared", "public-knowledge"],
                description: "AI assistant for project management tasks"
            };

            switch (format) {
                case 'json':
                    res.json({ template: baseTemplate });
                    break;
                case 'curl':
                    res.setHeader('Content-Type', 'text/plain');
                    res.send(`# Register via MCP proxy
# Use your MCP client to call: register_agent

${JSON.stringify(baseTemplate, null, 2)}`);
                    break;
                case 'example':
                    res.setHeader('Content-Type', 'text/markdown');
                    res.send(`# Example Agent Registrations

## Research Assistant
\`\`\`json
{
  "agent_id": "research-assistant-v2",
  "namespace": "research-data",
  "permissions": ["read", "write"],
  "shared_namespaces": ["public-papers", "team-research"],
  "description": "AI assistant for academic research and paper analysis"
}
\`\`\`

## Customer Support Bot
\`\`\`json
{
  "agent_id": "support-bot-prod",
  "namespace": "customer-interactions", 
  "permissions": ["read", "write"],
  "shared_namespaces": ["kb-articles", "product-docs"],
  "description": "Customer support chatbot with access to knowledge base"
}
\`\`\`

## Data Analysis Agent
\`\`\`json
{
  "agent_id": "data-analyst-01",
  "namespace": "analytics-workspace",
  "permissions": ["read", "write", "admin"],
  "shared_namespaces": ["company-metrics", "historical-data"],
  "description": "Automated data analysis with full workspace control"
}
\`\`\``);
                    break;
                default:
                    res.json({ template: baseTemplate });
            }
        } catch (error) {
            res.status(500).json({ 
                error: "Failed to get registration template", 
                message: error instanceof Error ? error.message : String(error)
            });
        }
    });

    // Health check for proxy service
    app.get("/api/proxy-health", (req: any, res: any) => {
        res.json({ 
            status: "healthy", 
            service: "openmemory-mcp-proxy",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
            uptime: process.uptime()
        });
    });

    console.log(`[OpenMemory] MCP Proxy service initialized on port ${env.port}`);
    console.log(`[OpenMemory] Proxy endpoints:`);
    console.log(`  POST /mcp-proxy - MCP protocol endpoint`);
    console.log(`  GET /api/agents - List registered agents`);
    console.log(`  GET /api/agents/:id - Get specific agent`);
    console.log(`  GET /api/namespaces - List namespaces`);
    console.log(`  GET /api/proxy-info - Service information`);
    console.log(`  GET /api/registration-template/:format - Registration templates`);
    console.log(`  GET /api/proxy-health - Health check`);
};

// Standalone proxy server function
export const start_proxy_server = async (port?: number) => {
    const proxy = get_proxy_instance();
    const serverPort = port || env.port + 1; // Use different port than main service
    
    console.log(`[OpenMemory] Starting standalone MCP proxy server on port ${serverPort}`);
    
    // For standalone operation, you would typically set up an HTTP server here
    // This is a placeholder for future standalone server implementation
    await proxy.stdioHandler(); // For now, use stdio mode
};