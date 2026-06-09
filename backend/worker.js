import { Worker } from 'bullmq';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { connection } from './queue.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRootWin = path.resolve(__dirname, '..');

// Helper to convert Windows absolute path to WSL path
function toWslPath(winPath) {
  let wslPath = winPath.replace(/^([a-zA-Z]):/, (match, letter) => `/mnt/${letter.toLowerCase()}`);
  return wslPath.replace(/\\/g, '/');
}

const projectRootWsl = toWslPath(projectRootWin);

// Helper to clean up local job folders to save space
async function cleanupLocalFolders(jobId) {
  const downloadsPath = path.join(projectRootWin, 'ai-worker', 'downloads', jobId);
  const separatedPath = path.join(projectRootWin, 'ai-worker', 'separated', jobId);

  try {
    await fs.rm(downloadsPath, { recursive: true, force: true });
    console.log(`Cleaned up downloads folder: ${downloadsPath}`);
  } catch (err) {
    console.error(`Failed to clean downloads folder ${downloadsPath}:`, err.message);
  }

  try {
    await fs.rm(separatedPath, { recursive: true, force: true });
    console.log(`Cleaned up separated folder: ${separatedPath}`);
  } catch (err) {
    console.error(`Failed to clean separated folder ${separatedPath}:`, err.message);
  }
}

// Setup BullMQ worker
const worker = new Worker('audio-separation', async (job) => {
  const jobId = job.data.id;
  const { youtubeUrl } = job.data;

  console.log(`\n========================================`);
  console.log(`Processing Job: ${jobId}`);
  console.log(`URL: ${youtubeUrl}`);
  console.log(`========================================`);

  try {
    // Step 1: Downloading
    console.log(`[Job ${jobId}] Starting Download phase...`);
    await pool.query("UPDATE jobs SET status = 'downloading' WHERE id = $1", [jobId]);
    
    const downloadCmd = `wsl ${projectRootWsl}/ai-worker/venv/bin/python ${projectRootWsl}/ai-worker/downloader.py --url "${youtubeUrl}" --output "${projectRootWsl}/ai-worker/downloads/${jobId}"`;
    console.log(`Executing: ${downloadCmd}`);
    const downloadResult = await execAsync(downloadCmd);
    console.log(downloadResult.stdout);
    if (downloadResult.stderr) console.error(downloadResult.stderr);

    // Step 2: Separating
    console.log(`[Job ${jobId}] Starting Separation phase...`);
    await pool.query("UPDATE jobs SET status = 'separating' WHERE id = $1", [jobId]);
    
    const separateCmd = `wsl ${projectRootWsl}/ai-worker/venv/bin/python ${projectRootWsl}/ai-worker/separator.py --input "${projectRootWsl}/ai-worker/downloads/${jobId}/audio.wav" --output "${projectRootWsl}/ai-worker/separated/${jobId}"`;
    console.log(`Executing: ${separateCmd}`);
    const separateResult = await execAsync(separateCmd);
    console.log(separateResult.stdout);
    if (separateResult.stderr) console.error(separateResult.stderr);

    // Step 3: Uploading
    console.log(`[Job ${jobId}] Starting Upload phase...`);
    await pool.query("UPDATE jobs SET status = 'uploading' WHERE id = $1", [jobId]);
    
    const uploadCmd = `wsl ${projectRootWsl}/ai-worker/venv/bin/python ${projectRootWsl}/ai-worker/uploader.py --job-id "${jobId}" --input-dir "${projectRootWsl}/ai-worker/separated/${jobId}"`;
    console.log(`Executing: ${uploadCmd}`);
    const uploadResult = await execAsync(uploadCmd);
    console.log(uploadResult.stdout);
    if (uploadResult.stderr) console.error(uploadResult.stderr);

    // Parse URLs from uploader stdout
    const vocalMatch = uploadResult.stdout.match(/VOCAL_URL:\s*(https?:\/\/[^\s]+)/);
    const instrumentalMatch = uploadResult.stdout.match(/INSTRUMENTAL_URL:\s*(https?:\/\/[^\s]+)/);

    if (!vocalMatch || !instrumentalMatch) {
      throw new Error("Failed to parse uploaded URLs from python script stdout.");
    }

    const vocalUrl = vocalMatch[1];
    const instrumentalUrl = instrumentalMatch[1];

    // Step 4: Completed
    console.log(`[Job ${jobId}] Job separation completed successfully!`);
    await pool.query(
      "UPDATE jobs SET status = 'completed', vocal_url = $1, instrumental_url = $2 WHERE id = $3",
      [vocalUrl, instrumentalUrl, jobId]
    );

    // Cleanup
    await cleanupLocalFolders(jobId);

  } catch (error) {
    console.error(`[Job ${jobId}] Failed with error:`, error.message);
    
    // Update job status to failed in DB
    await pool.query(
      "UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2",
      [error.message || "Unknown error occurred during processing", jobId]
    );

    // Cleanup local directories in case of failure as well
    await cleanupLocalFolders(jobId);

    // Throw the error to let BullMQ know the job failed
    throw error;
  }
}, {
  connection,
  concurrency: 1, // Process one job at a time
});

worker.on('ready', () => {
  console.log('BullMQ Worker is ready to process jobs.');
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job ? job.id : 'unknown'} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`Job ${job.id} marked as completed in queue.`);
});
