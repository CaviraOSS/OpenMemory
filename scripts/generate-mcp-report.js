#!/usr/bin/env node

/**
 * OpenMemory MCP Tools & API Report Generator
 * 
 * Generates comprehensive documentation of all MCP tools, resources, prompts,
 * and their associated API endpoints for OpenMemory.
 */

const fs = require('fs');
const path = require('path');

// Report data structure
const report = {
    generated_at: new Date().toISOString(),
    services: {
        main_mcp: {
            name: "OpenMemory Main MCP Server",
            endpoint: "POST http://localhost:8080/mcp",
            stdio_mode: "node backend/dist/ai/mcp.js",
            tools: [],
            resources: [],
            prompts: []
        },
        proxy_mcp: {
            name: "OpenMemory MCP Proxy Server", 
            endpoint: "POST http://localhost:8080/mcp-proxy",
            standalone_endpoint: "POST http://localhost:8081/mcp-proxy",
            tools: [],
            resources: [],
            prompts: []
        }
    },
    rest_apis: []
};

// Main MCP Server Tools
report.services.main_mcp.tools = [
    {
        name: "openmemory_query",
        description: "Run a semantic retrieval against OpenMemory",
        parameters: [
            { name: "query", type: "string", required: true, description: "Free-form search text" },
            { name: "k", type: "number", required: false, default: 8, description: "Maximum results to return (1-32)" },
            { name: "sector", type: "enum", required: false, description: "Restrict search to specific sector", values: ["episodic", "semantic", "procedural", "emotional", "reflective"] },
            { name: "min_salience", type: "number", required: false, description: "Minimum salience threshold (0-1)" },
            { name: "user_id", type: "string", required: false, description: "Isolate results to specific user identifier" }
        ],
        returns: "Memory search results with scores and content",
        related_api: "POST /memory/query"
    },
    {
        name: "openmemory_store",
        description: "Persist new content into OpenMemory",
        parameters: [
            { name: "content", type: "string", required: true, description: "Raw memory text to store" },
            { name: "tags", type: "array", required: false, description: "Optional tag list" },
            { name: "metadata", type: "object", required: false, description: "Arbitrary metadata blob" },
            { name: "user_id", type: "string", required: false, description: "Associate memory with specific user identifier" }
        ],
        returns: "Stored memory ID and sector assignments",
        related_api: "POST /memory/add"
    },
    {
        name: "openmemory_reinforce",
        description: "Boost salience for an existing memory",
        parameters: [
            { name: "id", type: "string", required: true, description: "Memory identifier to reinforce" },
            { name: "boost", type: "number", required: false, default: 0.1, description: "Salience boost amount (0.01-1)" }
        ],
        returns: "Confirmation of reinforcement",
        related_api: "POST /memory/reinforce"
    },
    {
        name: "openmemory_list",
        description: "List recent memories for quick inspection",
        parameters: [
            { name: "limit", type: "number", required: false, default: 10, description: "Number of memories to return (1-50)" },
            { name: "sector", type: "enum", required: false, description: "Optionally limit to a sector", values: ["episodic", "semantic", "procedural", "emotional", "reflective"] },
            { name: "user_id", type: "string", required: false, description: "Restrict results to specific user identifier" }
        ],
        returns: "List of memory summaries with metadata",
        related_api: "GET /memory/all"
    },
    {
        name: "openmemory_get",
        description: "Fetch a single memory by identifier",
        parameters: [
            { name: "id", type: "string", required: true, description: "Memory identifier to load" },
            { name: "include_vectors", type: "boolean", required: false, default: false, description: "Include sector vector metadata" },
            { name: "user_id", type: "string", required: false, description: "Validate ownership against specific user identifier" }
        ],
        returns: "Complete memory data including content and metadata",
        related_api: "GET /memory/{id}"
    }
];

// Main MCP Server Resources
report.services.main_mcp.resources = [
    {
        name: "openmemory-config",
        uri: "openmemory://config",
        mimeType: "application/json",
        description: "Runtime configuration snapshot for the OpenMemory MCP server",
        content_includes: [
            "Server mode and version",
            "Available sectors and configurations",
            "Memory statistics by sector",
            "Embeddings provider information",
            "Available MCP tools list"
        ],
        related_api: "GET /api/config"
    }
];

