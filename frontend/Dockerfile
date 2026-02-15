# Frontend Dockerfile for Railway deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build argument for API URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js (environment variables are baked into the build)
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

# Note: Railway assigns PORT dynamically at runtime
# Next.js automatically uses PORT env var when set
# Railway handles healthchecks via healthcheckPath in railway.json
# Docker HEALTHCHECK is not needed and can interfere with Railway

# Start command - Next.js automatically uses PORT env var
CMD ["npm", "start"]
