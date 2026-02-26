# Notification Priority Queue Skill

**Status:** Production-Ready  
**Priority:** Critical (foundational)  
**Location:** `/workspace/skills/notification-queue/`

## Purpose

Route all outbound agent messages through a priority-based queue with three tiers: **critical** (immediate), **high** (batched hourly), **medium** (batched every 3 hours).

**Prevents notification spam. Ensures important messages get through. Batches routine updates into digests.**

## Architecture

```
Any Agent/Script
       ↓
   Enqueue Message
       ↓
┌──────────────────────────┐
│ CLASSIFIER               │
│ • Rules-based matching   │
│ • LLM fallback (ambig)   │
│ • Auto-tier assignment   │
└──────────────────────────┘
       ↓
┌──────────────────────────┐
│ QUEUE (SQLite)           │
│ • Store message + meta   │
│ • Track delivery status  │
│ • Index by tier/status   │
└──────────────────────────┘
       ↓ (by tier)
┌──────────────────────────┐
│ DELIVERY ENGINE          │
│ Critical → Immediate     │
│ High → Flush hourly      │
│ Medium → Flush 3-hourly  │
│ Digest format for batch  │
└──────────────────────────┘
       ↓
    Telegram / Other Channels
```

## Storage

**Database Location:** `/Volumes/reeseai-memory/data/notifications/notify-queue.db`

Auto-created on first use. Uses SQLite with WAL mode for durability.

### Tables

**messages** — Individual message entries
```
id (PRIMARY KEY)
tier (critical|high|medium)
source (agent name or 'shell')
channel (telegram, email, etc.)
topic (grouping key for digests, e.g., 'task-completion')
message (text content)
metadata (JSON extra context)
status (queued|delivered|failed|expired)
created_at (TIMESTAMP)
delivered_at (TIMESTAMP)
batch_id (for grouping delivered messages)
```

**batch_log** — History of batch flushes
```
id (PRIMARY KEY)
tier (which tier was flushed)
message_count (how many in batch)
delivered_at (when sent)
digest_text (full digest text sent)
```

**classification_rules** — Dynamic rule storage (future use)
```
id, pattern, source, tier, description, priority
```

## Components

### 1. Classifier (classifier.js)

**Auto-assigns tier based on message content.**

Rules matched in priority order (highest first). If no rule matches, LLM fallback (if enabled) or default to medium.

**Rules config:** `rules.json`
```json
{
  "rules": [
    {
      "tier": "critical",
      "priority": 100,
      "patterns": [
        "system error",
        "CRITICAL",
        "security alert",
        "interactive prompt",
        "requires.*input"
      ],
      "description": "System errors, security, user input needed"
    },
    {
      "tier": "high",
      "priority": 50,
      "patterns": [
        "task completed.*urgent",
        "review.*needs_revision",
        "sync failed",
        "council.*digest"
      ],
      "description": "Important completions, failures"
    },
    {
      "tier": "medium",
      "priority": 0,
      "patterns": [
        "task completed",
        "standing order",
        "content.*created"
      ],
      "description": "Routine completions"
    }
  ],
  "defaults": {
    "tier": "medium",
    "llm_fallback": true,
    "llm_model": "lmstudio/qwen2:4b"
  }
}
```

**Extend rules by editing `rules.json`** — no code changes needed.

### 2. Queue Manager (queue.js)

**Main API for enqueue/flush/stats operations.**

```javascript
const queue = require('./queue');

// Enqueue a message (auto-classify)
await queue.enqueue('Task completed', {
  source: 'brunel',
  channel: 'telegram',
  topic: 'task-completion'
});
// Returns: { queued: true, tier: 'medium', id: 42 }

// Enqueue with explicit tier
await queue.enqueue('CRITICAL: System failure', {
  tier: 'critical',
  source: 'system',
  bypass: true  // Send immediately
});
// Returns: { delivered: true, tier: 'critical' }

// Flush queued messages
await queue.flush('high');
// Returns: { flushed: 5, batchId: 1707123456789 }

// Get queue stats
queue.stats();
// Returns: { critical: 0, high: 2, medium: 8, total_queued: 10, total_delivered: 142 }

// Expire old messages (>24 hours)
queue.expireStale();
// Returns: number of expired messages

// Get batch history
queue.getBatchHistory(50);  // Last 50 batches

// Get messages from a specific batch
queue.getBatchMessages(batchId);
```

### 3. Shell Wrapper (notify.sh)

**Easy CLI for scripts/crons to enqueue messages.**

