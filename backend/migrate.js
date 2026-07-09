import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  console.log('Starting migration...');
  try {
    console.log('Initializing database schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('Schema initialized successfully.');

    await pool.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS vocal_no_silence_url TEXT;');
    console.log('Migration successful: vocal_no_silence_url column added/verified.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('Database connection closed.');
  }
}

migrate();
