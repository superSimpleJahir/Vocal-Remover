# Day 4: Cloud Storage & Queue Worker Integration

Today's focus is implementing the uploader logic to Cloudflare R2 and wiring up the BullMQ Worker in Node.js to manage the job execution pipeline.

## Tasks Checklist
- [ ] **R2 Uploader Script**: Write `ai-worker/uploader.py` using `boto3` to upload WAV/MP3 tracks to Cloudflare R2 buckets.
- [ ] **Queue Worker**: Build `backend/worker.js` to process tasks from the `audio-processing` queue.
- [ ] **Child Process Wrapper**: Write execution wrapper to spawn python scripts, capture status updates from stdout, and reflect them in Neon DB.
- [ ] **Integration Test**: Verify end-to-end flow from backend posting -> queue -> worker -> python separation -> R2 uploads -> DB updates.

---

## Technical Details

### R2 Uploader: `ai-worker/uploader.py`
Connects using the S3-compatible API client of `boto3`. Saves files under:
- `tracks/{jobId}/vocals.mp3`
- `tracks/{jobId}/instrumental.mp3`

### Node.js Queue Worker: `backend/worker.js`
- Subscribes to the BullMQ queue.
- Updates database job status to `downloading`, runs Python download script.
- Updates job status to `separating`, runs Python separation script.
- Updates job status to `uploading`, runs Python upload script.
- Updates job status to `completed` and stores URLs on successful run, or `failed` with error message if script throws.

Example child process execution pattern:
```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Inside worker process job handler:
await db.query("UPDATE jobs SET status = 'downloading' WHERE id = $1", [jobId]);
await execAsync(`python ../ai-worker/downloader.py --url "${youtubeUrl}" --output "../ai-worker/downloads/${jobId}"`);
```

---

## Verification
1. Run local worker process: `node worker.js` in `/backend`.
2. Post a job. Check terminal logs to verify the worker picks it up and runs the separation workflow.
3. Verify that new files are uploaded to your Cloudflare R2 bucket.
4. Verify the database record shows status `completed` and contains correct R2 file URLs.
