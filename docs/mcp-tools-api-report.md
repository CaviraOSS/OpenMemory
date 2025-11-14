# OpenMemory MCP Tools & API Report

Generated: 2025-11-13T01:55:00.000Z

## Overview

This report documents all Model Context Protocol (MCP) tools, resources, and REST API endpoints available in OpenMemory.

### Architecture Summary

- **Main MCP Server**: Core OpenMemory functionality via MCP protocol
- **Proxy MCP Server**: Multi-agent namespace management with isolation  
- **REST APIs**: Direct HTTP access to all functionality
- **Dashboard**: Web interface for memory visualization
- **Swagger Documentation**: Interactive API documentation at `/api-docs`

### 🆕 Recent Updates
- ✅ All proxy endpoints now included in Swagger UI documentation
- ✅ Agent registration, namespaces, and proxy endpoints fully documented
- ✅ Interactive API testing available via `/api-docs`
- ✅ **NEW**: `POST /api/agents` endpoint now fully implemented and functional
- ✅ **IDEMPOTENT**: Agent registration endpoint preserves API keys on updates
- ✅ Agent registration via REST API with validation and smart update behavior

---

## Main MCP Server - MCP Tools

| Tool Name | Description | Key Parameters | Returns | Related API |
| --- | --- | --- | --- | --- |
| `openmemory_query` | Run a semantic retrieval against OpenMemory | `query`, `k`, `sector`... | Memory search results with scores and content | `POST /memory/query` |
| `openmemory_store` | Persist new content into OpenMemory | `content`, `tags`, `metadata`... | Stored memory ID and sector assignments | `POST /memory/add` |
| `openmemory_reinforce` | Boost salience for an existing memory | `id`, `boost` | Confirmation of reinforcement | `POST /memory/reinforce` |
| `openmemory_list` | List recent memories for quick inspection | `limit`, `sector`, `user_id` | List of memory summaries with metadata | `GET /memory/all` |
| `openmemory_get` | Fetch a single memory by identifier | `id`, `include_vectors`, `user_id` | Complete memory data including content and metadata | `GET /memory/{id}` |

## Proxy MCP Server - MCP Tools

| Tool Name | Description | Key Parameters | Returns | Related API |
| --- | --- | --- | --- | --- |
| `get_registration_template` | Get a template for registering an agent with OpenMemory | `format` | Agent registration template in specified format | `GET /api/registration-template/{format}` |
| `get_proxy_info` | Get information about the proxy service capabilities and configuration |  | Proxy service information and capabilities | `GET /api/proxy-info` |
| `register_agent` | Register an agent for namespace access | `agent_id`, `namespace`, `permissions`... | Registration confirmation with API key | `POST /api/agents` |
| `list_agents` | List all registered agents and their namespaces | `show_api_keys`, `agent_id` | List of registered agents with their configurations | `GET /api/agents` |
| `get_agent` | Get detailed information about a specific agent | `agent_id`, `include_api_key`, `include_access_log` | Detailed agent information with optional access logs | `GET /api/agents/{id}` |
| `query_memory` | Query memories from agent's authorized namespaces | `agent_id`, `query`, `namespace`... | Namespace-scoped memory search results | `POST /memory/query` |
| `store_memory` | Store a memory in agent's namespace | `agent_id`, `content`, `namespace`... | Storage confirmation with memory ID | `POST /memory/add` |
| `reinforce_memory` | Reinforce the salience of a specific memory | `agent_id`, `memory_id`, `api_key` | Reinforcement confirmation | `POST /memory/reinforce` |

## MCP Resources

| Resource Name | URI | MIME Type | Description | Related API |
| --- | --- | --- | --- | --- |
| `openmemory-config` | `openmemory://config` | application/json | Runtime configuration snapshot for the OpenMemory MCP server | `GET /api/config` |

## REST API Endpoints

