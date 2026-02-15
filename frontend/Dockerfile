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

# PORT configuration:
# - Railway: Assigns PORT dynamically at runtime; Next.js uses it automatically
# - Local Docker: Set PORT environment variable explicitly (e.g., docker run -e PORT=3000)
#
# Health checks:
# - Railway: Uses healthcheckPath in railway.json; Docker HEALTHCHECK not needed
# - Local Docker: Configure health checks externally (docker-compose or orchestrator)

# Bind to 0.0.0.0 so Railway/Docker proxy can reach the server (required for container networking)
ENV HOSTNAME=0.0.0.0

# Start command - Next.js uses PORT and HOSTNAME env vars
CMD ["npm", "start"]
