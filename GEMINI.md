# Gemini Development Guidelines

This file outlines the development instructions for Gemini to build the Vocal Remover Web Application.

## Project Structure
- `/frontend` - Next.js React frontend
- `/backend` - Node.js Express server
- `/ai-worker` - Python AI processing worker

## Tech Stack
- Frontend: Next.js (React), Tailwind CSS, Wavesurfer.js
- Backend: Node.js, Express, BullMQ, Redis
- AI Worker: Python, Meta Demucs, yt-dlp, FFmpeg
- Storage: Cloudflare R2 / S3
- Database: Supabase (PostgreSQL)

## Key Rules
1. Maintain clean modular code.
2. Do not write large files of audio into git. Use `.gitignore`.
3. Keep the frontend responsive and follow a sleek dark-themed UI.
