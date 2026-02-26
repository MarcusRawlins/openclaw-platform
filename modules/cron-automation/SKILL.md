# Cron Automation & Reliability Skill

**Status:** Production-Ready  
**Priority:** Critical (enables all scheduled work)  
**Location:** `/workspace/skills/cron-automation/`

## Purpose

Wrap all cron jobs with a central logging database, signal handlers, lockfiles, timeouts, and health checks. Makes scheduled work auditable, reliable, and self-healing.

**Features:**
- SQLite audit log for all cron runs
- PID lockfiles prevent concurrent execution
- Signal traps (SIGTERM, SIGINT, SIGHUP) for graceful shutdown
- Optional timeouts with automatic kill
- Idempotency checks (daily/hourly repeat prevention)
- Persistent failure detection (3+ failures in 6h window)
- Automatic stale job cleanup
- Health check with self-healing
- Query CLI for job history and status
- Integration with notification queue for alerts

## Architecture

```
Gateway Cron Job
       ↓
   run.sh wrapper
       ↓
┌──────────────────────────┐
│ 1. Preflight              │
│  • Check lockfile         │
│  • Cleanup stale jobs     │
│  • Check idempotency      │
└──────────────────────────┘
       ↓
┌──────────────────────────┐
│ 2. Signal Handlers       │
│  • SIGTERM/SIGINT/SIGHUP │
│  • Graceful shutdown     │
│  • Cleanup lockfile      │
└──────────────────────────┘
       ↓
┌──────────────────────────┐
│ 3. Execution             │
│  • Log start (run ID)    │
│  • Run command           │
│  • Optional timeout      │
│  • Log end (status+time) │
└──────────────────────────┘
       ↓
┌──────────────────────────┐
│ 4. Post-Run              │
│  • Check failure history │
│  • Alert if persistent   │
│  • Remove lockfile       │
│  • Notify via queue      │
└──────────────────────────┘
```

## Database

**Location:** `/Volumes/reeseai-memory/data/cron/cron-log.db`

Auto-created on first use.

### Tables

**job_runs** — Individual job executions
```
id (PRIMARY KEY)
job_name (TEXT) — e.g., 'nightly-council', 'hourly-sync'
status (running|success|failed|timeout|killed|skipped)
started_at (TIMESTAMP)
completed_at (TIMESTAMP)
duration_seconds (INTEGER)
summary (TEXT) — last 5 lines of output on success
error_message (TEXT) — last 10 lines on failure
pid (INTEGER) — process ID
exit_code (INTEGER) — exit code if failed
```

**job_config** — Configuration per job (optional)
```
job_name (PRIMARY KEY)
max_runtime_seconds (default: 7200)
idempotency (none|daily|hourly)
alert_on_failure (boolean)
failure_threshold (default: 3)
failure_window_hours (default: 6)
enabled (boolean)
```

**alerts** — Alert history
```
id (PRIMARY KEY)
job_name
alert_type
message
created_at (TIMESTAMP)
acknowledged (boolean)
```

## Usage

### Basic Usage

```bash
# Simple job, auto-timed
/workspace/skills/cron-automation/run.sh my-job "node /path/to/script.js"

# With timeout (seconds)
./run.sh nightly-council "node /path/to/council.js" --timeout=600

# With idempotency (prevent daily/hourly repeats)
./run.sh daily-briefing "node /path/to/briefing.js" --idempotency=daily

# Hourly sync (don't repeat more than once per hour)
./run.sh hourly-sync "node /path/to/sync.js" --idempotency=hourly --timeout=300

# Multiple options
./run.sh backup \
  "cd /data && tar czf backup.tar.gz ." \
  --timeout=1800 \
  --idempotency=daily
```

### Integration with Gateway Cron

In `gateway-config.json`:

```json
[
  {
    "name": "Notification Queue: Flush High Priority",
    "schedule": { "kind": "cron", "expr": "0 * * * *", "tz": "America/New_York" },
    "payload": {
      "kind": "exec",
      "text": "/workspace/skills/cron-automation/run.sh notify-flush-high 'node /workspace/skills/notification-queue/flush.js high' --timeout=60"
    },
    "enabled": true
  },
  {
    "name": "Daily Briefing",
    "schedule": { "kind": "cron", "expr": "0 7 * * *", "tz": "America/New_York" },
    "payload": {
      "kind": "exec",
      "text": "/workspace/skills/cron-automation/run.sh daily-briefing 'node /workspace/skills/daily-briefing/generate.js' --timeout=300 --idempotency=daily"
    },
    "enabled": true
  },
  {
    "name": "Cron Health Check",
    "schedule": { "kind": "cron", "expr": "*/30 * * * *", "tz": "America/New_York" },
    "payload": {
      "kind": "exec",
      "text": "node /workspace/skills/cron-automation/health-check.js"
    },
    "enabled": true
  }
]
```

