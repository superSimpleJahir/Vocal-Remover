import pool from './db.js';

async function migrate() {
  console.log('Starting migration...');
  try {
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
