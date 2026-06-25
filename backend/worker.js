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

const isWindows = process.platform === 'win32';
const projectRootWsl = toWslPath(projectRootWin);
const projectRoot = isWindows ? projectRootWsl : projectRootWin;

const pythonPath = isWindows 
  ? `${projectRootWsl}/ai-worker/venv/bin/python` 
  : (process.env.PYTHON_PATH || 'python3');

// Helper to clean up local downloads folder to save space
async function cleanupDownloadsFolder(jobId) {
  const downloadsPath = path.join(projectRootWin, 'ai-worker', 'downloads', jobId);
  try {
    await fs.rm(downloadsPath, { recursive: true, force: true });
    console.log(`Cleaned up downloads folder: ${downloadsPath}`);
  } catch (err) {
    console.error(`Failed to clean downloads folder ${downloadsPath}:`, err.message);
  }
}

// Helper to clean up local separated folder to save space
async function cleanupSeparatedFolder(jobId) {
  const separatedPath = path.join(projectRootWin, 'ai-worker', 'separated', jobId);
  try {
    await fs.rm(separatedPath, { recursive: true, force: true });
    console.log(`Cleaned up separated folder: ${separatedPath}`);
  } catch (err) {
    console.error(`Failed to clean separated folder ${separatedPath}:`, err.message);
  }
}

// Purge leftover/stale directories to prevent storage leaks
async function purgeStaleTempDirs(maxAgeMs = 3600000) {
  const dirsToClean = [
    path.join(projectRootWin, 'ai-worker', 'downloads'),
    path.join(projectRootWin, 'ai-worker', 'separated')
  ];

  const now = Date.now();

  for (const parentDir of dirsToClean) {
    try {
      const items = await fs.readdir(parentDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const dirPath = path.join(parentDir, item.name);
          const stats = await fs.stat(dirPath);
          const age = now - stats.mtimeMs;
          if (maxAgeMs === 0 || age > maxAgeMs) {
            console.log(`[Cleanup] Removing stale temp directory: ${dirPath} (Age: ${Math.round(age / 60000)} mins)`);
            await fs.rm(dirPath, { recursive: true, force: true });
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`[Cleanup] Error scanning ${parentDir}:`, err.message);
      }
    }
  }
}

// Run startup cleanup (purge all leftover folders)
purgeStaleTempDirs(0)
  .then(() => console.log('[Cleanup] Startup workspace cleanup completed.'))
  .catch((err) => console.error('[Cleanup] Startup workspace cleanup failed:', err));

// Set up periodic cleanup every 30 minutes to clean files older than 1 hour
setInterval(() => {
  console.log('[Cleanup] Running periodic stale temp folder cleanup...');
  purgeStaleTempDirs(3600000).catch((err) => console.error('[Cleanup] Periodic workspace cleanup failed:', err));
}, 30 * 60 * 1000).unref();

/**
 * Spawns a command (either inside WSL on Windows, or directly on Linux/Docker) and returns a Promise.
 * Streams stdout and stderr to the console in real-time.
 * Resolves with the accumulated stdout string on success, or rejects on error.
 */
function runCommand(executable, args, jobId, phase) {
  return new Promise((resolve, reject) => {
    let spawnCmd = executable;
    let spawnArgs = args;

    if (isWindows) {
      spawnCmd = 'wsl';
      spawnArgs = [executable, ...args];
    }

    console.log(`[Job ${jobId}] [${phase}] Spawning: ${spawnCmd} ${spawnArgs.join(' ')}`);
    const child = spawn(spawnCmd, spawnArgs);
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
    // Step 1: Downloading
    console.log(`[Job ${jobId}] Starting Download phase...`);
    await pool.query("UPDATE jobs SET status = 'downloading' WHERE id = $1", [jobId]);
    
    const downloadArgs = [
      `${projectRoot}/ai-worker/downloader.py`,
      '--url', youtubeUrl,
      '--output', `${projectRoot}/ai-worker/downloads/${jobId}`
    ];
    await runCommand(pythonPath, downloadArgs, jobId, 'DOWNLOAD');

    // Step 2: Separating
    console.log(`[Job ${jobId}] Starting Separation phase...`);
    await pool.query("UPDATE jobs SET status = 'separating' WHERE id = $1", [jobId]);
    
    const separateArgs = [
      `${projectRoot}/ai-worker/separator.py`,
      '--input', `${projectRoot}/ai-worker/downloads/${jobId}/audio.wav`,
      '--output', `${projectRoot}/ai-worker/separated/${jobId}`
    ];
    await runCommand(pythonPath, separateArgs, jobId, 'SEPARATE');

    // Step 3: Uploading
    console.log(`[Job ${jobId}] Starting Upload phase...`);
    await pool.query("UPDATE jobs SET status = 'uploading' WHERE id = $1", [jobId]);
    
    const uploadArgs = [
      `${projectRoot}/ai-worker/uploader.py`,
      '--job-id', jobId,
      '--input-dir', `${projectRoot}/ai-worker/separated/${jobId}`
    ];
    const uploadOutput = await runCommand(pythonPath, uploadArgs, jobId, 'UPLOAD');

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

    // Cleanup downloads only, keep separated MP3s for local serving
    await cleanupDownloadsFolder(jobId);

  } catch (error) {
    console.error(`[Job ${jobId}] Failed with error:`, error.message);
    
    // Update job status to failed in DB
    await pool.query(
      "UPDATE jobs SET status = 'failed', error_message = $1 WHERE id = $2",
      [error.message || "Unknown error occurred during processing", jobId]
    );

    // Cleanup both downloads and separated on failure
    await cleanupDownloadsFolder(jobId);
    await cleanupSeparatedFolder(jobId);

    // Throw the error to let BullMQ know the job failed
    throw error;
  }
}, {
  connection,
  concurrency: 1, // Process one job at a time
  lockDuration: 600000, // 10 minutes lock duration to prevent timeouts during audio separation
  lockRenewTime: 30000, // Renew every 30 seconds
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
