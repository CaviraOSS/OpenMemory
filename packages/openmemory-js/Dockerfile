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
RUN bun install --frozen-lockfile

# Copy source code and build the application
COPY src/ ./src/
COPY tsconfig.json ./
RUN bun run build

# Remove devDependencies to reduce image size 
# (Removing all the devDependencies that we dont need in the final build)
RUN npm prune --omit=dev


# ===== PRODUCTION STAGE =====
FROM node:20-alpine AS production

WORKDIR /app

# Install timezone data for proper TZ support
RUN apk add --no-cache tzdata

# Create a dedicated non-root user for security
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

# Expose the default application port (override with OM_PORT)
EXPOSE 18080

# Define a lightweight health check that verifies the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const port=process.env.OM_PORT||18080;require('http').get(`http://localhost:${port}/health`,(res)=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Start the application using npm
ENTRYPOINT ["npm", "start"]