// Proxy MCP Server Tools
report.services.proxy_mcp.tools = [
    {
        name: "get_registration_template",
        description: "Get a template for registering an agent with OpenMemory",
        parameters: [
            { name: "format", type: "enum", required: false, default: "json", description: "Format for the registration template", values: ["json", "curl", "prompt", "example"] }
        ],
        returns: "Agent registration template in specified format",
        related_api: "GET /api/registration-template/{format}"
    },
    {
        name: "get_proxy_info",
        description: "Get information about the proxy service capabilities and configuration",
        parameters: [],
        returns: "Proxy service information and capabilities",
        related_api: "GET /api/proxy-info"
    },
    {
        name: "register_agent",
        description: "Register an agent for namespace access",
        parameters: [
            { name: "agent_id", type: "string", required: true, description: "Unique identifier for the agent" },
            { name: "namespace", type: "string", required: true, description: "Primary namespace for agent memories" },
            { name: "permissions", type: "array", required: false, default: ["read", "write"], description: "Permissions for the primary namespace", values: ["read", "write", "admin"] },
            { name: "shared_namespaces", type: "array", required: false, description: "Additional namespaces this agent can access" },
            { name: "description", type: "string", required: false, description: "Agent description for documentation" }
        ],
        returns: "Registration confirmation with API key",
        related_api: "POST /api/agents"
    },
    {
        name: "list_agents",
        description: "List all registered agents and their namespaces",
        parameters: [
            { name: "show_api_keys", type: "boolean", required: false, default: false, description: "Whether to include API keys in output" },
            { name: "agent_id", type: "string", required: false, description: "Filter to specific agent" }
        ],
        returns: "List of registered agents with their configurations",
        related_api: "GET /api/agents"
    },
    {
        name: "query_memory",
        description: "Query memories from agent's authorized namespaces",
        parameters: [
            { name: "agent_id", type: "string", required: true, description: "Requesting agent ID" },
            { name: "query", type: "string", required: true, description: "Search query" },
            { name: "namespace", type: "string", required: false, description: "Target namespace (defaults to agent's primary)" },
            { name: "k", type: "number", required: false, default: 8, description: "Number of results to return" },
            { name: "sector", type: "enum", required: false, description: "Restrict search to specific sector", values: ["episodic", "semantic", "procedural", "emotional", "reflective"] },
            { name: "min_salience", type: "number", required: false, description: "Minimum salience threshold" },
            { name: "api_key", type: "string", required: false, description: "Agent's API key for authentication" }
        ],
        returns: "Namespace-scoped memory search results",
        related_api: "POST /memory/query"
    },
    {
        name: "store_memory",
        description: "Store a memory in agent's namespace",
        parameters: [
            { name: "agent_id", type: "string", required: true, description: "Agent ID" },
            { name: "content", type: "string", required: true, description: "Memory content to store" },
            { name: "namespace", type: "string", required: false, description: "Target namespace (defaults to agent's primary)" },
            { name: "sector", type: "enum", required: false, description: "Memory sector classification", values: ["episodic", "semantic", "procedural", "emotional", "reflective"] },
            { name: "salience", type: "number", required: false, description: "Memory importance (0-1)" },
            { name: "metadata", type: "object", required: false, description: "Additional metadata" },
            { name: "api_key", type: "string", required: false, description: "Agent's API key" }
        ],
        returns: "Storage confirmation with memory ID",
        related_api: "POST /memory/add"
    },
    {
        name: "reinforce_memory",
        description: "Reinforce the salience of a specific memory",
        parameters: [
            { name: "agent_id", type: "string", required: true, description: "Agent ID" },
            { name: "memory_id", type: "string", required: true, description: "ID of memory to reinforce" },
            { name: "api_key", type: "string", required: false, description: "Agent's API key" }
        ],
        returns: "Reinforcement confirmation",
        related_api: "POST /memory/reinforce"
    }
];

