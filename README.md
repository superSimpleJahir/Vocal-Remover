# Vocal Remover Web Application

This repository contains the source code for a web application that extracts vocals and instrumentals from YouTube videos using Meta's Demucs AI model.

## Folder Structure

- `/frontend` - Next.js web interface for URL input, processing status, and dual-track player (with Wavesurfer.js).
- `/backend` - Node.js Express server to handle API requests and manage task queues using Redis & BullMQ.
- `/ai-worker` - Python worker service executing `yt-dlp` for downloads and `Demucs` for vocal separation.

## Key Features

1. **YouTube URL Input**: Simple validation and submission of YouTube links.
2. **Asynchronous Job Queue**: Background processing so users don't have to wait with an open connection.
3. **Real-time Status updates**: Feedback on download, extraction, and upload progress.
4. **Dual-Track Player**: In-browser synchronized listening of both vocals and instrumental tracks.
5. **Download Options**: High-quality MP3 download buttons for each separated track.
6. **Cloudflare R2 Integration**: Fast, egress-fee-free file storage.

## 7-Day Work Plan

- **Day 1**: Setup Workspace Structure & Configuration
- **Day 2**: Python Core Separation (yt-dlp, FFmpeg, Demucs integration)
- **Day 3**: Node.js Backend & Task Queue (Redis/BullMQ)
- **Day 4**: Cloud Storage (Cloudflare R2) and Supabase database connection
- **Day 5**: Next.js Frontend Setup (Sleek UI and URL submission)
- **Day 6**: Interactive Audio Waveform Player (Wavesurfer.js integration)
- **Day 7**: Testing & Cloud Deployment (Docker/Vercel/RunPod)
