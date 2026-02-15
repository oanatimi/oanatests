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

# Copy startup script
COPY --from=builder /app/scripts ./scripts
RUN chmod +x ./scripts/start.sh

# Note: Railway assigns PORT dynamically at runtime
# EXPOSE is not needed for Railway deployment

# Start command using startup script (similar to frontend approach)
CMD ["./scripts/start.sh"]