## Helper Scripts

### log-start.js
Logs job start. Returns run ID.
```bash
node log-start.js "job-name" $$
# Output: 42 (run ID)
```

### log-end.js
Logs job completion.
```bash
node log-end.js 42 success "summary text" ""
node log-end.js 42 failed "" "error message"
```

### should-run.js
Checks idempotency — returns 'true' or 'false'.
```bash
node should-run.js "daily-job" daily
# true if last success was >24h ago, false if recent
```

### check-failures.js
Counts recent failures for a job.
```bash
node check-failures.js "problematic-job"
# Output: 3 (if failed 3 times in last 6h)
```

### cleanup-stale.js
Auto-cleanup for jobs stuck in "running" state >2h.
```bash
node cleanup-stale.js
# Marks stale runs as failed, removes lockfiles
```

### health-check.js
Runs full system health check. Can be run manually or via cron (every 30 min).
```bash
node health-check.js
# Returns: ✅ All healthy (or lists issues)

# If issues found, sends notification via queue
```

## Query CLI

```bash
# View recent runs
node cron-query.js recent 20

# View job history
node cron-query.js history
node cron-query.js history my-job 10

# View all job statuses
node cron-query.js status

# View recent failures
node cron-query.js failures
node cron-query.js failures 6  # Last 6 hours
```

### Example Output

```bash
$ node cron-query.js status
Job Status Overview:

✅ nightly-council
   Success Rate: 98% (48/49 runs)
   Failures: 1 | Last Run: 2026-02-26 02:15:30

⚠️ hourly-sync
   Success Rate: 92% (22/24 runs)
   Failures: 2 | Last Run: 2026-02-26 14:30:15

❌ backup
   Success Rate: 50% (2/4 runs)
   Failures: 2 | Last Run: 2026-02-26 13:45:00
```

## Features

### 1. PID Lockfiles

Prevents concurrent job execution.

- Job creates lockfile at `/Volumes/reeseai-memory/data/cron/locks/{job-name}.lock`
- Contains process ID
- Before starting: checks if PID is alive
- If dead: removes stale lockfile
- If alive: skips job execution (already running)

### 2. Signal Handlers

Graceful shutdown on SIGTERM, SIGINT, SIGHUP.

```bash
# When signal received:
# 1. Remove lockfile
# 2. Mark run as 'killed' in database
# 3. Log error message
# 4. Exit cleanly
```

### 3. Timeouts

Optional max runtime. Auto-kills if exceeded.

```bash
./run.sh my-job "long-command" --timeout=300
# If command runs >300s, timeout kills it
# Status marked as 'timeout', notification sent
```

### 4. Idempotency

Prevent repeated execution in same window.

- `--idempotency=daily` — Only run once per day (UTC)
- `--idempotency=hourly` — Only run once per hour
- `--idempotency=none` (default) — Always run

Query before execution:
```bash
node should-run.js "daily-job" daily
# Returns 'false' if already succeeded in last 24h
# Returns 'true' if >24h since last success
```

### 5. Failure Detection

Automatic alerts for persistent failures.

- Counts failures in 6-hour window (default, configurable)
- If 3+ failures in window: sends **critical** alert
- If <3: sends **high** priority alert
- Integration with notification queue

### 6. Stale Job Cleanup

Auto-detects and cleans dead processes.

```bash
# Runs at job startup (cleanup-stale.js)
# Finds jobs stuck in "running" >2 hours
# Checks if PID still alive
# If dead:
#   - Mark run as 'failed'
#   - Remove lockfile
#   - Log cleanup
```

### 7. Health Checks

Full system diagnostics. Run every 30 minutes.

```bash
node health-check.js

# Checks:
# 1. Stale running jobs (>2h)
# 2. Orphaned lockfiles
# 3. Persistent failures (3+ in 6h)
# 4. Sends summary notification if issues found
```

## Testing

### Test 1: Basic Execution

```bash
./run.sh test-job "echo 'Hello World'"

# Expected output:
# [test-job] Run 1 started (PID 12345)
# [test-job] Completed in 1s
```

### Test 2: Failure Detection

```bash
# Create a failing job
./run.sh test-fail "exit 1"

# Expected:
# [test-fail] FAILED (exit code 1) after 0s
# (Notification sent via queue)

# Check status
node cron-query.js history test-fail
```

