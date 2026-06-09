# Claude Development Guidelines

This file outlines the development instructions and coding standards for Claude to build the Vocal Remover Web Application.

## Tech Stack
- Frontend: Next.js (React), Tailwind CSS, Wavesurfer.js
- Backend: Node.js, Express, BullMQ, Redis
- AI Worker: Python, Meta Demucs, yt-dlp, FFmpeg

## Commands
- Install backend dependencies: `npm install` inside `/backend`
- Start backend dev server: `npm run dev` or `node index.js`
- Install frontend dependencies: `npm install` inside `/frontend`
- Start frontend dev server: `npm run dev`
- Run Python worker: `python main.py` inside `/ai-worker`

## Rules
- Always use asynchronous task queues for long-running audio operations.
- Ensure audio waveforms are synced when playing vocal and instrumental together.
