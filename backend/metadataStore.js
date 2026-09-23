// Stores AI-generated YouTube metadata (title/description/tags/thumbnail) as a
// JSON file next to the separated tracks. It's intentionally NOT written to
// Postgres - it's throwaway processing output, not a permanent record, and it
// gets deleted along with the rest of the job's `separated/{jobId}` folder by
// the existing cleanup routines. A plain in-memory Map won't work here because
// the API server (index.js) and the BullMQ worker (worker.js) run as separate
// Node processes and don't share memory - the filesystem is what they share.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function metadataFilePath(jobId) {
  return path.join(projectRoot, 'ai-worker', 'separated', jobId, 'metadata.json');
}

export function setJobMetadata(jobId, metadata) {
  const filePath = metadataFilePath(jobId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(metadata), 'utf-8');
}

export function getJobMetadata(jobId) {
  try {
    return JSON.parse(fs.readFileSync(metadataFilePath(jobId), 'utf-8'));
  } catch (err) {
    return null;
  }
}

export function deleteJobMetadata(jobId) {
  try {
    fs.unlinkSync(metadataFilePath(jobId));
  } catch (err) {
    // Already gone - nothing to do.
  }
}
