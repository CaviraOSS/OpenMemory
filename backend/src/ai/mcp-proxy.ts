import type { IncomingMessage, ServerResponse } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { env } from "../core/cfg";
import {
    add_hsg_memory,
    hsg_query,
    reinforce_memory,
} from "../memory/hsg";
import { q, get_async } from "../core/db";
import type { sector_type } from "../core/types";

interface AgentRegistration {
    agent_id: string;
    namespace: string;
    permissions: ('read' | 'write' | 'admin')[];
    shared_namespaces: string[];
    api_key: string;
    description?: string;
    registration_date: number;
    last_access: number;
}

interface NamespaceGroup {
    namespace: string;
    group_type: 'private' | 'shared' | 'public';
    description?: string;
    created_by?: string;
    created_at: number;
}

const sec_enum = z.enum([
    "episodic",
    "semantic", 
    "procedural",
    "emotional",
    "reflective",
] as const);

const trunc = (val: string, max = 200) =>
    val.length <= max ? val : `${val.slice(0, max).trimEnd()}...`;

const fmt_matches = (matches: Awaited<ReturnType<typeof hsg_query>>) =>
    matches
        .map((m: any, idx: any) => {
            const prev = trunc(m.content.replace(/\s+/g, " ").trim(), 200);
            return `${idx + 1}. [${m.primary_sector}] score=${m.score.toFixed(3)} salience=${m.salience.toFixed(3)} id=${m.id}\n${prev}`;
        })
        .join("\n\n");

export class OpenMemoryMCPProxy {
    private agents = new Map<string, AgentRegistration>();
    private namespaces = new Map<string, NamespaceGroup>();
    private srv: McpServer;
    private transport?: StreamableHTTPServerTransport;

    constructor() {
        this.srv = new McpServer(
            {
                name: "openmemory-proxy",
                version: "1.0.0",
                protocolVersion: "2025-06-18",
            },
            { capabilities: { tools: {}, resources: {}, logging: {} } },
        );
        this.setupTools();
        this.loadPersistedData();
    }

