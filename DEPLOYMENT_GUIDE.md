# Vocal Remover App Deployment Guide

This guide explains how to deploy the Vocal Remover application for free. 
* **Backend & AI Worker:** Hosted on Hugging Face Spaces (using a Docker template, which gives a free CPU instance with **16GB RAM and 2 vCPUs**, plenty of memory for the Meta Demucs AI model).
* **Redis Server:** Running locally inside the Hugging Face Docker container (fully self-contained, 100% free with no limits).
* **Database:** Connected to Supabase (Free Tier PostgreSQL).
* **Storage:** Connected to Cloudflare R2 (Free Tier S3 storage).
* **Frontend:** Hosted on Vercel (Hobby plan, 100% Free).

---

## Part 1: Deploy Backend & AI Worker to Hugging Face

1. **Sign Up / Log In**: Go to [Hugging Face](https://huggingface.co/) and create a free account if you haven't already.
2. **Create Space**:
   * Click **New Space** (or go to `huggingface.co/new-space`).
   * **Space Name**: e.g., `vocal-remover-backend` (or any name you prefer).
   * **License**: Open-source (e.g., MIT).
   * **SDK**: **Docker** (⚠️ Critical step).
   * **Docker Template**: Choose **Blank**.
   * **Space Hardware**: CPU Basic (Free - comes with **16GB RAM and 2 vCPUs**).
   * **Visibility**: **Public** (so the frontend on Vercel can reach it).
3. **Configure Environment Variables**:
   * Go to the **Settings** tab of your new Space.
   * Under **Variables and secrets**, add the following **Secrets** (not variables):
     * `DATABASE_URL` = (Your Supabase PostgreSQL Connection String)
     * `R2_ACCOUNT_ID` = (Your Cloudflare R2 Account ID)
     * `R2_ACCESS_KEY_ID` = (Your Cloudflare R2 Access Key ID)
     * `R2_SECRET_ACCESS_KEY` = (Your Cloudflare R2 Secret Access Key)
     * `R2_BUCKET_NAME` = (Your Cloudflare R2 Bucket Name)
     * `R2_PUBLIC_URL` = (Your Cloudflare R2 Public CDN URL, e.g., `https://pub-xxxx.r2.dev`)
     * `REDIS_URL` = `redis://127.0.0.1:6379` (Connects to the local Redis inside the container)
4. **Push the Files**:
   * Clone the Space repository using Git, or upload files directly through the Hugging Face web UI.
   * Upload the following folders and files:
     * `/backend` (folder)
     * `/ai-worker` (folder)
     * `Dockerfile.hf` (⚠️ **IMPORTANT: Rename this file to `Dockerfile` when uploading to Hugging Face!**)
     * `start.sh` (at the root)
   * Commit and push. Hugging Face will automatically start building the Docker container (this will take 3-5 minutes). Once built, the status will show: `Running`.
   * Your API backend URL will be: `https://<your-username>-<your-space-name>.hf.space` (Example: `https://jahir-vocal-remover-backend.hf.space`). You can test it by visiting `https://<your-username>-<your-space-name>.hf.space/health` in your browser.

---

## Part 2: Deploy Frontend to Vercel

1. **GitHub Upload**:
   * Push your entire project (or just the `/frontend` directory) to a repository on **GitHub** (private or public).
2. **Deploy on Vercel**:
   * Go to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
   * Import your GitHub repository.
3. **Project Settings**:
   * **Framework Preset**: `Next.js`.
   * **Root Directory**: `frontend`.
   * **Environment Variables**: Add a new key:
     * `NEXT_PUBLIC_API_URL` = `https://<your-username>-<your-space-name>.hf.space` (Your Hugging Face Space URL from Part 1).
4. **Deploy**:
   * Click **Deploy**. Vercel will build the Next.js app and give you a live production URL!

---

## Verification

To verify that the deployment works:
1. Open the Vercel Frontend URL.
2. Enter a YouTube URL and click split.
3. Check the progress. The frontend will hit the Hugging Face backend, which pushes the job to the local Redis queue. The background worker will download the audio using `yt-dlp`, split it using `Demucs`, and upload the final tracks to Cloudflare R2.
4. The Wavesurfer player on the frontend will stream the audio tracks directly from Cloudflare R2!
