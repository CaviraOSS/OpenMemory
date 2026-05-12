# ===== BUILD STAGE =====
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package manifests to install dependencies
COPY package*.json ./

# Install all dependencies (including devDependencies) for build
RUN npm ci

# Copy source code and build the application
COPY src/ ./src/
COPY tsconfig.json ./
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
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application using npm
ENTRYPOINT ["npm", "start"]
