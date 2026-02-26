# Cron Automation & Reliability System

**Priority:** Critical (enables all scheduled work)
**Estimated Time:** 2-3 days
**Dependencies:** Notification Priority Queue (for failure alerts)

## Goal

Build a central cron logging database, wrapper script with lockfiles/signal traps/timeouts, and reliability features (persistent failure detection, health checks, duplicate prevention, stale cleanup). Makes all scheduled work auditable, reliable, and self-healing.

## Architecture

```
OpenClaw Gateway Cron
         ↓
┌─────────────────────────────────────┐
│       CRON WRAPPER (run.sh)          │
├─────────────────────────────────────┤
│  1. Preflight checks                │
│     → PID lockfile (prevent dupes)  │
│     → Stale job cleanup             │
│     → should-run idempotency check  │
│                                      │
│  2. Signal traps                    │
│     → SIGTERM: graceful shutdown    │
│     → SIGINT: graceful shutdown     │
│     → SIGHUP: reload config         │
│                                      │
│  3. Execution                       │
│     → log-start (record run ID)     │
│     → Run actual command            │
│     → Optional timeout              │
│     → log-end (status + duration)   │
│                                      │
│  4. Post-run                        │
│     → Check failure history         │
│     → Alert if 3+ failures in 6h   │
│     → Remove lockfile               │
│     → Notify via priority queue     │
└─────────────────────────────────────┘
```

## Database Schema

**File:** `/Volumes/reeseai-memory/data/cron/cron-log.db`

```sql
CREATE TABLE job_runs (
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

CREATE TABLE job_config (
  job_name TEXT PRIMARY KEY,
  max_runtime_seconds INTEGER DEFAULT 7200,
  idempotency TEXT DEFAULT 'none' CHECK(idempotency IN ('none', 'daily', 'hourly')),
  alert_on_failure BOOLEAN DEFAULT 1,
  failure_threshold INTEGER DEFAULT 3,
  failure_window_hours INTEGER DEFAULT 6,
  enabled BOOLEAN DEFAULT 1
);

CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged BOOLEAN DEFAULT 0
);

CREATE INDEX idx_runs_job ON job_runs(job_name);
CREATE INDEX idx_runs_status ON job_runs(status);
CREATE INDEX idx_runs_started ON job_runs(started_at);
CREATE INDEX idx_alerts_job ON alerts(job_name);
```

## Cron Wrapper Script

**File:** `skills/cron-automation/run.sh`

