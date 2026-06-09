# Multi-stage Dockerfile for vocal-remover-app

# --- Stage 1: Base image with PyTorch, Python, Node.js, and FFmpeg ---
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime AS base

# Prevent interactive prompts during package installations
ENV DEBIAN_FRONTEND=noninteractive

# Install FFmpeg, curl, Node.js, and git
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    gnupg \
    git \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy AI worker requirements and install dependencies
COPY ai-worker/requirements.txt ./ai-worker/requirements.txt
RUN pip install --no-cache-dir -r ./ai-worker/requirements.txt

# --- Stage 2: Backend and Worker Service ---
FROM base AS backend-worker

# Copy package files and install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy backend and worker sources
COPY backend/ ./backend/
COPY ai-worker/ ./ai-worker/

EXPOSE 5000

# --- Stage 3: Frontend Build Stage ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ENV NEXT_PUBLIC_API_URL=http://localhost:5000
RUN npm run build

# --- Stage 4: Frontend Run Stage ---
FROM node:18-alpine AS frontend
WORKDIR /app

COPY --from=frontend-builder /app/package*.json ./
COPY --from=frontend-builder /app/next.config.ts ./
COPY --from=frontend-builder /app/.next ./.next
COPY --from=frontend-builder /app/public ./public
RUN npm ci --only=production

EXPOSE 3000
CMD ["npm", "run", "start"]
