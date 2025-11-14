# OpenMemory MCP Tools & API Documentation

## Overview

This documentation provides comprehensive information about all MCP tools, resources, prompts, and REST API endpoints available in OpenMemory.

## Quick Reference Commands

```bash
# Generate full report (Markdown + JSON)
npm run mcp:report

# List all MCP tools
npm run mcp:tools

# List REST API endpoints
npm run mcp:apis

# Search tools and APIs
npm run mcp:search <term>

# Get specific tool details
npm run mcp:tool <tool_name>
```

## Generated Documentation

The report generator creates two files in `.tmp/`:

- **`mcp-tools-api-report.md`** - Complete Markdown documentation
- **`mcp-tools-api-report.json`** - Machine-readable JSON data

## Architecture Summary

### 🏗️ Service Architecture

1. **Main MCP Server** (`/mcp`)
   - Core OpenMemory functionality
   - Direct memory operations
   - Single-user or shared access
   - Port: 8080

2. **Proxy MCP Server** (`/mcp-proxy`)
   - Multi-agent namespace management
   - Agent registration and isolation
   - Shared namespace collaboration
   - Port: 8080 (integrated) / 8081 (standalone)

3. **REST API** (`/api/*`)
   - Direct HTTP access
   - Management endpoints
   - Health checks and monitoring
   - Port: 8080

4. **Dashboard** (Web UI)
   - Memory visualization
   - Agent management
   - Port: 3000

### 📊 Tool Categories

| Category            | Count | Description                                                 |
| ------------------- | ----- | ----------------------------------------------------------- |
| **Main MCP Tools**  | 5     | Core memory operations (query, store, list, get, reinforce) |
| **Proxy MCP Tools** | 7     | Agent management and namespace-aware operations             |
| **MCP Resources**   | 1     | Configuration and metadata resources                        |
| **REST Endpoints**  | 15    | HTTP API for all functionality                              |

### 🔧 Main MCP Tools

- `openmemory_query` - Semantic memory retrieval
- `openmemory_store` - Store new memories
- `openmemory_reinforce` - Boost memory salience
- `openmemory_list` - List recent memories
- `openmemory_get` - Fetch specific memory

### 🔐 Proxy MCP Tools

- `get_registration_template` - Get agent registration templates
- `get_proxy_info` - Service information and capabilities
- `register_agent` - Register new agent with namespace
- `list_agents` - List registered agents
- `query_memory` - Namespace-aware memory queries
- `store_memory` - Store memories in agent namespace
- `reinforce_memory` - Reinforce memories with agent auth

### 🌐 Key REST Endpoints

| Method | Endpoint            | Description                               |
| ------ | ------------------- | ----------------------------------------- |
| `POST` | `/mcp`              | Main MCP protocol                         |
| `POST` | `/mcp-proxy`        | Proxy MCP protocol                        |
| `GET`  | `/api/agents`       | List registered agents                    |
| `GET`  | `/api/namespaces`   | List namespaces                           |
| `GET`  | `/api/proxy-info`   | Proxy service info                        |
| `GET`  | `/api/proxy-health` | Health check                              |
| `POST` | `/memory/add`       | Store memories                            |
| `POST` | `/memory/query`     | Query memories                            |
| `GET`  | `/memory/all`       | List memories (optional `user_id` filter) |

## Usage Examples

### CLI Query Examples

```bash
# Search for memory-related tools
npm run mcp:search memory

# Get details about a specific tool
npm run mcp:tool openmemory_query

# List all API endpoints
npm run mcp:apis
```

### MCP Integration Examples

**Claude Desktop:**

```json
{
  "mcpServers": {
    "openmemory": {
      "command": "node",
      "args": ["backend/dist/ai/mcp.js"]
    }
  }
}
```

**VS Code/Cursor:**

```json
{
  "name": "OpenMemory",
  "type": "mcp",
  "mcp": {
    "server": "backend/dist/ai/mcp.js",
    "tools": ["openmemory_query", "openmemory_store"]
  }
}
```

### REST API Examples

```bash
# Query memories
curl -X POST http://localhost:8080/memory/query \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning", "k": 5}'

# List agents
curl http://localhost:8080/api/agents

# Get proxy info
curl http://localhost:8080/api/proxy-info
```

## Files and Scripts

- **`.tmp/generate-mcp-report.js`** - Main report generator
- **`.tmp/query-mcp-tools.js`** - Interactive CLI query utility
- **`.tmp/mcp-tools-api-report.md`** - Generated Markdown report
- **`.tmp/mcp-tools-api-report.json`** - Generated JSON data

## Maintenance

The report generator automatically extracts tool and API information from:

- `backend/src/ai/mcp.ts` - Main MCP server implementation
- `backend/src/ai/mcp-proxy.ts` - Proxy MCP server implementation
- `backend/src/server/proxy.ts` - REST API endpoints
- Docker configuration and service definitions

To update the documentation after code changes:

```bash
npm run mcp:report
```

This ensures the documentation stays synchronized with the codebase.

---

_Generated by OpenMemory MCP Documentation System_
