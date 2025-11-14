# Example PowerShell script to run MCP Feedback Enhanced in Docker with SSE transport

$ErrorActionPreference = "Stop"

Write-Host "🐳 MCP Feedback Enhanced - Docker Quick Start" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker first." -ForegroundColor Red
    Write-Host "   Visit: https://docs.docker.com/get-docker/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Build the image
Write-Host "📦 Building Docker image..." -ForegroundColor Cyan
try {
    docker build -t mcp-feedback-enhanced .
    Write-Host "✅ Image built successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to build image" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 If you encountered SSL certificate errors, try:" -ForegroundColor Yellow
    Write-Host "   docker build -f Dockerfile.simple -t mcp-feedback-enhanced ." -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Stop and remove existing container if it exists
$existingContainer = docker ps -a --filter "name=mcp-feedback" --format "{{.Names}}"
if ($existingContainer -eq "mcp-feedback") {
    Write-Host "🧹 Removing existing container..." -ForegroundColor Cyan
    docker rm -f mcp-feedback | Out-Null
}

# Run the container
Write-Host "🚀 Starting container..." -ForegroundColor Cyan
docker run -d `
    --name mcp-feedback `
    -p 8765:8765 `
    -e MCP_TRANSPORT=sse `
    -e MCP_WEB_HOST=0.0.0.0 `
    -e MCP_WEB_PORT=8765 `
    -e MCP_DEBUG=false `
    -v "${PWD}/sessions:/app/sessions" `
    mcp-feedback-enhanced

Write-Host ""

# Wait for container to be ready
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

# Check if container is running
$runningContainer = docker ps --filter "name=mcp-feedback" --format "{{.Names}}"
if ($runningContainer -eq "mcp-feedback") {
    Write-Host "✅ Container is running" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Container Status:" -ForegroundColor Cyan
    $containerId = docker ps --filter "name=mcp-feedback" --format "{{.ID}}"
    Write-Host "   ID: $containerId" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 Web UI: http://localhost:8765" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Useful commands:" -ForegroundColor Cyan
    Write-Host "   View logs:    docker logs -f mcp-feedback" -ForegroundColor White
    Write-Host "   Stop server:  docker stop mcp-feedback" -ForegroundColor White
    Write-Host "   Start server: docker start mcp-feedback" -ForegroundColor White
    Write-Host "   Remove:       docker rm -f mcp-feedback" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Check health: docker inspect --format='{{.State.Health.Status}}' mcp-feedback" -ForegroundColor Yellow
} else {
    Write-Host "❌ Container failed to start" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 Checking logs:" -ForegroundColor Cyan
    docker logs mcp-feedback
    exit 1
}
