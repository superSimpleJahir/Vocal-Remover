import { Worker } from 'bullmq';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';
import { connection } from './queue.js';

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

/**
 * Spawns a command inside WSL and returns a Promise.
 * Streams stdout and stderr to the console in real-time.
 * Resolves with the accumulated stdout string on success, or rejects on error.
 */
function runWslCommand(args, jobId, phase) {
  return new Promise((resolve, reject) => {
    console.log(`[Job ${jobId}] [${phase}] Spawning: wsl ${args.join(' ')}`);
    const child = spawn('wsl', args);
    let stdoutData = '';
    let stderrData = '';
    let stdoutLineBuffer = '';
    let stderrLineBuffer = '';

    child.stdout.on('data', (data) => {
      const str = data.toString();
      stdoutData += str;
      
      stdoutLineBuffer += str;
      const lines = stdoutLineBuffer.split('\n');
      stdoutLineBuffer = lines.pop(); // Keep the last incomplete line
      for (const line of lines) {
        if (line.trim()) {
          console.log(`[Job ${jobId}] [${phase}] ${line.trim()}`);
        }
      }
    });

    child.stderr.on('data', (data) => {
      const str = data.toString();
      stderrData += str;
      
      stderrLineBuffer += str;
      const lines = stderrLineBuffer.split('\n');
      stderrLineBuffer = lines.pop(); // Keep the last incomplete line
      for (const line of lines) {
        if (line.trim()) {
          console.error(`[Job ${jobId}] [${phase}] [ERR] ${line.trim()}`);
        }
      }
    });

    child.on('close', (code) => {
      if (stdoutLineBuffer.trim()) {
        console.log(`[Job ${jobId}] [${phase}] ${stdoutLineBuffer.trim()}`);
      }
      if (stderrLineBuffer.trim()) {
        console.error(`[Job ${jobId}] [${phase}] [ERR] ${stderrLineBuffer.trim()}`);
      }
      
      if (code === 0) {
        resolve(stdoutData);
      } else {
        const errMsg = `Process exited with code ${code}.`;
        console.error(`[Job ${jobId}] [${phase}] Failed: ${errMsg}`);
        reject(new Error(errMsg + (stderrData ? ` Stderr: ${stderrData}` : '')));
      }
    });

    child.on('error', (err) => {
      console.error(`[Job ${jobId}] [${phase}] Spawn error:`, err.message);
      reject(err);
    });
  });
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
    const pythonPath = `${projectRootWsl}/ai-worker/venv/bin/python`;

    // Step 1: Downloading
    console.log(`[Job ${jobId}] Starting Download phase...`);
    await pool.query("UPDATE jobs SET status = 'downloading' WHERE id = $1", [jobId]);
    
    const downloadArgs = [
      pythonPath,
      `${projectRootWsl}/ai-worker/downloader.py`,
      '--url', youtubeUrl,
      '--output', `${projectRootWsl}/ai-worker/downloads/${jobId}`
    ];
    await runWslCommand(downloadArgs, jobId, 'DOWNLOAD');

    // Step 2: Separating
    console.log(`[Job ${jobId}] Starting Separation phase...`);
    await pool.query("UPDATE jobs SET status = 'separating' WHERE id = $1", [jobId]);
    
    const separateArgs = [
      pythonPath,
      `${projectRootWsl}/ai-worker/separator.py`,
      '--input', `${projectRootWsl}/ai-worker/downloads/${jobId}/audio.wav`,
      '--output', `${projectRootWsl}/ai-worker/separated/${jobId}`
    ];
    await runWslCommand(separateArgs, jobId, 'SEPARATE');

    // Step 3: Uploading
    console.log(`[Job ${jobId}] Starting Upload phase...`);
    await pool.query("UPDATE jobs SET status = 'uploading' WHERE id = $1", [jobId]);
    
    const uploadArgs = [
      pythonPath,
      `${projectRootWsl}/ai-worker/uploader.py`,
      '--job-id', jobId,
      '--input-dir', `${projectRootWsl}/ai-worker/separated/${jobId}`
    ];
    const uploadOutput = await runWslCommand(uploadArgs, jobId, 'UPLOAD');

    // Parse URLs from uploader stdout
    const vocalMatch = uploadOutput.match(/VOCAL_URL:\s*(https?:\/\/[^\s]+)/);
    const instrumentalMatch = uploadOutput.match(/INSTRUMENTAL_URL:\s*(https?:\/\/[^\s]+)/);

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
