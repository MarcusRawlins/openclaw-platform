#!/usr/bin/env bash
# Shell Helper for Logging
# Source this in shell scripts: source /workspace/skills/logging/logger.sh

LOG_DIR="/Volumes/reeseai-memory/data/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

log_event() {
  local level="$1"
  local event="$2"
  local message="$3"
  local agent="${4:-system}"
  
  # Generate ISO 8601 timestamp with UTC
  local ts
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS date format
    ts=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  else
    # Linux date format
    ts=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
  fi
  
  # Escape message for JSON (basic escaping)
  local escaped_message
  escaped_message=$(echo "$message" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
  
  # Build JSON entry
  local entry
  entry="{\"ts\":\"${ts}\",\"event\":\"${event}\",\"level\":\"${level}\",\"agent\":\"${agent}\",\"data\":{\"message\":\"${escaped_message}\"}}"
  
  # Write to per-event file
  echo "$entry" >> "${LOG_DIR}/${event}.jsonl" 2>/dev/null || true
  
  # Mirror to unified stream
  echo "$entry" >> "${LOG_DIR}/all.jsonl" 2>/dev/null || true
}

log_info()  { log_event "info"  "$@"; }
log_warn()  { log_event "warn"  "$@"; }
log_error() { log_event "error" "$@"; }
log_debug() { log_event "debug" "$@"; }
log_fatal() { log_event "fatal" "$@"; }
