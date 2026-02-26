#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join('/Volumes/reeseai-memory/data/cron', 'cron-log.db');

const [jobName, reason] = process.argv.slice(2);

if (!jobName) {
  console.error('Usage: log-skip.js <job-name> [reason]');
  process.exit(1);
}

try {
  const db = new Database(DB_PATH);

  db.prepare(`
    INSERT INTO job_runs (job_name, status, summary)
    VALUES (?, 'skipped', ?)
  `).run(jobName, reason || 'skipped');

  db.close();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
