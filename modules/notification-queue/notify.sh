#!/bin/bash
# Notification Priority Queue Shell Wrapper
# Usage: notify "message" [--tier=critical|high|medium] [--source=agent-name] [--channel=telegram] [--topic=topic-name] [--bypass]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MESSAGE="$1"
TIER=""
SOURCE="shell"
BYPASS="false"
CHANNEL="telegram"
TOPIC=""

if [[ -z "$MESSAGE" ]]; then
  echo "Usage: $0 \"message\" [options]"
  echo "Options:"
  echo "  --tier=TIER         Notification tier: critical, high, or medium (auto-classified if not set)"
  echo "  --source=SOURCE     Source agent/system name (default: shell)"
  echo "  --channel=CHANNEL   Delivery channel (default: telegram)"
  echo "  --topic=TOPIC       Topic for digest grouping"
  echo "  --bypass            Deliver immediately, bypass queue"
  exit 1
fi

shift
while [[ $# -gt 0 ]]; do
  case $1 in
    --tier=*) TIER="${1#*=}" ;;
    --source=*) SOURCE="${1#*=}" ;;
    --channel=*) CHANNEL="${1#*=}" ;;
    --topic=*) TOPIC="${1#*=}" ;;
    --bypass) BYPASS="true" ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

node "$SCRIPT_DIR/cli-enqueue.js" "$MESSAGE" "$TIER" "$SOURCE" "$CHANNEL" "$TOPIC" "$BYPASS"
