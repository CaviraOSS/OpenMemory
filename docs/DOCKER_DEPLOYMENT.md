# OpenMemory Docker Deployment Guide

This guide explains how to deploy OpenMemory with all services using Docker Compose.

## 🏗️ Service Architecture

The Docker Compose setup provides three main services:

### 1. **Backend Service** (`openmemory`)
- Core OpenMemory API with integrated MCP proxy
- Runs on port **8080**
- MCP proxy endpoints available at same port
- Shared database and configuration

### 2. **Dashboard Service** (`openmemory-dashboard`)
- Web interface for memory visualization and management
- Runs on port **3000**
- Built with Next.js
- Connects to backend service

### 3. **Standalone Proxy Service** (`openmemory-mcp-proxy`)
- Dedicated MCP proxy service
- Runs on port **8081** 
- Independent proxy service
- Useful for specialized proxy deployments

## 🚀 Quick Start

### Full Stack Deployment (Recommended)
```bash
# Start all services
docker-compose up

# Access services:
# - Backend API: http://localhost:8080
# - Dashboard: http://localhost:3000
# - Integrated MCP Proxy: http://localhost:8080/mcp-proxy
# - Standalone MCP Proxy: http://localhost:8081/mcp-proxy
```

### Backend + Dashboard Only
```bash
# Start backend and dashboard
docker-compose up openmemory openmemory-dashboard

# Access services:
# - Backend API: http://localhost:8080
# - Dashboard: http://localhost:3000
# - MCP Proxy: http://localhost:8080/mcp-proxy
```

### Backend Only (Minimal)
```bash
# Start with integrated MCP proxy only
docker-compose up openmemory

# Access services:
# - Main API: http://localhost:8080
# - MCP Proxy: http://localhost:8080/mcp-proxy  
# - Proxy API: http://localhost:8080/api/proxy-info
```

### Standalone Proxy Only
```bash
# Start only the standalone proxy service
docker-compose up openmemory-mcp-proxy

# Access service:
# - MCP Proxy: http://localhost:8081/mcp-proxy
# - Proxy API: http://localhost:8081/api/proxy-info
```

## 🔧 Configuration

### Environment Variables

All standard OpenMemory environment variables are supported. Key proxy-specific settings:

```bash
# Enable/disable integrated proxy in main service
OM_MCP_PROXY_ENABLED=true  # Default: true

# Proxy-specific settings (for standalone service)
OM_MCP_PROXY_STANDALONE=true
OM_MCP_PROXY_PORT=8081
```

### Custom Configuration

Create a `.env` file to override defaults:

```bash
# .env file example
OM_API_KEY=your_secure_api_key
OM_EMBEDDINGS=ollama
OLLAMA_URL=http://your-ollama-server:11434
OM_TIER=hybrid
OM_RATE_LIMIT_ENABLED=true
OM_MCP_PROXY_ENABLED=true
```

## 📊 Service Details

### Main OpenMemory Service (`openmemory`)

**Port:** 8080  
**Health Check:** `http://localhost:8080/health`  
**MCP Endpoint:** `http://localhost:8080/mcp-proxy` (when proxy enabled)

**Key Features:**
- Full OpenMemory functionality
- Integrated MCP proxy (when enabled)
- Memory storage and retrieval
- Vector search and embeddings
- Decay and reflection processes

### Standalone MCP Proxy (`openmemory-mcp-proxy`)

**Port:** 8081  
**Health Check:** `http://localhost:8081/api/proxy-health`  
**MCP Endpoint:** `http://localhost:8081/mcp-proxy`

**Key Features:**
- Agent registration and management
- Namespace isolation
- Registration templates
- REST API for management
- Access logging and audit trails

## 🔗 API Endpoints

### Integrated Service (port 8080)
```
GET  /                          - Service information
POST /memory/store              - Store memories
POST /memory/query              - Query memories  
POST /mcp                       - MCP protocol (when enabled)
POST /mcp-proxy                 - MCP proxy protocol (when enabled)
GET  /api/agents                - List agents (when proxy enabled)
GET  /api/proxy-health          - Proxy health (when proxy enabled)
```

### Standalone Proxy (port 8081)
```
GET  /                          - Proxy service information
POST /mcp-proxy                 - MCP proxy protocol
GET  /api/agents                - List registered agents
GET  /api/agents/:id            - Get specific agent
GET  /api/namespaces            - List namespaces  
GET  /api/proxy-info            - Service capabilities
GET  /api/registration-template - Get registration templates
GET  /api/proxy-health          - Health check
```

## 🗄️ Data Persistence

Both services use a shared Docker volume for data persistence:

```yaml
volumes:
  openmemory_data:
    driver: local
```

**Data Location:** `/data/openmemory.sqlite` (inside containers)  
**Shared Data:** Both services access the same database for consistency

## 🔍 Health Checks

### Main Service
```bash
curl http://localhost:8080/health
```

### Proxy Service  
```bash
curl http://localhost:8081/api/proxy-health
```

### Docker Health Status
```bash
docker-compose ps
```

## 🛠️ Development & Debugging

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f openmemory
docker-compose logs -f openmemory-mcp-proxy
```

### Access Container Shell
```bash
# Main service
docker-compose exec openmemory sh

# Proxy service
docker-compose exec openmemory-mcp-proxy sh
```

### Rebuild Services
```bash
# Rebuild all
docker-compose build

# Rebuild specific service
docker-compose build openmemory-mcp-proxy
```

## 📈 Scaling & Production

### Resource Allocation
```yaml
# Add to service definitions for production
deploy:
  resources:
    limits:
      memory: 2G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

### Production Environment Variables
```bash
# Performance tuning
OM_DECAY_INTERVAL_MINUTES=720  # 12 hours
OM_RATE_LIMIT_ENABLED=true
OM_RATE_LIMIT_MAX_REQUESTS=10000

# Database optimization (for PostgreSQL)
OM_METADATA_BACKEND=postgres
OM_PG_HOST=postgres-server
OM_PG_DB=openmemory_prod
OM_PG_USER=openmemory
OM_PG_PASSWORD=secure_password
```

## 🔐 Security Considerations

1. **API Keys:** Set secure `OM_API_KEY` values
2. **Rate Limiting:** Enable in production (`OM_RATE_LIMIT_ENABLED=true`)
3. **Network:** Use Docker networks for service isolation
4. **Secrets:** Use Docker secrets for sensitive configuration
5. **Database:** Consider external PostgreSQL for production

## 📚 Usage Examples

### Register an Agent (Standalone Proxy)
```bash
curl -X POST http://localhost:8081/mcp-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "register_agent",
      "arguments": {
        "agent_id": "my-ai-agent",
        "namespace": "my-workspace", 
        "permissions": ["read", "write"],
        "description": "My AI assistant"
      }
    }
  }'
```

### Get Registration Template
```bash
curl http://localhost:8081/api/registration-template/json
```

### List Registered Agents
```bash
curl http://localhost:8081/api/agents
```

## 🎯 Deployment Strategies

### Development
```bash
docker-compose up openmemory
# Single service with integrated proxy
```

### Testing/Staging  
```bash
docker-compose up
# Both services for complete testing
```

### Production
```bash
# Use external database and dedicated proxy
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

This Docker setup provides flexible deployment options for OpenMemory with integrated MCP proxy capabilities, suitable for development, testing, and production environments.