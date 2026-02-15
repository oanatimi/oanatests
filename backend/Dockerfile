# Backend Dockerfile for Railway deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy database migration script
COPY --from=builder /app/db ./db

# Note: Railway assigns PORT dynamically at runtime
# EXPOSE is not needed for Railway deployment

# Health check using Node.js (wget not available in Alpine by default)
# Uses PORT environment variable (Railway assigns dynamic port)
# Increased start-period to 60s to allow time for migrations and server initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "const port = process.env.PORT || 3001; require('http').get('http://localhost:' + port + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start command - run migrations first, then start the server
# Migrations are idempotent (uses IF NOT EXISTS) so safe to run every time
CMD ["sh", "-c", "npm run db:migrate && npm start"]
