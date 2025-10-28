# ===== BUILD STAGE =====
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies required for native module compilation,
# plus curl and bash (needed to run the Bun installation script)
RUN apk add --no-cache python3 make g++ curl bash

# Install Bun globally and relocate it to a shared, persistent location
RUN curl -fsSL https://bun.sh/install | bash \
 && mv /root/.bun /opt/bun \
 && ln -s /opt/bun/bin/bun /usr/local/bin/bun

# Ensure Bun is available in PATH for subsequent commands
ENV PATH="/opt/bun/bin:${PATH}"

# Copy package manifests to install dependencies
COPY package*.json ./

# Install all dependencies (including devDependencies) using Bun
# --frozen-lockfile ensures reproducible builds
# --concurrent-scripts and --network-concurrency optimize install speed
RUN bun install --frozen-lockfile --concurrent-scripts=10 --network-concurrency=96

# Copy source code and build the application
COPY src/ ./src/
COPY tsconfig.json ./
RUN bun run build

# Remove devDependencies to reduce image size (optional, since we'll use a fresh stage next)
RUN npm prune --omit=dev


# ===== PRODUCTION STAGE =====
FROM node:20-alpine AS production

WORKDIR /app

# Create a dedicated non-root user for security
# (Alpine's node image does not include a generic 'node' user by default)
RUN addgroup -g 1001 -S appgroup \
 && adduser -u 1001 -S appuser -G appgroup

# Copy only production artifacts from the builder stage
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/dist ./dist/
COPY package.json ./

# Create a directory for persistent data and secure file permissions
RUN mkdir -p /data \
 && chown -R appuser:appgroup /data /app \
 && chmod -R go-w /app

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 8080

# Define a lightweight health check that verifies the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD bun -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application using npm (assumes "start" script uses Bun or is compatible)
ENTRYPOINT ["npm", "start"]