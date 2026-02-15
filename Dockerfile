# Backend Dockerfile for Railway deployment from monorepo root
FROM node:20-alpine AS builder

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy backend source code (includes db directory for migrations)
COPY backend/ .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy database migration files
COPY --from=builder /app/db ./db

# Expose port
EXPOSE 3001

# Health check using Node.js (wget not available in Alpine by default)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start command - run migrations first, then start the server
# Migrations are idempotent (uses IF NOT EXISTS) so safe to run every time
CMD ["sh", "-c", "npm run db:migrate && npm start"]