```bash
# Auto-classify based on message content
notify "Task completed successfully"

# Explicit tier
notify "CRITICAL: Build failed" --tier=critical

# With source and topic
notify "New content created" --source=ada --topic=content-creation

# Bypass queue (send immediately)
notify "User action required" --bypass

# Custom channel
notify "Message" --channel=email

# Full example
notify "Review needs revision" \
  --tier=high \
  --source=walt \
  --channel=telegram \
  --topic=review-results
```

### 4. CLI Enqueue (cli-enqueue.js)

**Node.js version of shell wrapper. Called by notify.sh, can be used standalone.**

```bash
node cli-enqueue.js "message" "tier" "source" "channel" "topic" "bypass"

# Minimal
node cli-enqueue.js "Task done"

# Full args
node cli-enqueue.js "Build failed" "critical" "brunel" "telegram" "builds" "false"
```

### 5. Flush Script (flush.js)

**Manually trigger batch flushes (also called by crons).**

```bash
# Flush high-priority messages
node flush.js high

# Flush medium-priority messages
node flush.js medium

# Flush both
node flush.js all

# Outputs:
# ✓ Flushed: 5 high-priority, 12 medium-priority messages
# ✓ Expired 2 stale messages (>24 hours old)
#
# Queue stats after flush:
#   Critical (queued): 0
#   High (queued): 0
#   Medium (queued): 0
#   Total queued: 0
#   Total delivered: 150
```

## Integration

### From Node.js

```javascript
const queue = require('/workspace/skills/notification-queue/queue');

// Enqueue during task completion
task.status = 'done';
await queue.enqueue(`Task "${task.title}" completed`, {
  source: 'brunel',
  topic: 'task-completion',
  metadata: { task_id: task.id }
});
```

### From Bash/Shell Scripts

```bash
#!/bin/bash
source /workspace/skills/notification-queue/notify.sh

# After critical operation
if [[ $? -ne 0 ]]; then
  notify "Build failed!" --tier=critical --source=ci
fi
```

### From Cron Jobs

```bash
# In cron config or launchd plist
0 * * * * node /workspace/skills/notification-queue/flush.js high
0 */3 * * * node /workspace/skills/notification-queue/flush.js medium
0 6 * * * node /workspace/skills/notification-queue/flush.js all
```

## Delivery Tiers

### Critical (Immediate)
- **Delivery:** Sent immediately, no queuing
- **Examples:** System errors, security alerts, interactive prompts requiring user input
- **TTL:** No expiry (stays in log forever)
- **Batch:** No (individual messages)

### High (Hourly Batch)
- **Delivery:** Queued, flushed once per hour
- **Examples:** Task failures, review results, BI council digests, important completions
- **TTL:** 24 hours (expired if not delivered)
- **Batch:** Yes (grouped by topic)

### Medium (3-Hourly Batch)
- **Delivery:** Queued, flushed every 3 hours
- **Examples:** Routine task completions, standing orders, content creation
- **TTL:** 24 hours
- **Batch:** Yes (grouped by topic)

## Classification Rules

Rules in `rules.json` are matched in **priority order** (highest priority first).

Each rule has:
- `tier` — assigned tier if pattern matches
- `patterns` — array of regex patterns to match against message
- `priority` — sort order (higher = checked first)
- `source` — optional: only match from this source (e.g., 'brunel')
- `description` — human-readable explanation

**To add a new rule:**
1. Open `rules.json`
2. Add rule object to `rules` array
3. Set appropriate `priority` (100=highest)
4. Test with: `node cli-enqueue.js "your test message"`

Example: Mark all messages from Walt as high priority
```json
{
  "tier": "high",
  "priority": 75,
  "source": "walt",
  "patterns": [".*"],
  "description": "All messages from Walt (reviews, audits)"
}
```

## Digest Format

Batched messages (high/medium) are formatted into digests:

```
🔔 **HIGH PRIORITY DIGEST** — task-completion (3 updates)

1. _brunel_: Task "Build Auth Module" completed successfully...
2. _walt_: Review complete: 2 approvals, 1 needs_revision...
3. _ada_: 5 social posts created for The Reeses photography...
```

The digest:
- Includes tier emoji (🔔 for high, 📋 for medium)
- Groups by topic (if not grouped, topic is "general")
- Truncates long messages (150 chars)
- Shows source agent (if not 'unknown')
- Numbered list format

## Testing

### 1. Test Auto-Classification

```bash
node cli-enqueue.js "CRITICAL: System failure" "" "system"
# Should classify as 'critical' and deliver immediately

node cli-enqueue.js "Task completed" "" "brunel"
# Should classify as 'medium' and queue

node cli-enqueue.js "Sync failed" "" "dewey"
# Should classify as 'high' and queue
```