    private setupTools() {
        // Get registration template
        this.srv.tool("get_registration_template",
            "Get a template for registering an agent with OpenMemory",
            {
                format: z.enum(["json", "curl", "prompt", "example"]).default("json")
                    .describe("Format for the registration template")
            },
            async (params: any) => {
                const { format } = params;
                return { content: [{ type: "text", text: this.getRegistrationTemplate(format) }] };
            }
        );

        // Get configuration info
        this.srv.tool("get_proxy_info",
            "Get information about the proxy service capabilities and configuration",
            {},
            async () => {
                return { content: [{ type: "text", text: this.getProxyInfo() }] };
            }
        );

        // Register agent
        this.srv.tool("register_agent",
            "Register an agent for namespace access",
            {
                agent_id: z.string().min(1).describe("Unique identifier for the agent"),
                namespace: z.string().min(1).describe("Primary namespace for agent memories"),
                permissions: z.array(z.enum(["read", "write", "admin"])).default(["read", "write"])
                    .describe("Permissions for the primary namespace"),
                shared_namespaces: z.array(z.string()).optional()
                    .describe("Additional namespaces this agent can access"),
                description: z.string().optional().describe("Agent description for documentation")
            },
            async (params: any) => {
                const { agent_id, namespace, permissions, shared_namespaces, description } = params;
                
                if (this.agents.has(agent_id)) {
                    throw new Error(`Agent ${agent_id} is already registered`);
                }

                const registration: AgentRegistration = {
                    agent_id,
                    namespace,
                    permissions,
                    shared_namespaces: shared_namespaces || [],
                    api_key: this.generateApiKey(),
                    description,
                    registration_date: Date.now(),
                    last_access: Date.now()
                };

                // Save to database
                const now = Math.floor(Date.now() / 1000); // Unix timestamp
                await q.ins_agent.run(
                    agent_id,
                    namespace,
                    JSON.stringify(permissions),
                    JSON.stringify(shared_namespaces || []),
                    registration.api_key,
                    description,
                    now,
                    now,
                    1 // active
                );

                // Update in-memory storage
                this.agents.set(agent_id, registration);
                
                // Create namespace if it doesn't exist
                if (!this.namespaces.has(namespace)) {
                    const namespaceGroup: NamespaceGroup = {
                        namespace,
                        group_type: 'private',
                        description: `Private namespace for agent ${agent_id}`,
                        created_by: agent_id,
                        created_at: Date.now()
                    };

                    await q.ins_namespace.run(
                        namespace,
                        'private',
                        namespaceGroup.description,
                        agent_id,
                        now,
                        now,
                        1 // active
                    );

                    this.namespaces.set(namespace, namespaceGroup);
                }

                await this.persistAgentData();
                
                return { 
                    content: [{ 
                        type: "text", 
                        text: this.formatRegistrationResponse(registration)
                    }] 
                };
            }
        );

        // List registered agents
        this.srv.tool("list_agents",
            "List all registered agents and their namespaces",
            {
                show_api_keys: z.boolean().default(false).describe("Whether to include API keys in output"),
                agent_id: z.string().optional().describe("Filter to specific agent")
            },
            async (params: any) => {
                const { show_api_keys, agent_id } = params;
                
                let agentsToShow = Array.from(this.agents.values());
                
                if (agent_id) {
                    agentsToShow = agentsToShow.filter(a => a.agent_id === agent_id);
                }

                const agents = agentsToShow.map(agent => ({
                    agent_id: agent.agent_id,
                    namespace: agent.namespace,
                    permissions: agent.permissions,
                    shared_namespaces: agent.shared_namespaces,
                    description: agent.description,
                    registration_date: new Date(agent.registration_date).toISOString(),
                    last_access: new Date(agent.last_access).toISOString(),
                    ...(show_api_keys && { api_key: agent.api_key })
                }));

                return { 
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify(agents, null, 2)
                    }] 
                };
            }
        );

        // Get specific agent details
        this.srv.tool("get_agent",
            "Get detailed information about a specific agent",
            {
                agent_id: z.string().min(1).describe("Agent ID to retrieve"),
                include_api_key: z.boolean().default(false).describe("Whether to include the API key in response"),
                include_access_log: z.boolean().default(false).describe("Whether to include recent access log entries")
            },
            async (params: any) => {
                const { agent_id, include_api_key, include_access_log } = params;
                
                const agent = this.agents.get(agent_id);
                if (!agent) {
                    throw new Error(`Agent '${agent_id}' not found`);
                }

                const agentDetails = {
                    agent_id: agent.agent_id,
                    namespace: agent.namespace,
                    permissions: agent.permissions,
                    shared_namespaces: agent.shared_namespaces,
                    description: agent.description,
                    registration_date: new Date(agent.registration_date).toISOString(),
                    last_access: new Date(agent.last_access).toISOString(),
                    status: "active",
                    ...(include_api_key && { api_key: agent.api_key })
                };

                // Add access log if requested
                if (include_access_log) {
                    try {
                        const accessLogs = await q.get_agent_access_log.all(agent_id, 10); // Last 10 entries
                        agentDetails.recent_access_log = accessLogs.map(log => ({
                            action: log.action,
                            namespace: log.namespace,
                            timestamp: new Date(log.timestamp * 1000).toISOString(),
                            success: log.success === 1,
                            error_message: log.error_message
                        }));
                    } catch (error) {
                        console.warn(`[MCP PROXY] Could not fetch access log for agent ${agent_id}:`, error);
                        agentDetails.recent_access_log = [];
                    }
                }

                return { 
                    content: [{ 
                        type: "text", 
                        text: JSON.stringify(agentDetails, null, 2)
                    }] 
                };
            }
        );

        // Namespaced memory operations
        this.srv.tool("query_memory",
            "Query memories from agent's authorized namespaces",
            {
                agent_id: z.string().describe("Requesting agent ID"),
                query: z.string().min(1).describe("Search query"),
                namespace: z.string().optional().describe("Target namespace (defaults to agent's primary)"),
                k: z.number().int().min(1).max(32).default(8).describe("Number of results to return"),
                sector: sec_enum.optional().describe("Restrict search to a specific sector"),
                min_salience: z.number().min(0).max(1).optional().describe("Minimum salience threshold"),
                api_key: z.string().optional().describe("Agent's API key for authentication")
            },
            async (params: any) => {
                const { agent_id, query, namespace, k, sector, min_salience, api_key } = params;
                
                const agent = this.validateAgent(agent_id, api_key);
                const target_ns = namespace || agent.namespace;
                this.validateNamespaceAccess(agent, target_ns, 'read');
                
                agent.last_access = Date.now();
                await q.upd_agent_access.run(agent_id, Math.floor(Date.now() / 1000));
                
                // Log the access
                await q.ins_access_log.run(
                    agent_id,
                    'query',
                    target_ns,
                    Math.floor(Date.now() / 1000),
                    1, // success
                    null // no error
                );

                // Build filters with namespace as user_id
                const filters = {
                    user_id: target_ns,
                    ...(sector ? { sectors: [sector as sector_type] } : {}),
                    ...(min_salience !== undefined ? { minSalience: min_salience } : {})
                };

                const matches = await hsg_query(query, k, filters);
                const summary = matches.length
                    ? fmt_matches(matches)
                    : "No memories matched the supplied query.";

                const payload = matches.map((m: any) => ({
                    id: m.id,
                    score: Number(m.score.toFixed(4)),
                    primary_sector: m.primary_sector,
                    sectors: m.sectors,
                    salience: Number(m.salience.toFixed(4)),
                    last_seen_at: m.last_seen_at,
                    path: m.path,
                    content: m.content,
                }));

                return { 
                    content: [
                        { type: "text", text: summary }
                    ],
                    meta: {
                        namespace: target_ns,
                        agent_id,
                        total_results: matches.length,
                        results: payload
                    }
                };
            }
        );

        this.srv.tool("store_memory",
            "Store a memory in agent's namespace",
            {
                agent_id: z.string().describe("Agent ID"),
                content: z.string().min(1).describe("Memory content to store"),
                namespace: z.string().optional().describe("Target namespace (defaults to agent's primary)"),
                sector: sec_enum.optional().describe("Memory sector classification"),
                salience: z.number().min(0).max(1).optional().describe("Memory importance (0-1)"),
                metadata: z.record(z.any()).optional().describe("Additional metadata"),
                api_key: z.string().optional().describe("Agent's API key")
            },
            async (params: any) => {
                const { agent_id, content, namespace, sector, salience, metadata, api_key } = params;
                
                const agent = this.validateAgent(agent_id, api_key);
                const target_ns = namespace || agent.namespace;
                this.validateNamespaceAccess(agent, target_ns, 'write');
                
                agent.last_access = Date.now();
                await q.upd_agent_access.run(agent_id, Math.floor(Date.now() / 1000));
                
                // Log the access
                await q.ins_access_log.run(
                    agent_id,
                    'store',
                    target_ns,
                    Math.floor(Date.now() / 1000),
                    1, // success
                    null // no error
                );

                // Store memory with namespace as user_id - fix the function signature
                const memory_id = await add_hsg_memory(
                    content,
                    metadata ? JSON.stringify(metadata) : undefined,
                    undefined, // metadata parameter
                    target_ns   // user_id parameter
                );

                return {
                    content: [{
                        type: "text",
                        text: `Memory stored successfully in namespace '${target_ns}' with ID: ${memory_id}`
                    }],
                    meta: {
                        memory_id,
                        namespace: target_ns,
                        agent_id
                    }
                };
            }
        );

        this.srv.tool("reinforce_memory",
            "Reinforce the salience of a specific memory",
            {
                agent_id: z.string().describe("Agent ID"),
                memory_id: z.string().describe("ID of memory to reinforce"),
                api_key: z.string().optional().describe("Agent's API key")
            },
            async (params: any) => {
                const { agent_id, memory_id, api_key } = params;
                
                const agent = this.validateAgent(agent_id, api_key);
                
                // Verify the memory belongs to an accessible namespace
                const memory = await q.get_mem.get(memory_id);
                if (!memory) {
                    throw new Error(`Memory ${memory_id} not found`);
                }
                
                this.validateNamespaceAccess(agent, memory.user_id || agent.namespace, 'write');
                
                agent.last_access = Date.now();
                await q.upd_agent_access.run(agent_id, Math.floor(Date.now() / 1000));
                
                // Log the access
                await q.ins_access_log.run(
                    agent_id,
                    'reinforce',
                    memory.user_id || agent.namespace,
                    Math.floor(Date.now() / 1000),
                    1, // success
                    null // no error
                );

                await reinforce_memory(memory_id);

                return {
                    content: [{
                        type: "text",
                        text: `Memory ${memory_id} reinforced successfully`
                    }]
                };
            }
        );
    }

    private getRegistrationTemplate(format: string): string {
        const baseTemplate = {
            agent_id: "my-ai-agent-v1",
            namespace: "agent-workspace",
            permissions: ["read", "write"],
            shared_namespaces: ["team-shared", "public-knowledge"],
            description: "AI assistant for project management tasks"
        };

        switch (format) {
            case "json":
                return JSON.stringify(baseTemplate, null, 2);
                
            case "curl":
                return `# Register via MCP tool call
# Use your MCP client to call: register_agent

${JSON.stringify(baseTemplate, null, 2)}`;
                
            case "prompt":
                return `# OpenMemory Agent Registration Guide

To register an agent with OpenMemory proxy, provide these parameters:

## Required Parameters

**agent_id**: Unique identifier for your agent
- Examples: "my-ai-agent-v1", "customer-support-bot", "data-analyst-ai"
- Must be unique across all registered agents

**namespace**: Primary workspace for your agent's memories  
- Examples: "agent-workspace", "customer-data", "research-notes"
- This is your agent's private memory space
- Choose descriptive names that reflect the agent's purpose

## Optional Parameters

**permissions**: What your agent can do in its namespace (default: ["read", "write"])
- "read": Query and retrieve memories
- "write": Store new memories and update existing ones  
- "admin": Full control including deletion and namespace management

**shared_namespaces**: Additional namespaces your agent can access
- Examples: ["team-shared", "public-knowledge", "company-policies"]
- Useful for accessing common knowledge or team collaboration
- Agents get read-only access to shared namespaces

**description**: Human-readable description of your agent's purpose
- Helps with documentation and management
- Examples: "Customer support chatbot", "Research assistant for papers"

Use the 'register_agent' tool with these parameters to complete registration.`;
                
            case "example":
                return `# Example Agent Registrations

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
\`\`\``;
                
            default:
                return JSON.stringify(baseTemplate, null, 2);
        }
    }

    private getProxyInfo(): string {
        return `# OpenMemory MCP Proxy Service

## Overview
Namespace-aware proxy for OpenMemory that provides secure multi-agent access with isolation and collaboration features.

## Capabilities
- **Agent Registration**: Secure namespace isolation per agent
- **Shared Namespaces**: Cross-agent collaboration spaces  
- **Permission Management**: Read/write/admin access controls
- **Memory Operations**: Query, store, reinforce memories with namespace awareness
- **API Key Authentication**: Secure agent identification
- **Template Generation**: Built-in registration guidance

## Available Tools

### Registration & Management
- \`get_registration_template\` - Get registration examples and templates
- \`get_proxy_info\` - This information
- \`register_agent\` - Register a new agent with namespace access
- \`list_agents\` - View all registered agents
- \`get_agent\` - Get detailed information about a specific agent

### Memory Operations  
- \`query_memory\` - Search memories in authorized namespaces
- \`store_memory\` - Store new memories in agent namespace
- \`reinforce_memory\` - Boost salience of specific memories

## Current Configuration
- Port: ${env.port}
- Rate Limiting: ${env.rate_limit_enabled ? 'Enabled' : 'Disabled'}
- Database: ${env.db_path}

## Usage Workflow
1. \`get_registration_template\` -> Get registration guidance
2. \`register_agent\` -> Register your agent
3. Save API key for authenticated operations
4. Use \`query_memory\` and \`store_memory\` for operations

Ready to start building intelligent memory-aware applications! 🚀`;
    }

    private formatRegistrationResponse(registration: AgentRegistration): string {
        return `# Agent Registration Successful ✅

**Agent ID**: ${registration.agent_id}
**Primary Namespace**: ${registration.namespace}
**Permissions**: ${registration.permissions.join(', ')}
**Shared Namespaces**: ${registration.shared_namespaces.length > 0 ? registration.shared_namespaces.join(', ') : 'None'}
**API Key**: ${registration.api_key}
**Registration Date**: ${new Date(registration.registration_date).toISOString()}
${registration.description ? `**Description**: ${registration.description}` : ''}

## 🔑 Important: Save Your API Key
\`\`\`
${registration.api_key}
\`\`\`

## Next Steps

### Test Connectivity
\`\`\`json
{
  "agent_id": "${registration.agent_id}",
  "query": "test query",
  "api_key": "${registration.api_key}"
}
\`\`\`

### Store First Memory
\`\`\`json
{
  "agent_id": "${registration.agent_id}",
  "content": "This is my first memory in OpenMemory",
  "api_key": "${registration.api_key}"
}
\`\`\`

Ready to start using OpenMemory! 🚀`;
    }

    private generateApiKey(): string {
        return 'omp_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    private validateAgent(agent_id: string, api_key?: string): AgentRegistration {
        const agent = this.agents.get(agent_id);
        if (!agent) {
            throw new Error(`Agent '${agent_id}' is not registered`);
        }
        if (api_key && agent.api_key !== api_key) {
            throw new Error("Invalid API key provided");
        }
        return agent;
    }

    private validateNamespaceAccess(
        agent: AgentRegistration, 
        namespace: string, 
        operation: string = 'read'
    ): void {
        const isPrimaryNamespace = namespace === agent.namespace;
        const hasSharedAccess = agent.shared_namespaces.includes(namespace);
        
        if (!isPrimaryNamespace && !hasSharedAccess) {
            throw new Error(`Access denied: Agent '${agent.agent_id}' cannot access namespace '${namespace}'`);
        }
        
        // Write/admin operations only allowed in primary namespace
        if ((operation === 'write' || operation === 'admin') && !isPrimaryNamespace) {
            throw new Error(`Write access denied: Agent can only write to primary namespace '${agent.namespace}'`);
        }
        
        // Admin operations require admin permission
        if (operation === 'admin' && !agent.permissions.includes('admin')) {
            throw new Error(`Admin access denied: Agent '${agent.agent_id}' lacks admin permissions`);
        }
        
        // Write operations require write permission
        if (operation === 'write' && !agent.permissions.includes('write')) {
            throw new Error(`Write access denied: Agent '${agent.agent_id}' lacks write permissions`);
        }
    }

    private async loadPersistedData(): Promise<void> {
        try {
            // Check if agent_registrations table exists before trying to load data
            const tableExists = await this.checkTableExists('agent_registrations');
            if (!tableExists) {
                console.log(`[MCP Proxy] Agent registration tables not found, skipping data load. Run migration to create tables.`);
                return;
            }

            // Load agents from database
            const agents = await q.all_agents.all();
            for (const agent of agents) {
                this.agents.set(agent.agent_id, {
                    agent_id: agent.agent_id,
                    namespace: agent.namespace,
                    permissions: JSON.parse(agent.permissions),
                    shared_namespaces: JSON.parse(agent.shared_namespaces),
                    api_key: agent.api_key,
                    description: agent.description,
                    registration_date: agent.registration_date * 1000, // Convert from Unix timestamp
                    last_access: agent.last_access * 1000
                });
            }

            // Load namespaces from database
            const namespaces = await q.all_namespaces.all();
            for (const ns of namespaces) {
                this.namespaces.set(ns.namespace, {
                    namespace: ns.namespace,
                    group_type: ns.group_type,
                    description: ns.description,
                    created_by: ns.created_by,
                    created_at: ns.created_at * 1000
                });
            }

            console.log(`[MCP Proxy] Loaded ${agents.length} agents and ${namespaces.length} namespaces from database`);
        } catch (error) {
            console.warn("[MCP Proxy] Failed to load persisted data:", error);
        }
    }

    private async checkTableExists(tableName: string): Promise<boolean> {
        try {
            const result = await get_async(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
            return !!result;
        } catch (error) {
            return false;
        }
    }

    private async persistAgentData(): Promise<void> {
        // Data is automatically persisted via database operations in the MCP tool handlers
        // This method is kept for compatibility but doesn't need to do anything
    }

    private setHeaders(res: ServerResponse): void {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type,Authorization,Mcp-Session-Id",
        );
    }

    private sendError(
        res: ServerResponse,
        code: number,
        message: string,
        id: number | string | null = null,
        status = 400,
    ): void {
        if (!res.headersSent) {
            res.statusCode = status;
            this.setHeaders(res);
            res.end(
                JSON.stringify({
                    jsonrpc: "2.0",
                    error: { code, message },
                    id,
                }),
            );
        }
    }

    private async extractPayload(req: IncomingMessage): Promise<any> {
        if ((req as any).body !== undefined) {
            if (typeof (req as any).body === "string") {
                if (!(req as any).body.trim()) return undefined;
                return JSON.parse((req as any).body);
            }
            if (typeof (req as any).body === "object" && (req as any).body !== null) return (req as any).body;
            return undefined;
        }
        const raw = await new Promise<string>((resolve, reject) => {
            let buf = "";
            req.on("data", (chunk) => {
                buf += chunk;
            });
            req.on("end", () => resolve(buf));
            req.on("error", reject);
        });
        if (!raw.trim()) return undefined;
        return JSON.parse(raw);
    }

    public getServer(): McpServer {
        return this.srv;
    }

    public async httpHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
        try {
            // Extract JSON payload from request
            const pay = await this.extractPayload(req);
            if (!pay || typeof pay !== "object") {
                this.sendError(res, -32600, "Request body must be a JSON object");
                return;
            }
            
            console.log("[MCP PROXY] Incoming request:", JSON.stringify(pay));
            this.setHeaders(res);
            
            // Use transport to handle the request
            if (!this.transport) {
                this.transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined,
                    enableJsonResponse: true,
                });
                await this.srv.connect(this.transport);
            }
            
            await this.transport.handleRequest(req, res, pay);
        } catch (error) {
            console.error("[MCP PROXY] Error handling request:", error);
            if (error instanceof SyntaxError) {
                this.sendError(res, -32600, "Invalid JSON payload");
                return;
            }
            if (!res.headersSent) {
                this.sendError(
                    res,
                    -32603,
                    "Internal server error",
                    (error as any)?.id ?? null,
                    500,
                );
            }
        }
    }

    public async stdioHandler(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.srv.connect(transport);
    }
}

export const create_proxy_srv = () => new OpenMemoryMCPProxy();