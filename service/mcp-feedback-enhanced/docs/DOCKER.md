# Docker Deployment Guide for MCP Feedback Enhanced

This guide explains how to run the MCP Feedback Enhanced server in HTTP mode using Docker.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Docker Configuration](#docker-configuration)
- [Docker Compose](#docker-compose)
- [Environment Variables](#environment-variables)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

## Overview

The MCP Feedback Enhanced server can run in HTTP mode using two transport protocols:

1. **SSE (Server-Sent Events)**: Recommended for most use cases
2. **Streamable HTTP**: Alternative HTTP streaming protocol

When running in HTTP mode, the server provides:
- Web UI interface accessible via browser
- RESTful API endpoints
- WebSocket connections for real-time feedback
- Session management and persistence

**Note**: Desktop application mode is automatically disabled when using HTTP transport.

## Prerequisites

- Docker 20.10+ or Docker Desktop
- Docker Compose 2.0+ (optional, but recommended)
- 512MB RAM minimum, 1GB+ recommended
- Network access to port 8765 (default) or your chosen port
- Internet access to pull Python packages from PyPI

**Note**: If you're in an environment with SSL inspection or certificate issues (corporate proxies, some CI/CD systems), you may need to configure Docker to trust additional certificates or use the simpler `Dockerfile.simple` which installs from PyPI (requires the package to be published).

## Quick Start

### Using Docker CLI

1. **Build the Docker image:**
   ```bash
   docker build -t mcp-feedback-enhanced .
   ```

2. **Run the container with SSE transport:**
   ```bash
   docker run -d \
     --name mcp-feedback \
     -p 8765:8765 \
     -e MCP_TRANSPORT=sse \
     -e MCP_WEB_HOST=0.0.0.0 \
     -v ./sessions:/app/sessions \
     mcp-feedback-enhanced
   ```

3. **Access the Web UI:**
   Open your browser and navigate to: `http://localhost:8765`

### Using Docker Compose (Recommended)

1. **Start the service:**
   ```bash
   docker compose up -d
   ```

2. **View logs:**
   ```bash
   docker compose logs -f mcp-feedback-sse
   ```

3. **Stop the service:**
   ```bash
   docker compose down
   ```

## Docker Configuration

### Dockerfile

The provided `Dockerfile` uses a multi-stage build for optimal image size:

- **Build stage**: Compiles dependencies and creates a virtual environment
- **Runtime stage**: Contains only necessary runtime dependencies

Key features:
- Based on `python:3.12-slim` for minimal size
- Includes health check endpoint
- Optimized for HTTP transport modes
- Persistent session storage support

### Building from Source

```bash
# Clone the repository
git clone https://github.com/Minidoracat/mcp-feedback-enhanced.git
cd mcp-feedback-enhanced

# Build the image
docker build -t mcp-feedback-enhanced:latest .

# Or with custom build args
docker build \
  --build-arg PYTHON_VERSION=3.12 \
  -t mcp-feedback-enhanced:custom .
```

### Pre-built Images

Currently, you need to build the image from source. Pre-built images may be available in future releases.

## Docker Compose

The `docker-compose.yml` file includes three service configurations:

### 1. Default SSE Service (mcp-feedback-sse)

Runs with SSE transport on port 8765:

```bash
docker compose up -d
```

Access at: `http://localhost:8765`

### 2. Streamable HTTP Service (mcp-feedback-http)

Runs with streamable-http transport on port 8766:

```bash
docker compose --profile http up -d
```

Access at: `http://localhost:8766`

### 3. Debug Mode Service (mcp-feedback-debug)

Runs with debug logging enabled on port 8767:

```bash
docker compose --profile debug up -d
```

Access at: `http://localhost:8767`

## Environment Variables

Configure the MCP server using these environment variables:

| Variable | Default | Description | Required for HTTP |
|----------|---------|-------------|-------------------|
| `MCP_TRANSPORT` | `stdio` | Transport protocol: `sse` or `streamable-http` | ✅ Yes |
| `MCP_WEB_HOST` | `127.0.0.1` | Host to bind (use `0.0.0.0` for Docker) | ✅ Yes |
| `MCP_WEB_PORT` | `8765` | Port to listen on | ✅ Yes |
| `MCP_DESKTOP_MODE` | `false` | Desktop mode (auto-disabled for HTTP) | ⚠️ Must be false |
| `MCP_DEBUG` | `false` | Enable debug logging | ❌ Optional |
| `MCP_LANGUAGE` | auto | UI language: `en`, `zh-CN`, `zh-TW` | ❌ Optional |

### Example Environment Configuration

```bash
# SSE transport with English UI
MCP_TRANSPORT=sse
MCP_WEB_HOST=0.0.0.0
MCP_WEB_PORT=8765
MCP_DESKTOP_MODE=false
MCP_DEBUG=false
MCP_LANGUAGE=en
```

## Usage Examples

### Example 1: Basic SSE Server

Run a basic MCP server with SSE transport:

```bash
docker run -d \
  --name mcp-feedback \
  -p 8765:8765 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  mcp-feedback-enhanced
```

### Example 2: Streamable HTTP with Custom Port

Run with streamable-http on a custom port:

```bash
docker run -d \
  --name mcp-feedback-http \
  -p 9000:9000 \
  -e MCP_TRANSPORT=streamable-http \
  -e MCP_WEB_HOST=0.0.0.0 \
  -e MCP_WEB_PORT=9000 \
  mcp-feedback-enhanced
```

### Example 3: With Persistent Sessions

Mount a volume for session persistence:

```bash
docker run -d \
  --name mcp-feedback \
  -p 8765:8765 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  -v $(pwd)/sessions:/app/sessions \
  mcp-feedback-enhanced
```

### Example 4: Debug Mode

Enable debug logging:

```bash
docker run -d \
  --name mcp-feedback-debug \
  -p 8765:8765 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  -e MCP_DEBUG=true \
  mcp-feedback-enhanced
```

View logs:
```bash
docker logs -f mcp-feedback-debug
```

### Example 5: Behind a Reverse Proxy

Running behind nginx or traefik:

```bash
docker run -d \
  --name mcp-feedback \
  --network web \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  -e MCP_WEB_PORT=8765 \
  mcp-feedback-enhanced
```

**Nginx configuration example:**
```nginx
server {
    listen 80;
    server_name mcp.example.com;

    location / {
        proxy_pass http://mcp-feedback:8765;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Example 6: Multi-language Support

Run with specific language:

```bash
# English
docker run -d \
  --name mcp-feedback-en \
  -p 8765:8765 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  -e MCP_LANGUAGE=en \
  mcp-feedback-enhanced

# Simplified Chinese
docker run -d \
  --name mcp-feedback-cn \
  -p 8766:8765 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  -e MCP_LANGUAGE=zh-CN \
  mcp-feedback-enhanced

# Traditional Chinese
docker run -d \
  --name mcp-feedback-tw \
  -p 8767:8765 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  -e MCP_LANGUAGE=zh-TW \
  mcp-feedback-enhanced
```

## Container Management

### Viewing Logs

```bash
# View logs
docker logs mcp-feedback

# Follow logs in real-time
docker logs -f mcp-feedback

# View last 100 lines
docker logs --tail 100 mcp-feedback
```

### Checking Container Status

```bash
# Check if container is running
docker ps | grep mcp-feedback

# View container details
docker inspect mcp-feedback

# Check health status
docker inspect --format='{{.State.Health.Status}}' mcp-feedback
```

### Stopping and Removing

```bash
# Stop container
docker stop mcp-feedback

# Remove container
docker rm mcp-feedback

# Stop and remove in one command
docker rm -f mcp-feedback
```

### Restarting the Container

```bash
# Restart container
docker restart mcp-feedback

# Or with docker compose
docker compose restart
```

## Health Checks

The container includes a built-in health check that verifies the server is responding:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' mcp-feedback

# View health check logs
docker inspect --format='{{range .State.Health.Log}}{{.Output}}{{end}}' mcp-feedback
```

## Troubleshooting

### Build Issues

#### SSL Certificate Errors During Build

If you encounter SSL certificate verification errors during `docker build`:

```
SSL: CERTIFICATE_VERIFY_FAILED
```

**Solutions**:

1. **Use Dockerfile.simple** (if package is published to PyPI):
   ```bash
   docker build -f Dockerfile.simple -t mcp-feedback-enhanced .
   ```

2. **Configure Docker to trust certificates** (for corporate environments):
   ```bash
   # Add your corporate CA certificate to the build
   docker build --build-arg REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt -t mcp-feedback-enhanced .
   ```

3. **Use Docker BuildKit with cache from registry**:
   ```bash
   DOCKER_BUILDKIT=1 docker build -t mcp-feedback-enhanced .
   ```

4. **Build with no-cache** (sometimes helps with transient issues):
   ```bash
   docker build --no-cache -t mcp-feedback-enhanced .
   ```

### Container Won't Start

1. **Check logs:**
   ```bash
   docker logs mcp-feedback
   ```

2. **Verify port availability:**
   ```bash
   # On Linux/Mac
   netstat -tulpn | grep 8765
   
   # On Windows
   netstat -ano | findstr 8765
   ```

3. **Check environment variables:**
   ```bash
   docker inspect mcp-feedback | grep -A 10 Env
   ```

### Cannot Access Web UI

1. **Verify container is running:**
   ```bash
   docker ps | grep mcp-feedback
   ```

2. **Check if port is correctly mapped:**
   ```bash
   docker port mcp-feedback
   ```

3. **Test from within the container:**
   ```bash
   docker exec mcp-feedback curl -f http://localhost:8765/health
   ```

4. **Check firewall settings:**
   - Ensure Docker port is allowed through firewall
   - For cloud deployments, check security groups

### WebSocket Connection Issues

1. **Verify WebSocket upgrade headers:**
   - Ensure reverse proxy (if any) supports WebSocket
   - Check Connection: upgrade header is forwarded

2. **Check browser console for errors:**
   - Open browser developer tools (F12)
   - Look for WebSocket connection errors

### High Memory Usage

1. **Check session directory size:**
   ```bash
   docker exec mcp-feedback du -sh /app/sessions
   ```

2. **Clear old sessions:**
   ```bash
   docker exec mcp-feedback find /app/sessions -type f -mtime +7 -delete
   ```

3. **Set memory limits:**
   ```bash
   docker run -d \
     --name mcp-feedback \
     --memory=512m \
     --memory-swap=1g \
     -p 8765:8765 \
     -e MCP_TRANSPORT=sse \
     -e MCP_WEB_HOST=0.0.0.0 \
     mcp-feedback-enhanced
   ```

### Debug Mode Not Working

Ensure `MCP_DEBUG=true` is set and check logs:

```bash
docker run -d \
  --name mcp-feedback-debug \
  -p 8765:8765 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  -e MCP_DEBUG=true \
  mcp-feedback-enhanced

# View debug output
docker logs -f mcp-feedback-debug
```

## Security Considerations

### Production Deployment

1. **Use HTTPS with reverse proxy:**
   - Don't expose the container directly to the internet
   - Use nginx, traefik, or caddy with SSL/TLS

2. **Restrict network access:**
   ```bash
   docker run -d \
     --name mcp-feedback \
     -p 127.0.0.1:8765:8765 \
     -e MCP_TRANSPORT=sse \
     -e MCP_WEB_HOST=0.0.0.0 \
     mcp-feedback-enhanced
   ```

3. **Use read-only filesystem where possible:**
   ```bash
   docker run -d \
     --name mcp-feedback \
     --read-only \
     --tmpfs /tmp \
     -v ./sessions:/app/sessions \
     -p 8765:8765 \
     -e MCP_TRANSPORT=sse \
     -e MCP_WEB_HOST=0.0.0.0 \
     mcp-feedback-enhanced
   ```

4. **Run with limited capabilities:**
   ```bash
   docker run -d \
     --name mcp-feedback \
     --cap-drop ALL \
     --cap-add NET_BIND_SERVICE \
     -p 8765:8765 \
     -e MCP_TRANSPORT=sse \
     -e MCP_WEB_HOST=0.0.0.0 \
     mcp-feedback-enhanced
   ```

## Performance Tuning

### Resource Limits

Set CPU and memory limits:

```bash
docker run -d \
  --name mcp-feedback \
  --cpus=1 \
  --memory=512m \
  --memory-reservation=256m \
  -p 8765:8765 \
  -e MCP_TRANSPORT=sse \
  -e MCP_WEB_HOST=0.0.0.0 \
  mcp-feedback-enhanced
```

### Docker Compose with Resource Limits

```yaml
services:
  mcp-feedback:
    image: mcp-feedback-enhanced
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Maintenance

### Backup Session Data

```bash
# Create backup
docker run --rm \
  -v mcp-feedback-sessions:/source \
  -v $(pwd):/backup \
  alpine tar czf /backup/sessions-backup-$(date +%Y%m%d).tar.gz -C /source .
```

### Restore Session Data

```bash
# Restore from backup
docker run --rm \
  -v mcp-feedback-sessions:/target \
  -v $(pwd):/backup \
  alpine tar xzf /backup/sessions-backup-YYYYMMDD.tar.gz -C /target
```

### Update to Latest Version

```bash
# Pull latest code
git pull origin main

# Rebuild image
docker compose build

# Restart with new image
docker compose up -d
```

## Additional Resources

- [Main README](../README.md)
- [Architecture Documentation](../docs/architecture/README.md)
- [Deployment Guide](../docs/architecture/deployment-guide.md)
- [GitHub Repository](https://github.com/Minidoracat/mcp-feedback-enhanced)

## Support

For issues and questions:
- [GitHub Issues](https://github.com/Minidoracat/mcp-feedback-enhanced/issues)
- [Discord Community](https://discord.gg/Gur2V67)

---

**Version**: 2.6.0
**Last Updated**: 2024-11-13
**Docker Support**: Newly added for HTTP transport modes