### Test 3: Timeout

```bash
./run.sh test-timeout "sleep 60" --timeout=5

# Expected:
# [test-timeout] FAILED (exit code 1) after 5s
# Status: timeout
# (Notification: ⏱ Job test-timeout timed out...)
```

### Test 4: Idempotency (Daily)

```bash
# First run (should execute)
./run.sh test-daily "echo 'Day 1'" --idempotency=daily
# Output: [test-daily] Completed in 0s

# Immediate second run (should skip)
./run.sh test-daily "echo 'Day 1'" --idempotency=daily
# Output: Job test-daily already succeeded this daily. Skipping.

# Check query
node cron-query.js history test-daily
# Should show: 1 run (success) + 1 skipped
```

### Test 5: Lockfile Behavior

```bash
# Start job that takes time
./run.sh test-lock "sleep 10" &
FIRST_PID=$!

# Immediately try to run same job (should skip)
./run.sh test-lock "sleep 10"
# Output: Job test-lock already running (PID $FIRST_PID). Skipping.

wait $FIRST_PID
```

### Test 6: Signal Handlers

```bash
# Start long-running job
./run.sh test-signal "sleep 100" &
JOB_PID=$!

# Send SIGTERM
sleep 2
kill $JOB_PID

# Check database
node cron-query.js history test-signal
# Status should be: killed, with error message "Signal received"
```

### Test 7: Health Check

```bash
node health-check.js
# Should output: ✅ All healthy (or list issues)
```

## Database Queries

### Last 10 runs of any job
```sql
SELECT * FROM job_runs ORDER BY started_at DESC LIMIT 10;
```

### Success rate by job (last 30 days)
```sql
SELECT job_name,
  COUNT(*) as total,
  SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successes,
  ROUND(100.0 * SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate
FROM job_runs
WHERE started_at >= datetime('now', '-30 days')
GROUP BY job_name
ORDER BY success_rate DESC;
```

### Recent failures
```sql
SELECT * FROM job_runs
WHERE status = 'failed' AND started_at >= datetime('now', '-24 hours')
ORDER BY started_at DESC;
```

### Average duration by job
```sql
SELECT job_name,
  COUNT(*) as runs,
  ROUND(AVG(duration_seconds), 1) as avg_seconds,
  MAX(duration_seconds) as max_seconds,
  MIN(duration_seconds) as min_seconds
FROM job_runs
WHERE status = 'success'
GROUP BY job_name;
```

## File Locations

- **Wrapper script:** `/workspace/skills/cron-automation/run.sh`
- **Database:** `/Volumes/reeseai-memory/data/cron/cron-log.db`
- **Lockfiles:** `/Volumes/reeseai-memory/data/cron/locks/`
- **Helper scripts:** `log-start.js`, `log-end.js`, `should-run.js`, `check-failures.js`, etc.
- **Query CLI:** `cron-query.js`
- **Health check:** `health-check.js`

## Notes

- **Backwards Compatible:** Existing cron jobs work unchanged, just wrap with `run.sh`
- **No External Dependencies:** Uses built-in bash, Node.js, and better-sqlite3 (already installed)
- **Self-Healing:** Automatic stale cleanup, orphaned lockfile removal
- **Auditable:** Every run logged with start/end time, duration, status, output summary, error details
- **Alerting:** Integrates with notification queue for smart alerts
- **Query-Friendly:** SQLite database allows SQL queries for custom reporting

## Troubleshooting

**Q: Job shows "already running" but it's not**  
A: Stale lockfile. Run `node cleanup-stale.js` to clean, or manually delete `/Volumes/reeseai-memory/data/cron/locks/{job-name}.lock`

**Q: Timeouts not working**  
A: Use absolute timeout value: `--timeout=600` (seconds). Ensure timeout command exists (macOS/Linux).

**Q: Notifications not being sent**  
A: Check notification queue is running. Make sure `notify.sh` path exists and is executable.

**Q: Database locked errors**  
A: Close other connections to DB. Last resort: `rm /Volumes/reeseai-memory/data/cron/cron-log.db*` (loses history).

**Q: How to see all job IDs?**  
A: `node cron-query.js status` shows overview, `cron-query.js recent 100` shows last 100 runs.

## Future Enhancements

- [ ] Job dependency chains (run A only after B succeeds)
- [ ] Retry logic with exponential backoff
- [ ] Job metrics dashboard in Mission Control
- [ ] Custom alert thresholds per job
- [ ] Slack/email notifications
- [ ] Automatic job disabling on persistent failures