```bash
#!/bin/bash
# Cron Wrapper — Reliable job execution with logging, lockfiles, and alerts
#
# Usage: run.sh <job-name> <command> [--timeout=300] [--idempotency=daily]
#
# Examples:
#   run.sh dewey-maintenance "node /path/to/script.js"
#   run.sh nightly-council "node /path/to/council.js" --timeout=600
#   run.sh hourly-sync "node /path/to/sync.js" --idempotency=hourly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="/Volumes/reeseai-memory/data/cron/cron-log.db"
LOCK_DIR="/Volumes/reeseai-memory/data/cron/locks"
NOTIFY="${SCRIPT_DIR}/../notification-queue/notify.sh"

JOB_NAME="$1"
COMMAND="$2"
shift 2

TIMEOUT=0
IDEMPOTENCY="none"

while [[ $# -gt 0 ]]; do
  case $1 in
    --timeout=*) TIMEOUT="${1#*=}" ;;
    --idempotency=*) IDEMPOTENCY="${1#*=}" ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

LOCK_FILE="${LOCK_DIR}/${JOB_NAME}.lock"
mkdir -p "$LOCK_DIR"

# --- PREFLIGHT ---

# 1. Cleanup stale jobs (stuck >2h in "running")
node "$SCRIPT_DIR/cleanup-stale.js"

# 2. Check PID lockfile (prevent concurrent runs)
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Job $JOB_NAME already running (PID $OLD_PID). Skipping."
    node "$SCRIPT_DIR/log-skip.js" "$JOB_NAME" "concurrent_run"
    exit 0
  else
    echo "Stale lockfile (PID $OLD_PID dead). Removing."
    rm -f "$LOCK_FILE"
  fi
fi

# 3. Idempotency check (already succeeded today/this hour?)
if [ "$IDEMPOTENCY" != "none" ]; then
  SHOULD_RUN=$(node "$SCRIPT_DIR/should-run.js" "$JOB_NAME" "$IDEMPOTENCY")
  if [ "$SHOULD_RUN" = "false" ]; then
    echo "Job $JOB_NAME already succeeded this ${IDEMPOTENCY}. Skipping."
    exit 0
  fi
fi

# --- SIGNAL TRAPS ---
cleanup() {
  rm -f "$LOCK_FILE"
  if [ -n "${RUN_ID:-}" ]; then
    node "$SCRIPT_DIR/log-end.js" "$RUN_ID" "killed" "" "Signal received"
  fi
  exit 1
}
trap cleanup SIGTERM SIGINT SIGHUP

# --- EXECUTION ---

# Create lockfile
echo $$ > "$LOCK_FILE"

# Log start
RUN_ID=$(node "$SCRIPT_DIR/log-start.js" "$JOB_NAME" "$$")
echo "[$JOB_NAME] Run $RUN_ID started (PID $$)"

# Execute command with optional timeout
START_TIME=$(date +%s)
EXIT_CODE=0
OUTPUT=""

if [ "$TIMEOUT" -gt 0 ]; then
  OUTPUT=$(timeout "$TIMEOUT" bash -c "$COMMAND" 2>&1) || EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    node "$SCRIPT_DIR/log-end.js" "$RUN_ID" "timeout" "" "Exceeded ${TIMEOUT}s timeout"
    "$NOTIFY" "⏱ Job **${JOB_NAME}** timed out after ${TIMEOUT}s" --tier=high --source=cron
    rm -f "$LOCK_FILE"
    exit 1
  fi
else
  OUTPUT=$(bash -c "$COMMAND" 2>&1) || EXIT_CODE=$?
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# --- POST-RUN ---

if [ $EXIT_CODE -eq 0 ]; then
  # Success
  SUMMARY=$(echo "$OUTPUT" | tail -5)
  node "$SCRIPT_DIR/log-end.js" "$RUN_ID" "success" "$SUMMARY" ""
  echo "[$JOB_NAME] Completed in ${DURATION}s"
else
  # Failure
  ERROR=$(echo "$OUTPUT" | tail -10)
  node "$SCRIPT_DIR/log-end.js" "$RUN_ID" "failed" "" "$ERROR"
  echo "[$JOB_NAME] FAILED (exit code $EXIT_CODE) after ${DURATION}s"

  # Check persistent failure (3+ in 6h)
  FAILURE_COUNT=$(node "$SCRIPT_DIR/check-failures.js" "$JOB_NAME")
  if [ "$FAILURE_COUNT" -ge 3 ]; then
    "$NOTIFY" "🚨 Job **${JOB_NAME}** has failed ${FAILURE_COUNT} times in 6 hours. Last error: ${ERROR:0:200}" --tier=critical --source=cron
  else
    "$NOTIFY" "❌ Job **${JOB_NAME}** failed (attempt ${FAILURE_COUNT}/3). Error: ${ERROR:0:200}" --tier=high --source=cron
  fi
fi

# Remove lockfile
rm -f "$LOCK_FILE"
```

## Node.js Helper Scripts

### log-start.js
```javascript
const Database = require('better-sqlite3');
const DB_PATH = '/Volumes/reeseai-memory/data/cron/cron-log.db';

const [jobName, pid] = process.argv.slice(2);
const db = new Database(DB_PATH);

const result = db.prepare(`
  INSERT INTO job_runs (job_name, status, pid)
  VALUES (?, 'running', ?)
