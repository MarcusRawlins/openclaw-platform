#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join('/Volumes/reeseai-memory/data/cron', 'cron-log.db');

const [runId, status, summary, errorMessage] = process.argv.slice(2);

if (!runId || !status) {
  console.error('Usage: log-end.js <run-id> <status> [summary] [error-message]');
  process.exit(1);
}

try {
  const db = new Database(DB_PATH);

  db.prepare(`
    UPDATE job_runs
    SET status = ?, completed_at = datetime('now'),
        duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER),
        summary = ?, error_message = ?
    WHERE id = ?
  `).run(status, summary || null, errorMessage || null, parseInt(runId));

  db.close();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
