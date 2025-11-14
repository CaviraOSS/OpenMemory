# Multi-stage Dockerfile for MCP Feedback Enhanced
# Optimized for running the MCP server in HTTP mode (SSE or streamable-http)

# Build stage
FROM python:3.12-slim AS builder

# Set working directory
WORKDIR /build

# Install system dependencies required for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy only the files needed for installation
COPY pyproject.toml README.md LICENSE ./
COPY src/ ./src/

# Create virtual environment and install dependencies
# First install the dependencies, then install the package
RUN python -m venv /opt/venv && \
    . /opt/venv/bin/activate && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        fastmcp>=2.0.0 \
        psutil>=7.0.0 \
        fastapi>=0.115.0 \
        uvicorn>=0.30.0 \
        jinja2>=3.1.0 \
        websockets>=13.0.0 \
        aiohttp>=3.8.0 \
        mcp>=1.9.3 && \
    pip install --no-cache-dir --no-deps .

# Runtime stage
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Required for WebSocket support
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application source
COPY --from=builder /build/src /app/src

# Set up Python path
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Default environment variables for HTTP mode
ENV MCP_TRANSPORT=sse \
    MCP_WEB_HOST=0.0.0.0 \
    MCP_WEB_PORT=8765 \
    MCP_DESKTOP_MODE=false \
    MCP_DEBUG=false \
    MCP_BIND_HOST=0.0.0.0 \
    MCP_BIND_PORT=9000

# Expose the default web UI port
EXPOSE 8765

# Health check endpoint (FastMCP provides health checks)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${MCP_WEB_PORT:-8765}/health || exit 1

# Create directory for session storage
RUN mkdir -p /app/sessions

# Run the MCP server with explicit server command
# Use exec form with shell to properly expand environment variables
CMD ["/bin/sh", "-c", "python -m mcp_feedback_enhanced server --transport ${MCP_TRANSPORT}"]
