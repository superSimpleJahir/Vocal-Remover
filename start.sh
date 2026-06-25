#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Start redis-server in the background
echo "Starting local Redis server..."
redis-server --daemonize yes

# Wait for Redis to be fully ready
echo "Waiting for Redis to start..."
until redis-cli ping | grep -q "PONG"; do
  sleep 1
done
echo "Redis is ready."

# Run database migrations (Supabase column setup)
echo "Running database migrations..."
node /app/backend/migrate.js

# Start the BullMQ worker in the background
echo "Starting BullMQ processing worker..."
node /app/backend/worker.js &

# Start the Express API server in the foreground
echo "Starting Express API server..."
exec node /app/backend/index.js
