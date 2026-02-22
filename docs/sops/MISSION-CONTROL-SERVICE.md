# Mission Control LaunchD Service

## Overview

Mission Control is a Next.js dashboard that runs on port 3100, managed by macOS LaunchD for 24/7 uptime with automatic crash recovery.

## Service Configuration

**Location:** `~/Library/LaunchAgents/com.reese.missioncontrol.plist`

**Key Settings:**
- **Label:** `com.reese.missioncontrol`
- **Port:** 3100
- **Working Directory:** `/Users/marcusrawlins/.openclaw/workspace/mission_control`
- **Command:** `/Users/marcusrawlins/.bun/bin/bun run start` (production mode)
- **Logs:** `/Users/marcusrawlins/.openclaw/logs/mission-control-*.log`

**Automatic Restart:**
- `RunAtLoad: true` — Starts on boot
- `KeepAlive.Crashed: true` — Restarts on crashes
- `KeepAlive.SuccessfulExit: false` — Stays down on clean exit
- `ThrottleInterval: 10` — Waits 10s between restart attempts

## Service Management

### Check Status
```bash
launchctl list | grep mission
```
Output format: `PID  ExitCode  Label`
- PID > 0: Running
- `-`: Not loaded
- Negative ExitCode: Last signal received (e.g., `-9` = SIGKILL)

### Load Service
```bash
launchctl load ~/Library/LaunchAgents/com.reese.missioncontrol.plist
```

### Unload Service
```bash
launchctl unload ~/Library/LaunchAgents/com.reese.missioncontrol.plist
```

### Restart Service
```bash
launchctl unload ~/Library/LaunchAgents/com.reese.missioncontrol.plist
launchctl load ~/Library/LaunchAgents/com.reese.missioncontrol.plist
```

### View Logs
```bash
# Stdout (application logs)
tail -f ~/.openclaw/logs/mission-control-stdout.log

# Stderr (errors)
tail -f ~/.openclaw/logs/mission-control-stderr.log
```

### Find Running Process
```bash
ps aux | grep "next-server" | grep -v grep
```

## Troubleshooting

### Port Already in Use (EADDRINUSE)
If you see "address already in use" errors:

1. Find what's using port 3100:
```bash
ps aux | grep "next\|bun" | grep 3100
```

2. Kill the conflicting process:
```bash
kill <PID>
```

3. Service will auto-restart cleanly

### Service Won't Start
Check logs for errors:
```bash
tail -50 ~/.openclaw/logs/mission-control-stderr.log
```

Common issues:
- Missing dependencies: `cd mission_control && bun install`
- Bad build: `cd mission_control && bun run build`
- Permission issues: Check file ownership in workspace

### Manual Start (Development)
If you need to run manually for debugging:
```bash
cd mission_control
bun run dev  # Development mode with hot reload
```

**Important:** Stop the LaunchD service first to avoid port conflicts!

## Testing Crash Recovery

Verified working:
```bash
# Get current PID
ps aux | grep "next-server" | grep -v grep | awk '{print $2}'

# Kill it
kill -9 <PID>

# Wait 12 seconds (ThrottleInterval + startup time)
sleep 12

# Verify it restarted
ps aux | grep "next-server" | grep -v grep
```

Expected behavior: New process with different PID, service accessible on port 3100.

## Configuration Details

Full plist contents:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.reese.missioncontrol</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Users/marcusrawlins/.bun/bin/bun</string>
        <string>run</string>
        <string>start</string>
    </array>
    
    <key>WorkingDirectory</key>
    <string>/Users/marcusrawlins/.openclaw/workspace/mission_control</string>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/Users/marcusrawlins/.openclaw/logs/mission-control-stdout.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/marcusrawlins/.openclaw/logs/mission-control-stderr.log</string>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/Users/marcusrawlins/.bun/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
```

## Deployment Checklist

- [x] Remove all duplicate service files
- [x] Create single service file: `com.reese.missioncontrol.plist`
- [x] Configure with production settings (`bun run start`)
- [x] Set correct PATH including bun location
- [x] Configure logging to `.openclaw/logs/`
- [x] Enable crash recovery (KeepAlive.Crashed)
- [x] Test crash recovery (kill -9, verify restart)
- [x] Verify service accessible on port 3100
- [x] Document in SOP

## Maintenance

**After code changes:**
1. Commit changes to git
2. Restart service: `launchctl unload ... && launchctl load ...`
3. Verify in logs that it started correctly

**After system reboot:**
Service starts automatically. No action needed.

**Log rotation:**
Logs append indefinitely. Consider adding log rotation if they grow large:
```bash
# Archive old logs
cd ~/.openclaw/logs
mv mission-control-stdout.log mission-control-stdout-$(date +%Y%m%d).log
mv mission-control-stderr.log mission-control-stderr-$(date +%Y%m%d).log

# Service will create new files automatically
```

---

**Last Updated:** 2025-02-21  
**Status:** ✅ Production-ready, crash recovery tested and verified
