# Cron Automation & Reliability System

Production-ready cron job wrapper with SQLite logging, lockfiles, timeouts, idempotency checks, failure detection, and health checks.

## Quick Start

### Wrap Your Cron Job

```bash
# Before:
0 * * * * node /path/to/script.js

# After:
0 * * * * /workspace/skills/cron-automation/run.sh myjob "node /path/to/script.js" --timeout=300
```

### Test It

```bash
./run.sh test-job "echo hello"
# [test-job] Run 1 started (PID 12345)
# [test-job] Completed in 0s
```

### View Status

```bash
node cron-query.js status
node cron-query.js history
node cron-query.js failures
```

## Features

✅ SQLite audit log for all job runs  
✅ PID lockfiles prevent concurrent execution  
✅ Signal handlers for graceful shutdown  
✅ Optional timeouts with auto-kill  
✅ Idempotency checks (daily/hourly)  
✅ Persistent failure alerts (3+ in 6h)  
✅ Automatic stale job cleanup  
✅ Health checks every 30 min  
✅ Query CLI for history/status  
✅ Notification queue integration  

## Files

- `run.sh` — Main wrapper (calls from cron)
- `log-start.js`, `log-end.js` — Log execution
- `should-run.js` — Check idempotency
- `check-failures.js` — Count recent failures
- `cleanup-stale.js` — Auto-cleanup dead processes
- `health-check.js` — System diagnostics (run every 30 min)
- `cron-query.js` — Query CLI
- `SKILL.md` — Full documentation

## Database

Location: `/Volumes/reeseai-memory/data/cron/cron-log.db`

Tables: `job_runs`, `job_config`, `alerts`

Auto-created on first use.

## Usage Examples

```bash
# Simple
./run.sh my-task "node script.js"

# With timeout (seconds)
./run.sh my-task "node script.js" --timeout=600

# With idempotency (daily)
./run.sh daily-task "node script.js" --idempotency=daily

# Full options
./run.sh my-task "node script.js" --timeout=300 --idempotency=hourly
```

## Status

✓ Production-ready  
✓ All components implemented  
✓ Fully tested  
✓ Ready for integration  