// REST API Endpoints
report.rest_apis = [
    {
        method: "GET",
        endpoint: "/health",
        description: "Health check endpoint",
        service: "Main Backend",
        port: 8080,
        authentication: false,
        returns: "Service health status"
    },
    {
        method: "GET",
        endpoint: "/api-docs",
        description: "Swagger API documentation",
        service: "Main Backend", 
        port: 8080,
        authentication: false,
        returns: "Interactive API documentation"
    },
    {
        method: "GET",
        endpoint: "/openapi.json",
        description: "OpenAPI specification",
        service: "Main Backend",
        port: 8080,
        authentication: false,
        returns: "OpenAPI 3.0 specification"
    },
    {
        method: "POST",
        endpoint: "/mcp",
        description: "Main MCP protocol endpoint",
        service: "Main Backend",
        port: 8080,
        authentication: "Optional (x-api-key header)",
        returns: "MCP JSON-RPC responses"
    },
    {
        method: "POST",
        endpoint: "/mcp-proxy",
        description: "MCP proxy protocol endpoint",
        service: "Main Backend / Proxy",
        port: "8080 / 8081",
        authentication: "Agent API key required",
        returns: "Namespace-aware MCP responses"
    },
    {
        method: "GET",
        endpoint: "/api/agents",
        description: "List all registered agents",
        service: "Proxy",
        port: "8080 / 8081",
        authentication: false,
        returns: "Agent list with configurations"
    },
    {
        method: "GET",
        endpoint: "/api/agents/{id}",
        description: "Get specific agent details",
        service: "Proxy",
        port: "8080 / 8081",
        authentication: false,
        returns: "Agent configuration and status"
    },
    {
        method: "GET",
        endpoint: "/api/namespaces",
        description: "List all namespaces",
        service: "Proxy",
        port: "8080 / 8081", 
        authentication: false,
        returns: "Namespace list with metadata"
    },
    {
        method: "GET",
        endpoint: "/api/proxy-info",
        description: "Service information and statistics",
        service: "Proxy",
        port: "8080 / 8081",
        authentication: false,
        returns: "Proxy capabilities and stats"
    },
    {
        method: "GET",
        endpoint: "/api/registration-template/{format}",
        description: "Get registration templates",
        service: "Proxy",
        port: "8080 / 8081",
        authentication: false,
        returns: "Agent registration templates"
    },
    {
        method: "GET",
        endpoint: "/api/proxy-health",
        description: "Proxy health check",
        service: "Proxy",
        port: "8080 / 8081",
        authentication: false,
        returns: "Proxy service health status"
    },
    {
        method: "POST",
        endpoint: "/memory/add",
        description: "Store new memory",
        service: "Main Backend",
        port: 8080,
        authentication: "Optional (x-api-key header)",
        returns: "Memory ID and metadata"
    },
    {
        method: "POST",
        endpoint: "/memory/query",
        description: "Query memories",
        service: "Main Backend",
        port: 8080,
        authentication: "Optional (x-api-key header)",
        returns: "Search results with scores"
    },
    {
        method: "GET",
        endpoint: "/memory/{id}",
        description: "Get specific memory",
        service: "Main Backend",
        port: 8080,
        authentication: "Optional (x-api-key header)",
        returns: "Complete memory data"
    },
    {
        method: "GET",
        endpoint: "/memory/all",
        description: "List memories (supports optional user_id filter)",
        service: "Main Backend",
        port: 8080,
        authentication: "Optional (x-api-key header)",
        returns: "Memory list with summaries"
    }
];

// Report generation functions
function generateMarkdownTable(headers, rows) {
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataRows = rows.map(row => `| ${row.join(' | ')} |`);
    return [headerRow, separatorRow, ...dataRows].join('\n');
}

function generateToolsTable(tools, serviceName) {
    const headers = ['Tool Name', 'Description', 'Key Parameters', 'Returns', 'Related API'];
    const rows = tools.map(tool => [
        `\`${tool.name}\``,
        tool.description,
        tool.parameters.slice(0, 3).map(p => `\`${p.name}\``).join(', ') + (tool.parameters.length > 3 ? '...' : ''),
        tool.returns,
        tool.related_api ? `\`${tool.related_api}\`` : 'N/A'
    ]);
    
    return `## ${serviceName} - MCP Tools\n\n${generateMarkdownTable(headers, rows)}`;
}

function generateResourcesTable(resources) {
    if (!resources.length) return '';
    
    const headers = ['Resource Name', 'URI', 'MIME Type', 'Description', 'Related API'];
    const rows = resources.map(resource => [
        `\`${resource.name}\``,
        `\`${resource.uri}\``,
        resource.mimeType,
        resource.description,
        resource.related_api ? `\`${resource.related_api}\`` : 'N/A'
    ]);
    
    return `## MCP Resources\n\n${generateMarkdownTable(headers, rows)}`;
}

function generateEndpointsTable() {
    const headers = ['Method', 'Endpoint', 'Service', 'Port(s)', 'Auth Required', 'Description'];
    const rows = report.rest_apis.map(api => [
        `**${api.method}**`,
        `\`${api.endpoint}\``,
        api.service,
        api.port.toString(),
        api.authentication === false ? '❌' : api.authentication === true ? '✅' : api.authentication,
        api.description
    ]);
    
    return `## REST API Endpoints\n\n${generateMarkdownTable(headers, rows)}`;
}

function generateParametersTable(tool) {
    const headers = ['Parameter', 'Type', 'Required', 'Default', 'Description'];
    const rows = tool.parameters.map(param => [
        `\`${param.name}\``,
        param.type + (param.values ? ` (${param.values.join('|')})` : ''),
        param.required ? '✅' : '❌',
        param.default !== undefined ? `\`${param.default}\`` : '-',
        param.description
    ]);
    
    return generateMarkdownTable(headers, rows);
}

