#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join('/Volumes/reeseai-memory/data/cron', 'cron-log.db');

const [jobName] = process.argv.slice(2);

if (!jobName) {
  console.error('Usage: check-failures.js <job-name>');
  process.exit(1);
}

try {
  const db = new Database(DB_PATH);

  const config = db.prepare('SELECT * FROM job_config WHERE job_name = ?').get(jobName);
  const windowHours = config?.failure_window_hours || 6;

  const failures = db.prepare(`
    SELECT COUNT(*) as count
    FROM job_runs
    WHERE job_name = ? AND status = 'failed' AND started_at >= datetime('now', '-${windowHours} hours')
  `).get(jobName);

  console.log(failures.count);
  db.close();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
