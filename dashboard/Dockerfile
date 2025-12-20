# ===== BUILD STAGE =====
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# ===== PRODUCTION STAGE =====
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built assets from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Create a dedicated non-root user for security
RUN addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs \
 && chown -R nextjs:nodejs /app

USER nextjs

# Expose the application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the Next.js application
CMD ["npm", "start"]