`).run(jobName, parseInt(pid));

console.log(result.lastInsertRowid);
```

### log-end.js
```javascript
const Database = require('better-sqlite3');
const DB_PATH = '/Volumes/reeseai-memory/data/cron/cron-log.db';

const [runId, status, summary, errorMessage] = process.argv.slice(2);
const db = new Database(DB_PATH);

db.prepare(`
  UPDATE job_runs
  SET status = ?, completed_at = datetime('now'),
      duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER),
      summary = ?, error_message = ?
  WHERE id = ?
`).run(status, summary || null, errorMessage || null, parseInt(runId));
```

### should-run.js
```javascript
const Database = require('better-sqlite3');
const DB_PATH = '/Volumes/reeseai-memory/data/cron/cron-log.db';

const [jobName, idempotency] = process.argv.slice(2);
const db = new Database(DB_PATH);

const window = idempotency === 'daily' ? '-1 day' : '-1 hour';
const existing = db.prepare(`
  SELECT COUNT(*) as count
  FROM job_runs
  WHERE job_name = ? AND status = 'success' AND started_at >= datetime('now', ?)
`).get(jobName, window);

console.log(existing.count > 0 ? 'false' : 'true');
```

### cleanup-stale.js
```javascript
const Database = require('better-sqlite3');
const DB_PATH = '/Volumes/reeseai-memory/data/cron/cron-log.db';
const fs = require('fs');

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
  try { process.kill(job.pid, 0); alive = true; } catch (e) {}

  if (!alive) {
    db.prepare(`
      UPDATE job_runs
      SET status = 'failed', completed_at = datetime('now'), error_message = 'Stale: PID dead after 2+ hours'
      WHERE id = ?
    `).run(job.id);

    // Remove lockfile if exists
    const lockFile = `/Volumes/reeseai-memory/data/cron/locks/${job.job_name}.lock`;
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);

    console.log(`Cleaned stale job: ${job.job_name} (run ${job.id})`);
  }
}
```

### check-failures.js
```javascript
const Database = require('better-sqlite3');
const DB_PATH = '/Volumes/reeseai-memory/data/cron/cron-log.db';

const [jobName] = process.argv.slice(2);
const db = new Database(DB_PATH);

const config = db.prepare('SELECT * FROM job_config WHERE job_name = ?').get(jobName);
const windowHours = config?.failure_window_hours || 6;

const failures = db.prepare(`
  SELECT COUNT(*) as count
  FROM job_runs
  WHERE job_name = ? AND status = 'failed' AND started_at >= datetime('now', '-${windowHours} hours')
`).get(jobName);

console.log(failures.count);
```

## Query CLI

**File:** `skills/cron-automation/cron-query.js`

```javascript
#!/usr/bin/env node
const Database = require('better-sqlite3');
const DB_PATH = '/Volumes/reeseai-memory/data/cron/cron-log.db';
const db = new Database(DB_PATH);

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'history':
    showHistory(args[0], args[1] || 10);
    break;
  case 'status':
    showStatus();
    break;
  case 'failures':
    showFailures(args[0] || 24);
    break;
  default:
    console.log(`Usage:
  cron-query history [job-name] [limit]  — Show run history
  cron-query status                       — Show all job statuses
  cron-query failures [hours]             — Show failures in window`);
}

function showHistory(jobName, limit) {
  const sql = jobName
    ? 'SELECT * FROM job_runs WHERE job_name = ? ORDER BY started_at DESC LIMIT ?'
    : 'SELECT * FROM job_runs ORDER BY started_at DESC LIMIT ?';
  const rows = jobName ? db.prepare(sql).all(jobName, parseInt(limit)) : db.prepare(sql).all(parseInt(limit));

  for (const row of rows) {
    const emoji = { success: '✅', failed: '❌', running: '🔄', timeout: '⏱', killed: '💀', skipped: '⏭' }[row.status] || '❓';
    console.log(`${emoji} [${row.id}] ${row.job_name} — ${row.status} (${row.duration_seconds || '?'}s) — ${row.started_at}`);
    if (row.error_message) console.log(`   Error: ${row.error_message.substring(0, 100)}`);
  }
}

function showStatus() {
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

  console.log('\nJob Status Overview:\n');
  for (const job of jobs) {
    const rate = ((job.successes / job.total_runs) * 100).toFixed(0);
    console.log(`${job.job_name}: ${rate}% success (${job.successes}/${job.total_runs}) — Last: ${job.last_run}`);
  }
}

function showFailures(hours) {
  const rows = db.prepare(`
    SELECT * FROM job_runs
    WHERE status = 'failed' AND started_at >= datetime('now', '-${hours} hours')
    ORDER BY started_at DESC
  `).all();

  console.log(`\nFailures in last ${hours} hours: ${rows.length}\n`);
  for (const row of rows) {
    console.log(`❌ ${row.job_name} — ${row.started_at}`);
    if (row.error_message) console.log(`   ${row.error_message.substring(0, 150)}`);
  }
}
```