| Method | Endpoint | Service | Port(s) | Auth Required | Description |
| --- | --- | --- | --- | --- | --- |
| **GET** | `/health` | Main Backend | 8080 | ❌ | Health check endpoint |
| **GET** | `/api-docs` | Main Backend | 8080 | ❌ | Swagger API documentation |
| **GET** | `/openapi.json` | Main Backend | 8080 | ❌ | OpenAPI specification |
| **POST** | `/mcp` | Main Backend | 8080 | Optional (x-api-key header) | Main MCP protocol endpoint |
| **POST** | `/mcp-proxy` | Main Backend / Proxy | 8080 / 8081 | Agent API key required | MCP proxy protocol endpoint |
| **POST** | `/api/agents` | Proxy | 8080 / 8081 | ❌ | Register or update agent (idempotent) |
| **GET** | `/api/agents/{id}` | Proxy | 8080 / 8081 | ❌ | Get specific agent details |
| **GET** | `/api/namespaces` | Proxy | 8080 / 8081 | ❌ | List all namespaces |
| **GET** | `/api/proxy-info` | Proxy | 8080 / 8081 | ❌ | Service information and statistics |
| **GET** | `/api/registration-template/{format}` | Proxy | 8080 / 8081 | ❌ | Get registration templates |
| **GET** | `/api/proxy-health` | Proxy | 8080 / 8081 | ❌ | Proxy health check |
| **POST** | `/memory/add` | Main Backend | 8080 | Optional (x-api-key header) | Store new memory |
| **POST** | `/memory/query` | Main Backend | 8080 | Optional (x-api-key header) | Query memories |
| **GET** | `/memory/{id}` | Main Backend | 8080 | Optional (x-api-key header) | Get specific memory |
| **GET** | `/memory/all` | Main Backend | 8080 | Optional (x-api-key header) | List memories (supports optional `user_id` filter) |

## Detailed Tool Parameters

### Main MCP Server Tools

#### `openmemory_query`

Run a semantic retrieval against OpenMemory

**Endpoint**: `POST http://localhost:8080/mcp`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `query` | string | ✅ | - | Free-form search text |
| `k` | number | ❌ | `8` | Maximum results to return (1-32) |
| `sector` | enum (episodic|semantic|procedural|emotional|reflective) | ❌ | - | Restrict search to specific sector |
| `min_salience` | number | ❌ | - | Minimum salience threshold (0-1) |
| `user_id` | string | ❌ | - | Isolate results to specific user identifier |

#### `openmemory_store`

Persist new content into OpenMemory

**Endpoint**: `POST http://localhost:8080/mcp`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `content` | string | ✅ | - | Raw memory text to store |
| `tags` | array | ❌ | - | Optional tag list |
| `metadata` | object | ❌ | - | Arbitrary metadata blob |
| `user_id` | string | ❌ | - | Associate memory with specific user identifier |

#### `openmemory_reinforce`

Boost salience for an existing memory

**Endpoint**: `POST http://localhost:8080/mcp`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | string | ✅ | - | Memory identifier to reinforce |
| `boost` | number | ❌ | `0.1` | Salience boost amount (0.01-1) |

#### `openmemory_list`

List recent memories for quick inspection

**Endpoint**: `POST http://localhost:8080/mcp`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `limit` | number | ❌ | `10` | Number of memories to return (1-50) |
| `sector` | enum (episodic|semantic|procedural|emotional|reflective) | ❌ | - | Optionally limit to a sector |
| `user_id` | string | ❌ | - | Restrict results to specific user identifier |

#### `openmemory_get`

Fetch a single memory by identifier

**Endpoint**: `POST http://localhost:8080/mcp`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | string | ✅ | - | Memory identifier to load |
| `include_vectors` | boolean | ❌ | `false` | Include sector vector metadata |
| `user_id` | string | ❌ | - | Validate ownership against specific user identifier |

### Proxy MCP Server Tools

#### `get_registration_template`

Get a template for registering an agent with OpenMemory

**Endpoints**: 
- `POST http://localhost:8080/mcp-proxy`
- `POST http://localhost:8081/mcp-proxy`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `format` | enum (json|curl|prompt|example) | ❌ | `json` | Format for the registration template |

#### `get_proxy_info`

Get information about the proxy service capabilities and configuration

**Endpoints**: 
- `POST http://localhost:8080/mcp-proxy`
- `POST http://localhost:8081/mcp-proxy`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |

#### `register_agent`

Register an agent for namespace access

