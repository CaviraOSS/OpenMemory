# OpenMemory MCP Proxy Service

This document outlines the implementation of an enhanced MCP proxy service for OpenMemory that provides additional features including:

- agent registration
- namespace management
- prompt templates

## 🚀 Features Implemented

### 1. Agent Registration System
- **Unique Agent IDs**: Each agent gets a unique identifier
- **Namespace Isolation**: Private namespaces for each agent 
- **Permission Management**: Read/write/admin access control
- **API Key Authentication**: Secure agent identification
- **Database Persistence**: All registrations stored in SQLite/PostgreSQL

### 2. Namespace Management
- **Private Namespaces**: Agent-specific memory spaces
- **Shared Namespaces**: Cross-agent collaboration spaces
- **Public Namespaces**: Globally accessible memory spaces
- **Access Control**: Permission-based namespace access

### 3. MCP Tools Available

#### Registration & Management
- `get_registration_template` - Get registration examples in multiple formats
- `get_proxy_info` - Service capabilities and configuration info  
- `register_agent` - Register new agents with namespace access
- `list_agents` - View all registered agents

#### Memory Operations
- `query_memory` - Search memories in authorized namespaces
- `store_memory` - Store new memories in agent namespace
- `reinforce_memory` - Boost salience of specific memories

### 4. REST API Endpoints

```
POST /mcp-proxy                           - MCP protocol endpoint
GET  /api/agents                          - List all registered agents  
GET  /api/agents/:id                      - Get specific agent details
GET  /api/namespaces                      - List all namespaces
GET  /api/proxy-info                      - Service information
GET  /api/registration-template/:format   - Get registration templates
GET  /api/proxy-health                    - Health check endpoint
```

### 5. Database Schema
- `agent_registrations` - Agent details and permissions
- `namespace_groups` - Namespace configurations  
- `agent_access_log` - Audit trail for all operations

## 🔧 Files Created/Modified

### Core Implementation
- `backend/src/ai/mcp-proxy.ts` - Main proxy service implementation
- `backend/src/server/proxy.ts` - Server integration and REST endpoints
- `backend/migrations/002_agent_registrations.sql` - Database schema
- `backend/src/scripts/migrate-agent-tables.ts` - Migration script

### Database Integration
- Extended `backend/src/core/db.ts` with agent-specific queries
- Added type definitions for agent operations

### Server Integration  
- Modified `backend/src/server/index.ts` to include proxy routes

## 📋 Usage Examples

### 1. Agent Registration

```json
{
  "agent_id": "research-assistant-v2", 
  "namespace": "research-data",
  "permissions": ["read", "write"],
  "shared_namespaces": ["public-papers", "team-research"],
  "description": "AI assistant for academic research and paper analysis"
}
```

### 2. Query Memories (with API key)

```json
{
  "agent_id": "research-assistant-v2",
  "query": "recent AI research papers",
  "namespace": "research-data", 
  "k": 10,
  "api_key": "omp_abc123def456"
}
```

### 3. Store Memory

```json
{
  "agent_id": "research-assistant-v2", 
  "content": "New breakthrough in transformer architecture...",
  "sector": "semantic",
  "api_key": "omp_abc123def456"
}
```

## 🎯 Key Benefits

1. **Multi-Agent Support**: Multiple AI agents can use OpenMemory simultaneously
2. **Namespace Isolation**: Prevents memory contamination between agents
3. **Collaboration**: Shared namespaces enable team collaboration
4. **Security**: API key authentication and permission-based access
5. **Templates**: Built-in registration guidance and examples
6. **Audit Trail**: Complete logging of all agent operations

## 🔄 Registration Workflow

1. **Get Template**: Use `get_registration_template` for guidance
2. **Register Agent**: Call `register_agent` with required parameters  
3. **Save API Key**: Store the returned API key securely
4. **Start Operations**: Use authenticated tools for memory operations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agent 1       │    │   Agent 2       │    │   Agent N       │
│   (Namespace A) │    │   (Namespace B) │    │   (Namespace N) │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    MCP Proxy Service      │
                    │  - Agent Registration     │
                    │  - Namespace Management   │
                    │  - Access Control         │
                    │  - Template Generation    │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   OpenMemory Backend      │
                    │  - Memory Storage         │
                    │  - Vector Search          │
                    │  - Embeddings             │
                    │  - Decay Process          │
                    └───────────────────────────┘
```

## 🚀 Next Steps

The proxy service is now ready for use! You can:

1. **Start the server**: `npm start` (after resolving port conflicts)
2. **Register agents**: Use the MCP tools or REST API
3. **Test operations**: Query and store memories with namespace isolation  
4. **Monitor usage**: Check the access logs and agent statistics

This implementation provides a complete solution for multi-agent OpenMemory deployments with proper isolation, collaboration features, and comprehensive templates for easy agent onboarding.