## Health Check

**File:** `skills/cron-automation/health-check.js`

Runs every 30 minutes via cron:

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');

const DB_PATH = '/Volumes/reeseai-memory/data/cron/cron-log.db';
const LOCK_DIR = '/Volumes/reeseai-memory/data/cron/locks';

const db = new Database(DB_PATH);

async function healthCheck() {
  const issues = [];

  // 1. Check for stale running jobs
  const stale = db.prepare(`
    SELECT job_name, started_at, pid
    FROM job_runs
    WHERE status = 'running' AND started_at < datetime('now', '-2 hours')
  `).all();

  if (stale.length > 0) {
    issues.push(`${stale.length} stale running job(s): ${stale.map(j => j.job_name).join(', ')}`);
    // Auto-cleanup
    require('./cleanup-stale');
  }

  // 2. Check for orphaned lockfiles
  if (fs.existsSync(LOCK_DIR)) {
    const lockfiles = fs.readdirSync(LOCK_DIR);
    for (const file of lockfiles) {
      const pid = parseInt(fs.readFileSync(`${LOCK_DIR}/${file}`, 'utf-8'));
      try { process.kill(pid, 0); } catch (e) {
        issues.push(`Orphaned lockfile: ${file} (PID ${pid} dead)`);
        fs.unlinkSync(`${LOCK_DIR}/${file}`);
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

  // 4. Report
  if (issues.length > 0) {
    const notify = require('../notification-queue/queue');
    await notify.enqueue(
      `🏥 Cron Health Check: ${issues.length} issue(s)\n\n${issues.map(i => `• ${i}`).join('\n')}`,
      { source: 'cron-health', tier: 'high', topic: 'system-health' }
    );
  }

  return { healthy: issues.length === 0, issues };
}

if (require.main === module) {
  healthCheck().then(result => {
    console.log(result.healthy ? '✅ All healthy' : `⚠️ ${result.issues.length} issues found`);
  });
}

module.exports = { healthCheck };
```

## Deliverables

- [ ] SQLite cron log database with schema
- [ ] Cron wrapper script (`run.sh`) with signal traps, lockfiles, timeouts
- [ ] log-start / log-end / should-run / cleanup-stale helpers
- [ ] Failure detection (3+ in 6h window → critical alert)
- [ ] Health check script (runs every 30 min)
- [ ] Query CLI (history, status, failures)
- [ ] Integration with notification queue
- [ ] PID-based lockfiles with stale detection
- [ ] Idempotency checks (daily/hourly)
- [ ] Documentation in SKILL.md
- [ ] Git commit: "feat: cron automation and reliability system"

## Integration

All existing cron jobs updated to use wrapper:
```
Before: node /path/to/script.js
After:  /workspace/skills/cron-automation/run.sh job-name "node /path/to/script.js" --timeout=300
```
