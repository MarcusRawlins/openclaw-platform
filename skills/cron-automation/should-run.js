#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join('/Volumes/reeseai-memory/data/cron', 'cron-log.db');

const [jobName, idempotency] = process.argv.slice(2);

if (!jobName || !idempotency) {
  console.error('Usage: should-run.js <job-name> <idempotency>');
  process.exit(1);
}

try {
  const db = new Database(DB_PATH);

  const window = idempotency === 'daily' ? '-1 day' : '-1 hour';
  const existing = db.prepare(`
    SELECT COUNT(*) as count
    FROM job_runs
    WHERE job_name = ? AND status = 'success' AND started_at >= datetime('now', ?)
  `).get(jobName, window);

  console.log(existing.count > 0 ? 'false' : 'true');
  db.close();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
