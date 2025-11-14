# MCP Feedback Enhanced - Examples

This directory contains example configurations and scripts for running MCP Feedback Enhanced.

## 📁 Files

### MCP Configuration Examples

- **`mcp-config-web.json`** - Configuration for Web UI mode
- **`mcp-config-desktop.json`** - Configuration for Desktop Application mode

### Docker Quick Start Scripts

- **`docker-quickstart.sh`** - Bash script for Linux/macOS to quickly start Docker container
- **`docker-quickstart.ps1`** - PowerShell script for Windows to quickly start Docker container

## 🚀 Usage

### MCP Configuration

Copy the appropriate configuration to your MCP client's config file:

**Cursor/Cline/Windsurf**: Add to `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Example**:
```json
{
  "mcpServers": {
    "mcp-feedback-enhanced": {
      "command": "uvx",
      "args": ["mcp-feedback-enhanced@latest"],
      "timeout": 600,
      "env": {
        "MCP_WEB_HOST": "127.0.0.1",
        "MCP_WEB_PORT": "8765"
      },
      "autoApprove": ["interactive_feedback"]
    }
  }
}
```

### Docker Quick Start

#### Linux/macOS

```bash
cd /path/to/mcp-feedback-enhanced
./examples/docker-quickstart.sh
```

#### Windows

```powershell
cd C:\path\to\mcp-feedback-enhanced
.\examples\docker-quickstart.ps1
```

### What the Scripts Do

1. **Check Docker installation** - Verifies Docker is available
2. **Build the image** - Creates the `mcp-feedback-enhanced` Docker image
3. **Remove old container** - Cleans up any existing container with the same name
4. **Start the container** - Runs the server with SSE transport on port 8765
5. **Verify startup** - Checks if the container started successfully
6. **Display info** - Shows useful commands and the Web UI URL

### Customizing the Scripts

You can modify the scripts to change:

- **Port**: Change `-p 8765:8765` to use a different port
- **Transport**: Change `MCP_TRANSPORT=sse` to `streamable-http`
- **Debug mode**: Change `MCP_DEBUG=false` to `true` for verbose logging
- **Language**: Add `-e MCP_LANGUAGE=en` to force a specific language
- **Session storage**: The `-v` flag mounts `./sessions` for persistent storage

## 🐳 Docker Examples

### Using Docker Compose

The easiest way to run with Docker:

```bash
# Start the default SSE service
docker compose up -d

# View logs
docker compose logs -f mcp-feedback-sse

# Stop the service
docker compose down
```

### Using Streamable HTTP Transport

```bash
# Start the HTTP service (on port 8766)
docker compose --profile http up -d

# Access at http://localhost:8766
```

### Using Debug Mode

```bash
# Start with debug logging
docker compose --profile debug up -d

# View debug logs
docker compose logs -f mcp-feedback-debug
```

## 📖 More Information

- **Full Docker Documentation**: [../docs/DOCKER.md](../docs/DOCKER.md)
- **Main README**: [../README.md](../README.md)
- **Architecture Documentation**: [../docs/architecture/README.md](../docs/architecture/README.md)

## 🆘 Troubleshooting

### Script Fails with "Docker not found"

Install Docker:
- **Linux**: Follow [Docker Engine installation](https://docs.docker.com/engine/install/)
- **macOS**: Install [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)
- **Windows**: Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)

### Build Fails with SSL Errors

If you encounter SSL certificate errors during build:

```bash
# Try the simple Dockerfile
docker build -f Dockerfile.simple -t mcp-feedback-enhanced .
```

See [Docker documentation](../docs/DOCKER.md#build-issues) for more solutions.

### Container Won't Start

Check the logs:
```bash
docker logs mcp-feedback
```

Common issues:
- Port 8765 already in use - change the port in the script
- Insufficient memory - Docker needs at least 512MB RAM
- Firewall blocking - ensure Docker can bind to the port

### Cannot Access Web UI

1. Verify container is running: `docker ps | grep mcp-feedback`
2. Check port mapping: `docker port mcp-feedback`
3. Try accessing: `http://localhost:8765`
4. Check logs: `docker logs mcp-feedback`

## 💡 Tips

- Use `docker compose` for easier management
- Mount a volume for persistent session storage
- Use environment variables to customize behavior
- Check health status with: `docker inspect --format='{{.State.Health.Status}}' mcp-feedback`
- View real-time logs with: `docker logs -f mcp-feedback`

---

For more examples and detailed usage, see the [Docker documentation](../docs/DOCKER.md).
