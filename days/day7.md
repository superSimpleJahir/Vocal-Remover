# Day 7: Testing, Dockerization & Production Setup

Today's focus is finalizing the project for deployment: adding production-grade container configurations, robust error handling, and documenting verification walkthroughs.

## Tasks Checklist
- [x] **Dockerize Services**: Create a multi-service Dockerfile configuration to bundle Node.js, Python, FFmpeg, and Demucs packages.
- [x] **Error Edge Cases**: Handle processing errors (e.g. video country locks, YouTube age limits, out-of-memory errors on large files).
- [x] **Cleanup Scripts**: Ensure local scratch files are regularly cleaned up in the worker directory to prevent server storage leaks.
- [x] **Final Walkthrough**: Author `walkthrough.md` documenting verified workflows and screenshots.

---

## Technical Details

### Docker Configuration: `Dockerfile`
A multi-stage build structure:
- **Base**: Python 3.10 + PyTorch image (supporting GPU/CUDA).
- **Dependencies**: Install FFmpeg and nodejs/npm.
- **Backend / Worker**: Copy package files, install npm dependencies, copy source files.
- **Frontend**: Separately bundle and build Next.js application (can also be deployed separately on Vercel/Netlify for better scaling).

```dockerfile
FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

# Install FFmpeg and system dependencies
RUN apt-get update && apt-get install -y ffmpeg curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# ... copy and configure backend, frontend, worker
```

### Temporary File Lifecycle
Ensure local temporary audio files are deleted after successful R2 upload or failure:
- Downloader inputs are cleaned up inside `finally` blocks in the worker.
- Temporary files inside `ai-worker/downloads/` and `ai-worker/separated/` are purged after the job is completed/failed.

---

## Verification
1. Run local Docker container compilation to verify dependencies match.
2. Submit a long song (e.g., 8+ minutes) to test system resource bounds.
3. Validate that failed jobs leave a detailed error message in the `jobs` database.
