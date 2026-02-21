# Backup System SOP

## Overview

Automated nightly backup of `/Volumes/reeseai-memory` to `/Volumes/BACKUP/reeseai-backup/`.

## Schedule

**Time:** 2:00 AM daily (via launchd)

## Components

### 1. Backup Script
**Location:** `/Users/marcusrawlins/.openclaw/scripts/backup-reeseai-memory.sh`

**What it does:**
- Uses `rsync` for incremental backups (only copies changed files)
- Preserves file permissions, timestamps, and symlinks
- Deletes files from backup that no longer exist in source
- Verifies backup completed by checking key directories exist
- Logs all activity
- Alerts Marcus on failure

**Excluded from backup:**
- `.DS_Store` files
- `.tmp` files
- `.Trash` directories

### 2. LaunchAgent
**Location:** `/Users/marcusrawlins/Library/LaunchAgents/com.openclaw.backup-reeseai.plist`

**Configuration:**
- Runs daily at 2:00 AM
- Low priority (nice value 10) to not interfere with active work
- Logs stdout/stderr to `/Users/marcusrawlins/.openclaw/logs/`

## Logs

**Main log:** `/Users/marcusrawlins/.openclaw/logs/backup.log`  
Contains timestamped entries for each backup run with success/failure status.

**Error log:** `/Users/marcusrawlins/.openclaw/logs/backup-error.log`  
Contains detailed error messages when backups fail. Old error logs (>7 days) are automatically deleted.

**LaunchAgent logs:**
- stdout: `/Users/marcusrawlins/.openclaw/logs/backup-launchd.out`
- stderr: `/Users/marcusrawlins/.openclaw/logs/backup-launchd.err`

## Manual Operations

### Run backup manually:
```bash
/Users/marcusrawlins/.openclaw/scripts/backup-reeseai-memory.sh
```

### Check backup status:
```bash
tail -20 /Users/marcusrawlins/.openclaw/logs/backup.log
```

### Check last backup size:
```bash
du -sh /Volumes/BACKUP/reeseai-backup
```

### Verify backup contents:
```bash
ls -la /Volumes/BACKUP/reeseai-backup/
```

### Reload launchd job (after editing):
```bash
launchctl unload ~/Library/LaunchAgents/com.openclaw.backup-reeseai.plist
launchctl load ~/Library/LaunchAgents/com.openclaw.backup-reeseai.plist
```

### Check if launchd job is loaded:
```bash
launchctl list | grep com.openclaw.backup-reeseai
```

## Restore Process

If you need to restore from backup:

1. **Full restore:**
   ```bash
   rsync -avh --delete /Volumes/BACKUP/reeseai-backup/ /Volumes/reeseai-memory/
   ```

2. **Restore specific directory:**
   ```bash
   rsync -avh /Volumes/BACKUP/reeseai-backup/path/to/dir/ /Volumes/reeseai-memory/path/to/dir/
   ```

3. **Restore individual file:**
   ```bash
   cp /Volumes/BACKUP/reeseai-backup/path/to/file /Volumes/reeseai-memory/path/to/file
   ```

## Alerts

**On failure**, the script will:
1. Log detailed error to error log
2. Attempt to send alert to Marcus's main session via OpenClaw API
3. Exit with non-zero status

**Common failure scenarios:**
- BACKUP drive not mounted
- Source drive not available
- Insufficient disk space
- rsync errors (permissions, I/O errors)
- Verification failed (expected directories missing)

## Troubleshooting

### Backup not running
```bash
# Check if launchd job is loaded
launchctl list | grep backup-reeseai

# Check for errors in launchd logs
cat /Users/marcusrawlins/.openclaw/logs/backup-launchd.err

# Manually load the job
launchctl load ~/Library/LaunchAgents/com.openclaw.backup-reeseai.plist
```

### Backup running but failing
```bash
# Check error log
tail -50 /Users/marcusrawlins/.openclaw/logs/backup-error.log

# Run manually to see live output
/Users/marcusrawlins/.openclaw/scripts/backup-reeseai-memory.sh
```

### BACKUP drive not mounted
The BACKUP drive must be connected and mounted for backups to work. If it's an external drive, ensure it's plugged in and mounted before 2:00 AM.

### Insufficient space
```bash
# Check BACKUP drive space
df -h /Volumes/BACKUP

# Check source size
du -sh /Volumes/reeseai-memory
```

If BACKUP drive is full, either:
- Get a larger drive
- Clean up old data from source before backing up
- Manually delete old backup snapshots (if you maintain multiple copies)

## Maintenance

- Review backup logs monthly
- Verify restore capability quarterly (test restore of a sample directory)
- Monitor BACKUP drive health
- Ensure BACKUP drive has sufficient free space (recommend 2x source size)

## Security

- Backups are stored locally on a physical drive
- No encryption applied (backups are as secure as the drive itself)
- Keep BACKUP drive physically secure
- Consider off-site backup for critical data (manual copy to cloud/another location)
