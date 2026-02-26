#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join('/Volumes/reeseai-memory/data/cron', 'cron-log.db');

const command = process.argv[2];
const args = process.argv.slice(3);

try {
  const db = new Database(DB_PATH);

  switch (command) {
    case 'history':
      showHistory(db, args[0], args[1] || 10);
      break;
    case 'status':
      showStatus(db);
      break;
    case 'failures':
      showFailures(db, args[0] || 24);
      break;
    case 'recent':
      showRecent(db, args[0] || 20);
      break;
    default:
      console.log(`Cron Query CLI

Usage:
  cron-query history [job-name] [limit]  — Show run history (default: last 10)
  cron-query status                       — Show all job statuses
  cron-query failures [hours]             — Show failures in window (default: 24h)
  cron-query recent [limit]               — Show recent runs (default: 20)

Examples:
  cron-query history
  cron-query history my-job 20
  cron-query failures 6
  cron-query recent 50`);
  }

  db.close();
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}

function showHistory(db, jobName, limit) {
  const limitNum = parseInt(limit) || 10;
  const sql = jobName
    ? 'SELECT * FROM job_runs WHERE job_name = ? ORDER BY started_at DESC LIMIT ?'
    : 'SELECT * FROM job_runs ORDER BY started_at DESC LIMIT ?';

  const rows = jobName
    ? db.prepare(sql).all(jobName, limitNum)
    : db.prepare(sql).all(limitNum);

  if (rows.length === 0) {
    console.log('No runs found.');
    return;
  }

  console.log(`\nHistory${jobName ? ` for ${jobName}` : ''} (${rows.length} runs):\n`);

  for (const row of rows) {
    const emoji = {
      success: '✅',
      failed: '❌',
      running: '🔄',
      timeout: '⏱',
      killed: '💀',
      skipped: '⏭'
    }[row.status] || '❓';

    const duration = row.duration_seconds ? `${row.duration_seconds}s` : '?';
    console.log(`${emoji} [${row.id}] ${row.job_name} — ${row.status} (${duration})`);
    console.log(`   ${row.started_at.substring(0, 19)}`);

    if (row.summary) {
      const summary = row.summary.substring(0, 100);
      console.log(`   Summary: ${summary}${row.summary.length > 100 ? '...' : ''}`);
    }

    if (row.error_message) {
      const error = row.error_message.substring(0, 100);
      console.log(`   Error: ${error}${row.error_message.length > 100 ? '...' : ''}`);
    }
    console.log();
  }
}

function showStatus(db) {
  const jobs = db.prepare(`
    SELECT job_name,
      COUNT(*) as total_runs,
      SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failures,
      MAX(started_at) as last_run
    FROM job_runs
    GROUP BY job_name
    ORDER BY last_run DESC
  `).all();

  if (jobs.length === 0) {
    console.log('No jobs found.');
    return;
  }

  console.log('\nJob Status Overview:\n');

  for (const job of jobs) {
    const rate = job.total_runs > 0 ? ((job.successes / job.total_runs) * 100).toFixed(0) : 0;
    const successEmoji = rate >= 90 ? '✅' : rate >= 70 ? '⚠️' : '❌';
    const lastRun = job.last_run ? job.last_run.substring(0, 19) : 'never';

    console.log(`${successEmoji} ${job.job_name}`);
    console.log(`   Success Rate: ${rate}% (${job.successes}/${job.total_runs} runs)`);
    console.log(`   Failures: ${job.failures} | Last Run: ${lastRun}`);
    console.log();
  }
}

function showFailures(db, hours) {
  const hoursNum = parseInt(hours) || 24;
  const rows = db.prepare(`
    SELECT * FROM job_runs
    WHERE status = 'failed' AND started_at >= datetime('now', '-${hoursNum} hours')
    ORDER BY started_at DESC
  `).all();

  if (rows.length === 0) {
    console.log(`✅ No failures in the last ${hoursNum} hour(s).`);
    return;
  }

  console.log(`\n❌ Failures in last ${hoursNum} hour(s): ${rows.length}\n`);

  for (const row of rows) {
    console.log(`${row.job_name} — ${row.started_at.substring(0, 19)}`);
    const duration = row.duration_seconds ? ` (${row.duration_seconds}s)` : '';
    console.log(`  Status: ${row.status}${duration}`);

    if (row.error_message) {
      const error = row.error_message.substring(0, 150);
      console.log(`  Error: ${error}${row.error_message.length > 150 ? '...' : ''}`);
    }
    console.log();
  }
}

function showRecent(db, limit) {
  const limitNum = parseInt(limit) || 20;
  const rows = db.prepare(`
    SELECT * FROM job_runs
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limitNum);

  if (rows.length === 0) {
    console.log('No runs found.');
    return;
  }

  console.log(`\nRecent Runs (${rows.length}):\n`);

  for (const row of rows) {
    const emoji = {
      success: '✅',
      failed: '❌',
      running: '🔄',
      timeout: '⏱',
      killed: '💀',
      skipped: '⏭'
    }[row.status] || '❓';

    const duration = row.duration_seconds ? `${row.duration_seconds}s` : '?';
    console.log(`${emoji} ${row.job_name} — ${row.status} (${duration}) — ${row.started_at.substring(0, 19)}`);
  }
  console.log();
}
