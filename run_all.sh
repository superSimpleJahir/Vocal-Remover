#!/bin/bash

# Color codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}==================================================${NC}"
echo -e "${CYAN}Starting Vocal Remover App Stack (macOS)...${NC}"
echo -e "${CYAN}==================================================${NC}"

# 1. Start Redis
echo -e "${GREEN}[1/4] Starting Redis Service...${NC}"
brew services start redis
sleep 2

# 2. Start Backend API Server
echo -e "${GREEN}[2/4] Starting Backend API Server...${NC}"
(cd backend && npm run dev) &
BACKEND_PID=$!

# 3. Start Queue Worker
echo -e "${GREEN}[3/4] Starting Queue Worker...${NC}"
(cd backend && npm run worker) &
WORKER_PID=$!

# 4. Start Next.js Frontend
echo -e "${GREEN}[4/4] Starting Next.js Frontend...${NC}"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo -e "${CYAN}\nAll components started successfully!${NC}"
echo -e "Web UI: ${YELLOW}http://localhost:3000${NC}"
echo -e "Backend API: ${YELLOW}http://localhost:5001${NC}"
echo -e "To stop all services, run: ${YELLOW}kill $BACKEND_PID $WORKER_PID $FRONTEND_PID && brew services stop redis${NC}"

# Wait for background processes to keep terminal running
wait
