# Notification Routing

## Current Setup

**Status:** ✅ Working  
**Last Verified:** 2026-02-27  
**Primary Channel:** Telegram

## Overview

Marcus routes all notifications through Telegram using the `message` tool. This provides:
- Centralized notification delivery
- Topic-based organization
- Rich media support (screenshots, files)
- Two-way communication
- Mobile alerts

## Telegram Configuration

### Group Chat
- **ID:** `-1003782464464`
- **Name:** Marcus AI Operations

### Topics (Threads)
| Topic | Thread ID | Use Case |
|-------|-----------|----------|
| General | 2 | General updates, misc |
| Devotd | 9 | Devotd project updates |
| Photography | 43 | Bythereeses photography business |
| R3 Studios | 44 | R3 Studios / Rehive project |
| Ops & Alerts | 46 | System alerts, cron results, errors |

### Direct Messages
- **Tyler's Chat ID:** `8172900205`
- Use for: Private/sensitive notifications, personal reminders

## Notification Patterns

### System Alerts (Ops & Alerts topic)
```javascript
message action=send 
  channel=telegram 
  target=-1003782464464 
  threadId=46 
  message="🚨 System Alert: [description]"
```

### Task Completion
```javascript
message action=send 
  channel=telegram 
  target=-1003782464464 
  threadId=46 
  message="✅ Task completed: [task name]\n\n[details]"
```

### Error Notifications
```javascript
message action=send 
  channel=telegram 
  target=-1003782464464 
  threadId=46 
  message="❌ Error in [process]: [error details]"
```

### With Screenshot/Media
```javascript
// Take screenshot first
browser action=screenshot profile=openclaw

// Then send with media
message action=send 
  channel=telegram 
  target=-1003782464464 
  threadId=46 
  message="📸 Screenshot: [context]"
  media=/path/to/screenshot.png
```

### Private Notification (Tyler DM)
```javascript
message action=send 
  channel=telegram 
  target=8172900205 
  message="Private note: [content]"
```

## Cron Integration

Cron jobs can send results directly to Telegram:

```bash
# Example: Daily memory synthesis notification
# Cron sends result to Ops & Alerts
{
  "schedule": "0 23 * * *",
  "command": "synthesize-memory.sh",
  "notify": {
    "channel": "telegram",
    "target": "-1003782464464",
    "threadId": "46"
  }
}
```

## Notification Best Practices

1. **Use appropriate topic:** Don't spam General with system alerts
2. **Include emoji indicators:** 🚨 alert, ✅ success, ❌ error, 📸 screenshot, 📊 report
3. **Keep messages concise:** First line = summary, details below
4. **Use silent mode for routine:** `silent=true` for scheduled reports
5. **Attach context:** Screenshots, logs, relevant files
6. **Thread related messages:** Reply to previous notifications for context

## Message Tool Parameters

### Common Options
- `target`: Chat ID or username
- `threadId`: Topic thread ID (for group topics)
- `message`: Text content
- `media`: File path or URL
- `silent`: Suppress notification sound
- `replyTo`: Reply to specific message
- `caption`: Media caption (when using media)

### Example: Complete Notification
```javascript
message action=send 
  channel=telegram 
  target=-1003782464464 
  threadId=46 
  message="✅ Browser automation completed\n\nTask: Account signup\nResult: Success\nTime: 3.2s"
  media=/path/to/confirmation.png
  silent=false
```

## Delivery Priority

1. **Immediate:** Errors, security alerts → Ops & Alerts topic
2. **Standard:** Task completions, status updates → Relevant topic
3. **Scheduled:** Reports, summaries → with `silent=true`
4. **Private:** Sensitive info, personal items → Tyler DM

## Alternative Channels (Not Currently Used)

These are available but not actively used:
- Email (configured, but Telegram is faster)
- Voice notes (TTS tool available)
- System notifications (macOS, but not visible on mobile)

**Rationale for Telegram:** Mobile-first, organized topics, two-way communication, media support

## Related Configuration

- Telegram credentials: `~/.openclaw/.env`
- Message tool docs: OpenClaw message tool reference
- Cron notification setup: `/workspace/docs/sops/CRON-MANAGEMENT.md`

## Monitoring

Check notification delivery:
```bash
# View recent messages in topic
message action=list channel=telegram target=-1003782464464 threadId=46 limit=10

# Test notification
message action=send channel=telegram target=-1003782464464 threadId=46 message="🧪 Test notification" silent=true
```

---

**Created:** 2026-02-27  
**Author:** Marcus Rawlins  
**Status:** Active production configuration
