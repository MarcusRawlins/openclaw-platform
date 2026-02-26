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
node "$SCRIPT_DIR/cleanup-stale.js" 2>/dev/null || true

# 2. Check PID lockfile (prevent concurrent runs)
if [ -f "$LOCK_FILE" ]; then
  OLD_PID=$(cat "$LOCK_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Job $JOB_NAME already running (PID $OLD_PID). Skipping."
    node "$SCRIPT_DIR/log-skip.js" "$JOB_NAME" "concurrent_run" 2>/dev/null || true
    exit 0
  else
    echo "Stale lockfile (PID $OLD_PID dead). Removing."
    rm -f "$LOCK_FILE"
  fi
fi

# 3. Idempotency check (already succeeded today/this hour?)
if [ "$IDEMPOTENCY" != "none" ]; then
  SHOULD_RUN=$(node "$SCRIPT_DIR/should-run.js" "$JOB_NAME" "$IDEMPOTENCY" 2>/dev/null || echo "true")
  if [ "$SHOULD_RUN" = "false" ]; then
    echo "Job $JOB_NAME already succeeded this ${IDEMPOTENCY}. Skipping."
    node "$SCRIPT_DIR/log-skip.js" "$JOB_NAME" "idempotency_skip" 2>/dev/null || true
    exit 0
  fi
fi

# --- SIGNAL TRAPS ---
cleanup() {
  rm -f "$LOCK_FILE"
  if [ -n "${RUN_ID:-}" ]; then
    node "$SCRIPT_DIR/log-end.js" "$RUN_ID" "killed" "" "Signal received" 2>/dev/null || true
  fi
  exit 1
}
trap cleanup SIGTERM SIGINT SIGHUP

# --- EXECUTION ---

# Create lockfile
echo $$ > "$LOCK_FILE"

# Log start
RUN_ID=$(node "$SCRIPT_DIR/log-start.js" "$JOB_NAME" "$$" 2>/dev/null || echo "0")
echo "[$JOB_NAME] Run $RUN_ID started (PID $$)"

# Execute command with optional timeout
START_TIME=$(date +%s)
EXIT_CODE=0
OUTPUT=""

if [ "$TIMEOUT" -gt 0 ]; then
  OUTPUT=$(timeout "$TIMEOUT" bash -c "$COMMAND" 2>&1) || EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    node "$SCRIPT_DIR/log-end.js" "$RUN_ID" "timeout" "" "Exceeded ${TIMEOUT}s timeout" 2>/dev/null || true
    if [ -x "$NOTIFY" ]; then
      "$NOTIFY" "⏱ Job **${JOB_NAME}** timed out after ${TIMEOUT}s" --tier=high --source=cron 2>/dev/null || true
    fi
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
  node "$SCRIPT_DIR/log-end.js" "$RUN_ID" "success" "$SUMMARY" "" 2>/dev/null || true
  echo "[$JOB_NAME] Completed in ${DURATION}s"
else
  # Failure
  ERROR=$(echo "$OUTPUT" | tail -10)
  node "$SCRIPT_DIR/log-end.js" "$RUN_ID" "failed" "" "$ERROR" 2>/dev/null || true
  echo "[$JOB_NAME] FAILED (exit code $EXIT_CODE) after ${DURATION}s"

  # Check persistent failure (3+ in 6h)
  if [ -x "$NOTIFY" ]; then
    FAILURE_COUNT=$(node "$SCRIPT_DIR/check-failures.js" "$JOB_NAME" 2>/dev/null || echo "1")
    if [ "$FAILURE_COUNT" -ge 3 ]; then
      "$NOTIFY" "🚨 Job **${JOB_NAME}** has failed ${FAILURE_COUNT} times in 6 hours. Last error: ${ERROR:0:200}" --tier=critical --source=cron 2>/dev/null || true
    else
      "$NOTIFY" "❌ Job **${JOB_NAME}** failed (attempt ${FAILURE_COUNT}/3). Error: ${ERROR:0:200}" --tier=high --source=cron 2>/dev/null || true
    fi
  fi
fi

# Remove lockfile
rm -f "$LOCK_FILE"