**Endpoints**: 
- `POST http://localhost:8080/mcp-proxy`
- `POST http://localhost:8081/mcp-proxy`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `agent_id` | string | ✅ | - | Unique identifier for the agent |
| `namespace` | string | ✅ | - | Primary namespace for agent memories |
| `permissions` | array (read|write|admin) | ❌ | `read,write` | Permissions for the primary namespace |
| `shared_namespaces` | array | ❌ | - | Additional namespaces this agent can access |
| `description` | string | ❌ | - | Agent description for documentation |

#### `list_agents`

List all registered agents and their namespaces

**Endpoints**: 
- `POST http://localhost:8080/mcp-proxy`
- `POST http://localhost:8081/mcp-proxy`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `show_api_keys` | boolean | ❌ | `false` | Whether to include API keys in output |
| `agent_id` | string | ❌ | - | Filter to specific agent |

#### `get_agent`

Get detailed information about a specific agent

**Endpoints**: 
- `POST http://localhost:8080/mcp-proxy`
- `POST http://localhost:8081/mcp-proxy`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `agent_id` | string | ✅ | - | Agent ID to retrieve |
| `include_api_key` | boolean | ❌ | `false` | Whether to include the API key in response |
| `include_access_log` | boolean | ❌ | `false` | Whether to include recent access log entries |

#### `query_memory`

Query memories from agent's authorized namespaces

**Endpoints**: 
- `POST http://localhost:8080/mcp-proxy`
- `POST http://localhost:8081/mcp-proxy`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `agent_id` | string | ✅ | - | Requesting agent ID |
| `query` | string | ✅ | - | Search query |
| `namespace` | string | ❌ | - | Target namespace (defaults to agent's primary) |
| `k` | number | ❌ | `8` | Number of results to return |
| `sector` | enum (episodic|semantic|procedural|emotional|reflective) | ❌ | - | Restrict search to specific sector |
| `min_salience` | number | ❌ | - | Minimum salience threshold |
| `api_key` | string | ❌ | - | Agent's API key for authentication |

#### `store_memory`

Store a memory in agent's namespace

**Endpoints**: 
- `POST http://localhost:8080/mcp-proxy`
- `POST http://localhost:8081/mcp-proxy`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `agent_id` | string | ✅ | - | Agent ID |
| `content` | string | ✅ | - | Memory content to store |
| `namespace` | string | ❌ | - | Target namespace (defaults to agent's primary) |
| `sector` | enum (episodic|semantic|procedural|emotional|reflective) | ❌ | - | Memory sector classification |
| `salience` | number | ❌ | - | Memory importance (0-1) |
| `metadata` | object | ❌ | - | Additional metadata |
| `api_key` | string | ❌ | - | Agent's API key |

#### `reinforce_memory`

Reinforce the salience of a specific memory

**Endpoints**: 
- `POST http://localhost:8080/mcp-proxy`
- `POST http://localhost:8081/mcp-proxy`

| Parameter | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `agent_id` | string | ✅ | - | Agent ID |
| `memory_id` | string | ✅ | - | ID of memory to reinforce |
| `api_key` | string | ❌ | - | Agent's API key |

## Usage Examples

### Main MCP Server (Direct Memory Operations)

```bash
# Query memories
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
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
```

### Proxy MCP Server (Agent Management)

```bash
# Register a new agent (idempotent)
curl -X POST http://localhost:8080/mcp-proxy \
  -H "Content-Type: application/json" \
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
```

### REST API Examples

```bash
# Register or update an agent (idempotent)
curl -X POST http://localhost:8080/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-agent",
    "namespace": "production",
    "permissions": ["read", "write"],
    "description": "Production agent"
  }'

# List all agents
curl http://localhost:8080/api/agents

# Get specific agent
curl http://localhost:8080/api/agents/my-agent

# Get proxy service info
curl http://localhost:8080/api/proxy-info

# Health check
curl http://localhost:8080/health
```

### IDE Integration

**Claude Desktop Integration:**
```json
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
```

**VS Code/Cursor Integration:**
```json
{
  "name": "OpenMemory",
  "type": "mcp",
  "mcp": {
    "server": "backend/dist/ai/mcp.js",
    "tools": ["openmemory_query", "openmemory_store", "openmemory_list"]
  }
}
```

---

*Report generated by OpenMemory MCP Tools & API Report Generator*
