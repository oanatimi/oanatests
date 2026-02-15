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

# Start command - run migrations first, then start the server
# Migrations are idempotent (uses IF NOT EXISTS) so safe to run every time
CMD ["sh", "-c", "npm run db:migrate && npm start"]
