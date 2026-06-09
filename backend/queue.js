import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Setup IORedis connection
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

connection.on('connect', () => {
  console.log('Redis connected successfully.');
});

connection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Define the queue instance
const audioQueue = new Queue('audio-separation', {
  connection,
});

export { audioQueue, connection };