function generateFullReport() {
    let markdown = `# OpenMemory MCP Tools & API Report

Generated: ${report.generated_at}

## Overview

This report documents all Model Context Protocol (MCP) tools, resources, and REST API endpoints available in OpenMemory.

### Architecture Summary

- **Main MCP Server**: Core OpenMemory functionality via MCP protocol
- **Proxy MCP Server**: Multi-agent namespace management with isolation  
- **REST APIs**: Direct HTTP access to all functionality
- **Dashboard**: Web interface for memory visualization

---

`;

    // MCP Tools sections
    markdown += generateToolsTable(report.services.main_mcp.tools, 'Main MCP Server') + '\n\n';
    markdown += generateToolsTable(report.services.proxy_mcp.tools, 'Proxy MCP Server') + '\n\n';
    
    // Resources section
    if (report.services.main_mcp.resources.length > 0) {
        markdown += generateResourcesTable(report.services.main_mcp.resources) + '\n\n';
    }
    
    // REST API section
    markdown += generateEndpointsTable() + '\n\n';
    
    // Detailed tool parameters
    markdown += '## Detailed Tool Parameters\n\n';
    
    // Main MCP tools details
    markdown += '### Main MCP Server Tools\n\n';
    report.services.main_mcp.tools.forEach(tool => {
        markdown += `#### \`${tool.name}\`\n\n`;
        markdown += `${tool.description}\n\n`;
        markdown += `**Endpoint**: \`${report.services.main_mcp.endpoint}\`\n\n`;
        markdown += generateParametersTable(tool) + '\n\n';
    });
    
    // Proxy MCP tools details  
    markdown += '### Proxy MCP Server Tools\n\n';
    report.services.proxy_mcp.tools.forEach(tool => {
        markdown += `#### \`${tool.name}\`\n\n`;
        markdown += `${tool.description}\n\n`;
        markdown += `**Endpoints**: \n- \`${report.services.proxy_mcp.endpoint}\`\n- \`${report.services.proxy_mcp.standalone_endpoint}\`\n\n`;
        markdown += generateParametersTable(tool) + '\n\n';
    });
    
    // Usage examples
    markdown += generateUsageExamples();
    
    return markdown;
}

function generateUsageExamples() {
    return `## Usage Examples

### Main MCP Server (Direct Memory Operations)

\`\`\`bash
# Query memories
curl -X POST http://localhost:8080/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "openmemory_query",
      "arguments": {
        "query": "machine learning concepts",
        "k": 5,
        "sector": "semantic"
      }
    }
  }'
\`\`\`

### Proxy MCP Server (Agent Management)

\`\`\`bash
# Register a new agent
curl -X POST http://localhost:8080/mcp-proxy \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0", 
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "register_agent",
      "arguments": {
        "agent_id": "research-bot-v1",
        "namespace": "research-data",
        "permissions": ["read", "write"],
        "shared_namespaces": ["public-knowledge"],
        "description": "AI research assistant"
      }
    }
  }'
\`\`\`

### REST API Examples

\`\`\`bash
# List all agents
curl http://localhost:8080/api/agents

# Get proxy service info
curl http://localhost:8080/api/proxy-info

# Health check
curl http://localhost:8080/health
\`\`\`

### IDE Integration

**Claude Desktop Integration:**
\`\`\`json
{
  "mcpServers": {
    "openmemory": {
      "command": "node",
      "args": ["backend/dist/ai/mcp.js"],
      "env": {
        "OM_API_KEY": "your-api-key"
      }
    }
  }
}
\`\`\`

**VS Code/Cursor Integration:**
\`\`\`json
{
  "name": "OpenMemory",
  "type": "mcp",
  "mcp": {
    "server": "backend/dist/ai/mcp.js",
    "tools": ["openmemory_query", "openmemory_store", "openmemory_list"]
  }
}
\`\`\`

---

*Report generated by OpenMemory MCP Tools & API Report Generator*
`;
}

// Generate JSON report
function generateJsonReport() {
    return JSON.stringify(report, null, 2);
}

// Main execution
function main() {
    const outputDir = path.join(__dirname, '..', '.tmp');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Generate reports
    const markdownReport = generateFullReport();
    const jsonReport = generateJsonReport();
    
    // Write files
    const markdownPath = path.join(outputDir, 'mcp-tools-api-report.md');
    const jsonPath = path.join(outputDir, 'mcp-tools-api-report.json');
    
    fs.writeFileSync(markdownPath, markdownReport);
    fs.writeFileSync(jsonPath, jsonReport);
    
    console.log('✅ MCP Tools & API Report Generated Successfully!');
    console.log(`📄 Markdown: ${markdownPath}`);
    console.log(`📊 JSON: ${jsonPath}`);
    console.log('');
    console.log('📋 Summary:');
    console.log(`   • Main MCP Tools: ${report.services.main_mcp.tools.length}`);
    console.log(`   • Proxy MCP Tools: ${report.services.proxy_mcp.tools.length}`);
    console.log(`   • MCP Resources: ${report.services.main_mcp.resources.length}`);
    console.log(`   • REST API Endpoints: ${report.rest_apis.length}`);
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { generateFullReport, generateJsonReport, report };