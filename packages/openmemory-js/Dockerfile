# ===== BUILD STAGE =====
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package manifests to install dependencies
COPY package*.json ./

# sqlite3 native binaries from npm can target a newer glibc than this base
# image. Build it inside the container to match the runtime ABI.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Install all dependencies (including devDependencies) for build
RUN npm_config_build_from_source=sqlite3 npm ci

# Copy source code and build the application
COPY src/ ./src/
COPY tsconfig.json ./
COPY models.yml ./
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Remove devDependencies to reduce image size for the runtime image
RUN npm prune --omit=dev


# ===== PRODUCTION STAGE =====
FROM node:20-bookworm-slim AS production

WORKDIR /app

# Create a dedicated non-root user for security
RUN groupadd --gid 1001 appgroup \
 && useradd --uid 1001 --gid appgroup --system --no-create-home appuser

# Copy only production artifacts from the builder stage
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/models.yml ./models.yml
COPY package.json ./

# Create a directory for persistent data and secure file permissions
RUN mkdir -p /data \
 && chown -R appuser:appgroup /data /app \
 && chmod -R go-w /app

# Switch to non-root user
USER appuser

# Match the local compose default port.
ENV OM_PORT=8180

# Expose the application port
EXPOSE 8180

# Define a lightweight health check that verifies the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port = process.env.OM_PORT || 8180; require('http').get('http://localhost:' + port + '/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application using npm
ENTRYPOINT ["npm", "start"]
