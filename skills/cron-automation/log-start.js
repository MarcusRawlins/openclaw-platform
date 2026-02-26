#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = '/Volumes/reeseai-memory/data/cron';
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'cron-log.db');

const [jobName, pid] = process.argv.slice(2);

if (!jobName || !pid) {
  console.error('Usage: log-start.js <job-name> <pid>');
  process.exit(1);
}

try {
  const db = new Database(DB_PATH);
  
  // Initialize schema if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS job_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL,
      status TEXT DEFAULT 'running' CHECK(status IN ('running', 'success', 'failed', 'timeout', 'killed', 'skipped')),
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      duration_seconds INTEGER,
      summary TEXT,
      error_message TEXT,
      pid INTEGER,
      exit_code INTEGER
    );

    CREATE TABLE IF NOT EXISTS job_config (
      job_name TEXT PRIMARY KEY,
      max_runtime_seconds INTEGER DEFAULT 7200,
      idempotency TEXT DEFAULT 'none' CHECK(idempotency IN ('none', 'daily', 'hourly')),
      alert_on_failure BOOLEAN DEFAULT 1,
      failure_threshold INTEGER DEFAULT 3,
      failure_window_hours INTEGER DEFAULT 6,
      enabled BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      acknowledged BOOLEAN DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_runs_job ON job_runs(job_name);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON job_runs(status);
    CREATE INDEX IF NOT EXISTS idx_runs_started ON job_runs(started_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_job ON alerts(job_name);
  `);

  const result = db.prepare(`
    INSERT INTO job_runs (job_name, status, pid)
    VALUES (?, 'running', ?)
  `).run(jobName, parseInt(pid));

  console.log(result.lastInsertRowid);
  db.close();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
