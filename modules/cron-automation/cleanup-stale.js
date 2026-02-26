#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join('/Volumes/reeseai-memory/data/cron', 'cron-log.db');

try {
  const db = new Database(DB_PATH);

  // Find jobs stuck in "running" for >2 hours
  const stale = db.prepare(`
    SELECT id, job_name, pid
    FROM job_runs
    WHERE status = 'running' AND started_at < datetime('now', '-2 hours')
  `).all();

  for (const job of stale) {
    // Check if PID is still alive
    let alive = false;
    try {
      process.kill(job.pid, 0);
      alive = true;
    } catch (e) {
      // Process doesn't exist
    }

    if (!alive) {
      db.prepare(`
        UPDATE job_runs
        SET status = 'failed', completed_at = datetime('now'), error_message = 'Stale: PID dead after 2+ hours'
        WHERE id = ?
      `).run(job.id);

      // Remove lockfile if exists
      const lockFile = `/Volumes/reeseai-memory/data/cron/locks/${job.job_name}.lock`;
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }

      console.log(`Cleaned stale job: ${job.job_name} (run ${job.id})`);
    }
  }

  db.close();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
