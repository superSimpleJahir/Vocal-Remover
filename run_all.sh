#!/bin/bash

# Color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}Starting Vocal Remover App Stack (macOS)...${NC}"
echo -e "${CYAN}==================================================${NC}"

# 1. Start Postgres (Docker container from docker-compose.yml)
echo -e "${GREEN}[1/5] Starting Postgres Database...${NC}"
if ! docker info >/dev/null 2>&1; then
  echo -e "${YELLOW}Docker daemon is not running - launching Docker Desktop...${NC}"
  open -a Docker
  until docker info >/dev/null 2>&1; do
    sleep 2
  done
fi
docker compose up -d db

echo -e "${YELLOW}Waiting for Postgres to accept connections...${NC}"
until docker exec vocal-remover-db pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done
echo -e "${GREEN}Postgres is ready.${NC}"

# 2. Start Redis
echo -e "${GREEN}[2/5] Starting Redis Service...${NC}"
brew services start redis
sleep 2

# 3. Start Backend API Server
echo -e "${GREEN}[3/5] Starting Backend API Server...${NC}"
(cd backend && npm run dev) &
BACKEND_PID=$!

# 4. Start Queue Worker
echo -e "${GREEN}[4/5] Starting Queue Worker...${NC}"
(cd backend && npm run worker) &
WORKER_PID=$!

# 5. Start Next.js Frontend
echo -e "${GREEN}[5/5] Starting Next.js Frontend...${NC}"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo -e "${CYAN}\nAll components started successfully!${NC}"
echo -e "Web UI: ${YELLOW}http://localhost:3000${NC}"
echo -e "Backend API: ${YELLOW}http://localhost:5001${NC}"
echo -e "To stop all services, run: ${YELLOW}kill $BACKEND_PID $WORKER_PID $FRONTEND_PID && brew services stop redis && docker compose stop db${NC}"

# Wait for background processes to keep terminal running
wait