### 2. Test Queue & Flush

```bash
# Enqueue several messages
node cli-enqueue.js "Test 1" "high" "brunel" "telegram" "test"
node cli-enqueue.js "Test 2" "high" "brunel" "telegram" "test"
node cli-enqueue.js "Test 3" "high" "brunel" "telegram" "test"

# Check stats
node -e "const q = require('./queue'); console.log(q.stats())"
# Should show: { high: 3, ... }

# Flush
node flush.js high
# Should output: ✓ Flushed: 3 high-priority messages

# Stats again
# Should show: { high: 0, ... }
```

### 3. Test Shell Wrapper

```bash
./notify.sh "Test notification" --tier=high --source=test

# Check database
node -e "const q = require('./queue'); console.log(q.stats())"
```

### 4. Test Bypass

```bash
node cli-enqueue.js "Urgent alert" "" "test" "telegram" "" "true"
# Should return: { delivered: true, tier: 'critical' }
# Should appear in logs immediately
```

## Cron Integration

Gateway cron configuration (in gateway-config.json):

```json
[
  {
    "name": "Notification Queue: Flush High Priority",
    "schedule": { "kind": "cron", "expr": "0 * * * *", "tz": "America/New_York" },
    "payload": {
      "kind": "systemEvent",
      "text": "Run: node /workspace/skills/notification-queue/flush.js high"
    },
    "sessionTarget": "main",
    "enabled": true
  },
  {
    "name": "Notification Queue: Flush Medium Priority",
    "schedule": { "kind": "cron", "expr": "0 */3 * * *", "tz": "America/New_York" },
    "payload": {
      "kind": "systemEvent",
      "text": "Run: node /workspace/skills/notification-queue/flush.js medium"
    },
    "sessionTarget": "main",
    "enabled": true
  },
  {
    "name": "Notification Queue: Expire Stale",
    "schedule": { "kind": "cron", "expr": "0 2 * * *", "tz": "America/New_York" },
    "payload": {
      "kind": "systemEvent",
      "text": "Run: node /workspace/skills/notification-queue/flush.js all"
    },
    "sessionTarget": "main",
    "enabled": true
  }
]
```

## Files

- **queue.js** — Main queue API (SQLite manager, delivery)
- **classifier.js** — Message classification (rules + LLM fallback)
- **rules.json** — Classification rules config (edit to customize)
- **notify.sh** — Shell wrapper script
- **cli-enqueue.js** — Node.js CLI tool
- **flush.js** — Manual flush script (also used by crons)
- **SKILL.md** — This file

## Database Management

### Reset Queue (Emergency)

```bash
rm /Volumes/reeseai-memory/data/notifications/notify-queue.db
node -e "const q = require('./queue'); console.log('Queue reset')"
```

### View Queue Contents

```bash
sqlite3 /Volumes/reeseai-memory/data/notifications/notify-queue.db
sqlite> SELECT * FROM messages WHERE status='queued';
sqlite> SELECT * FROM batch_log ORDER BY delivered_at DESC LIMIT 10;
```

### Manual Expiry Check

```bash
node -e "const q = require('./queue'); const expired = q.expireStale(); console.log('Expired:', expired);"
```

## Notes

- **LLM Fallback:** Calls local LLM (LM Studio at 127.0.0.1:1234) for ambiguous messages. If LLM unavailable, uses default tier.
- **Database Safety:** Uses WAL mode for durability, handles concurrent access safely.
- **No External APIs:** Everything runs locally (except eventual Telegram delivery).
- **Extensible:** Add new tiers, rules, or delivery channels by modifying config/code.

## Future Enhancements

- [ ] Email delivery channel
- [ ] Slack integration
- [ ] Discord integration
- [ ] Delivery status UI in Mission Control
- [ ] Do Not Disturb scheduling (quiet hours)
- [ ] Custom digest templates per topic
- [ ] Metric tracking (latency, delivery rate, etc.)

## Troubleshooting

**Q: Message not being delivered**
A: Check `queue.stats()` — is it queued? Check database `SELECT * FROM messages WHERE status='failed'`. If critical and supposed to bypass, check delivery logs.

**Q: LLM classification slow**
A: LM Studio might be overloaded. Check `curl http://127.0.0.1:1234/v1/health`. If slow, disable LLM fallback in `rules.json`.

**Q: Database locked**
A: WAL mode should prevent this. If persistent, close all connections and restart. Last resort: delete `.db-wal` and `.db-shm` files.

**Q: Batch not flushing**
A: Check cron job is running: `log show --predicate 'eventMessage contains[cd] "flush"' --last 1h`. Verify time matches cron schedule.
