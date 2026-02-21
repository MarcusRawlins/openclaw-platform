# Mission Control Service Management

## Problem

Mission Control dev server (`bun run dev`) was not running persistently, causing API requests to fail and tasks to appear stuck in "queued" status even when agents successfully completed work.

## Solution

Mission Control now runs as a persistent launchd service that:
- Starts automatically on boot
- Restarts automatically if it crashes
- Keeps running in the background
- Logs output for debugging

## Service Details

**LaunchAgent:** `/Users/marcusrawlins/Library/LaunchAgents/com.mission-control.dev.plist`

**Working Directory:** `/Users/marcusrawlins/.openclaw/workspace/mission_control`

**Command:** `bun run dev`

**Logs:**
- stdout: `/Users/marcusrawlins/.openclaw/logs/mission-control-dev.out`
- stderr: `/Users/marcusrawlins/.openclaw/logs/mission-control-dev.err`

## Management Commands

### Check if service is running:
```bash
launchctl list | grep mission-control
```

### View recent logs:
```bash
tail -f ~/.openclaw/logs/mission-control-dev.out
tail -f ~/.openclaw/logs/mission-control-dev.err
```

### Restart service:
```bash
launchctl stop com.mission-control.dev
launchctl start com.mission-control.dev
```

### Reload after config changes:
```bash
launchctl unload ~/Library/LaunchAgents/com.mission-control.dev.plist
launchctl load ~/Library/LaunchAgents/com.mission-control.dev.plist
```

### Disable service:
```bash
launchctl unload ~/Library/LaunchAgents/com.mission-control.dev.plist
```

### Enable service:
```bash
launchctl load ~/Library/LaunchAgents/com.mission-control.dev.plist
```

## Health Check

Mission Control should be accessible at: **http://localhost:3100**

Test the API:
```bash
curl http://localhost:3100/api/tasks
```

If the server is running, you'll get JSON. If not, check the logs.

## Troubleshooting

### Service won't start
```bash
# Check the error log
cat ~/.openclaw/logs/mission-control-dev.err

# Try running manually to see errors
cd /Users/marcusrawlins/.openclaw/workspace/mission_control
bun run dev
```

### Port already in use
```bash
# Find what's using port 3100
lsof -i :3100

# Kill the process
kill -9 <PID>

# Restart the service
launchctl start com.mission-control.dev
```

### Service crashes repeatedly
```bash
# Check throttle interval (default: 10 seconds between restarts)
# Edit the plist file if needed

# Check for code errors in stderr log
cat ~/.openclaw/logs/mission-control-dev.err
```

## Development Workflow

**When making code changes:**
1. Code changes will hot-reload automatically (Next.js dev mode)
2. For config changes (next.config.ts, package.json), restart the service:
   ```bash
   launchctl stop com.mission-control.dev
   launchctl start com.mission-control.dev
   ```

**When switching to production:**
1. Build the production version:
   ```bash
   cd /Users/marcusrawlins/.openclaw/workspace/mission_control
   bun run build
   ```
2. Update launchd plist to run `bun start` instead of `bun run dev`
3. Reload the service

## API Persistence Verification

The task API correctly persists changes to `/Users/marcusrawlins/.openclaw/workspace/mission_control/data/tasks.json` when the server is running.

**Test persistence:**
```bash
# Update a task
curl -X PATCH http://localhost:3100/api/tasks/[task-id] \
  -H 'Content-Type: application/json' \
  -d '{"status":"active"}'

# Verify it persisted
cat ~/. openclaw/workspace/mission_control/data/tasks.json | grep [task-id]
```

## Notes

- The service runs under your user account (not system-wide)
- It will NOT start automatically if you're not logged in
- For true always-on operation, consider using a system-level LaunchDaemon instead
- Logs rotate automatically (managed by system)
