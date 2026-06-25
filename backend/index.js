import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { audioQueue } from './queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/tracks', express.static(path.join(__dirname, '../ai-worker/separated')));

// YouTube URL Validation (matches www.youtube.com, youtube.com, youtu.be)
function isValidYoutubeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.replace('www.', '');
    return host === 'youtube.com' || host === 'youtu.be' || host === 'm.youtube.com';
  } catch (err) {
    return false;
  }
}

// UUID regex validation
function isValidUuid(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// POST /api/jobs - Submit a separation job
app.post('/api/jobs', async (req, res) => {
  const { youtubeUrl } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ error: 'youtubeUrl is required' });
  }

  if (!isValidYoutubeUrl(youtubeUrl)) {
    return res.status(400).json({ error: 'Invalid YouTube URL format' });
  }

  try {
    // Save job into Neon / PostgreSQL database
    const insertQuery = `
      INSERT INTO jobs (youtube_url, status)
      VALUES ($1, 'pending')
      RETURNING id, status;
    `;
    const result = await pool.query(insertQuery, [youtubeUrl]);
    const job = result.rows[0];

    // Push the processing request onto the Redis queue
    await audioQueue.add('separate', {
      id: job.id,
      youtubeUrl,
    });

    console.log(`Job created and queued: ${job.id}`);
    res.status(201).json({ id: job.id, status: job.status });
  } catch (err) {
    console.error('Failed to create job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs/:id - Get job status
app.get('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;

  if (!isValidUuid(id)) {
    return res.status(400).json({ error: 'Invalid job ID format' });
  }

  try {
    const queryText = `
      SELECT id, youtube_url, status, error_message, vocal_url, instrumental_url, vocal_no_silence_url, created_at
      FROM jobs
      WHERE id = $1;
    `;
    const result = await pool.query(queryText, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to query job:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// nodemon trigger comment
