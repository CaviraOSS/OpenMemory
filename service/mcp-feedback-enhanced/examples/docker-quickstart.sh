#!/bin/bash
# Example script to run MCP Feedback Enhanced in Docker with SSE transport

set -e

echo "🐳 MCP Feedback Enhanced - Docker Quick Start"
echo "=============================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker is installed"
echo ""

# Build the image
echo "📦 Building Docker image..."
if docker build -t mcp-feedback-enhanced .; then
    echo "✅ Image built successfully"
else
    echo "❌ Failed to build image"
    echo ""
    echo "💡 If you encountered SSL certificate errors, try:"
    echo "   docker build -f Dockerfile.simple -t mcp-feedback-enhanced ."
    exit 1
fi

echo ""

# Stop and remove existing container if it exists
if docker ps -a | grep -q mcp-feedback; then
    echo "🧹 Removing existing container..."
    docker rm -f mcp-feedback
fi

# Run the container
echo "🚀 Starting container..."
docker run -d \
    --name mcp-feedback \
    -p 8765:8765 \
    -e MCP_TRANSPORT=sse \
    -e MCP_WEB_HOST=0.0.0.0 \
    -e MCP_WEB_PORT=8765 \
    -e MCP_DEBUG=false \
    -v "$(pwd)/sessions:/app/sessions" \
    mcp-feedback-enhanced

echo ""

# Wait for container to be ready
echo "⏳ Waiting for server to start..."
sleep 3

# Check if container is running
if docker ps | grep -q mcp-feedback; then
    echo "✅ Container is running"
    echo ""
    echo "📊 Container Status:"
    docker ps | grep mcp-feedback | awk '{print "   ID: " $1}'
    echo ""
    echo "🌐 Web UI: http://localhost:8765"
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs:    docker logs -f mcp-feedback"
    echo "   Stop server:  docker stop mcp-feedback"
    echo "   Start server: docker start mcp-feedback"
    echo "   Remove:       docker rm -f mcp-feedback"
    echo ""
    echo "💡 Check health: docker inspect --format='{{.State.Health.Status}}' mcp-feedback"
else
    echo "❌ Container failed to start"
    echo ""
    echo "📋 Checking logs:"
    docker logs mcp-feedback
    exit 1
fi
