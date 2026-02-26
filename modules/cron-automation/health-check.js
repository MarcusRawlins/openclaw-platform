#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = '/Volumes/reeseai-memory/data/cron/cron-log.db';
const LOCK_DIR = '/Volumes/reeseai-memory/data/cron/locks';

async function healthCheck() {
  try {
    const db = new Database(DB_PATH);
    const issues = [];

    // 1. Check for stale running jobs
    const stale = db.prepare(`
      SELECT job_name, started_at, pid
      FROM job_runs
      WHERE status = 'running' AND started_at < datetime('now', '-2 hours')
    `).all();

    if (stale.length > 0) {
      issues.push(`${stale.length} stale running job(s): ${stale.map(j => j.job_name).join(', ')}`);
      // Auto-cleanup via cleanup-stale script
      try {
        require('./cleanup-stale.js');
      } catch (e) {
        // cleanup script handles its own errors
      }
    }

    // 2. Check for orphaned lockfiles
    if (fs.existsSync(LOCK_DIR)) {
      const lockfiles = fs.readdirSync(LOCK_DIR);
      for (const file of lockfiles) {
        const lockPath = path.join(LOCK_DIR, file);
        try {
          const pidContent = fs.readFileSync(lockPath, 'utf-8').trim();
          const pid = parseInt(pidContent);
          let alive = false;
          try {
            process.kill(pid, 0);
            alive = true;
          } catch (e) {
            // Process doesn't exist
          }

          if (!alive) {
            issues.push(`Orphaned lockfile: ${file} (PID ${pid} dead)`);
            fs.unlinkSync(lockPath);
          }
        } catch (e) {
          // Error reading lockfile, might be safe to ignore
        }
      }
    }

    // 3. Check for persistent failures
    const failingJobs = db.prepare(`
      SELECT job_name, COUNT(*) as failures
      FROM job_runs
      WHERE status = 'failed' AND started_at >= datetime('now', '-6 hours')
      GROUP BY job_name
      HAVING failures >= 3
    `).all();

    if (failingJobs.length > 0) {
      for (const job of failingJobs) {
        issues.push(`Persistent failure: ${job.job_name} (${job.failures} failures in 6h)`);
      }
    }

    db.close();

    // 4. Report if issues found
    if (issues.length > 0) {
      try {
        const queue = require('../notification-queue/queue');
        queue.enqueue(
          `🏥 Cron Health Check: ${issues.length} issue(s)\n\n${issues.map(i => `• ${i}`).join('\n')}`,
          { source: 'cron-health', tier: 'high', topic: 'system-health' }
        ).catch(err => {
          console.error('Failed to send health check notification:', err.message);
        });
      } catch (e) {
        // Queue not available, just log
        console.log('Could not send notification, but issues found:', issues);
      }
    }

    return { healthy: issues.length === 0, issues };
  } catch (err) {
    console.error('Health check error:', err.message);
    return { healthy: false, issues: ['Health check failed: ' + err.message] };
  }
}

// CLI invocation
if (require.main === module) {
  healthCheck().then(result => {
    if (result.healthy) {
      console.log('✅ All healthy');
    } else {
      console.log(`⚠️ ${result.issues.length} issues found:`);
      result.issues.forEach(i => console.log(`  • ${i}`));
    }
    process.exit(result.healthy ? 0 : 1);
  });
}

module.exports = { healthCheck };
