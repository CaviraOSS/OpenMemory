# 🧠 OpenMemory Backend - Brain-Inspired Memory System
FROM node:20-alpine

WORKDIR /app

# Install dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies for slimmer runtime image
RUN npm prune --omit=dev

# Create data directory
RUN mkdir -p /data && chown -R node:node /data

# Switch to non-root user
USER node

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start server
CMD ["npm", "start"]
