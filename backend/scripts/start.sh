#!/usr/bin/env sh
# Startup script for backend service
# Runs database migrations, then starts the server

set -e

echo "=== Starting Backend Service ==="

# Run database migrations
echo "Running database migrations..."
npm run db:migrate

# Start the server - use exec to replace shell process with node
# This ensures proper signal handling (SIGTERM, etc.)
# Using npm start which respects package.json "main" and "start" script
echo "Starting server..."
exec npm start
