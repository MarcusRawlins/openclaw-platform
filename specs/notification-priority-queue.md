# Notification Priority Queue

**Priority:** Critical (blocks all other systems)
**Estimated Time:** 2 days
**Dependencies:** None (foundational)

## Goal

Route all outbound agent messages through a priority queue with three tiers: critical (immediate), high (batched hourly), medium (batched every 3 hours). Prevents notification spam, ensures important messages get through, batches routine updates into digests.

## Architecture

```
Agent Output (any agent)
         ↓
┌─────────────────────────────────────┐
│     NOTIFICATION PRIORITY QUEUE      │
├─────────────────────────────────────┤
│                                      │
│  1. Classifier                       │
│     → Config rules (deterministic)   │
│     → LLM fallback (ambiguous)       │
│     → Default: medium                │
│                                      │
│  2. Queue (SQLite)                   │
│     → Store message + tier + meta    │
│     → Track delivery status          │
│                                      │
│  3. Delivery Engine                  │
│     → Critical: immediate bypass     │
│     → High: hourly flush             │
│     → Medium: 3-hour flush           │
│     → Digest formatter for batches   │
│                                      │
│  4. Shell Wrapper                    │
│     → `notify "message" --tier=high` │
│     → Easy use from any script       │
└─────────────────────────────────────┘
```

## Database Schema

**File:** `/Volumes/reeseai-memory/data/notifications/notify-queue.db`

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier TEXT NOT NULL CHECK(tier IN ('critical', 'high', 'medium')),
  source TEXT NOT NULL,           -- agent name or system component
  channel TEXT DEFAULT 'telegram', -- delivery channel
  topic TEXT,                      -- grouping key for digest (e.g., 'task-completion', 'review-result')
  message TEXT NOT NULL,
  metadata TEXT,                   -- JSON: extra context (task_id, agent, etc.)
  status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'delivered', 'failed', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  batch_id INTEGER                 -- groups messages delivered in same digest
);

CREATE TABLE batch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier TEXT NOT NULL,
  message_count INTEGER,
  delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  digest_text TEXT                 -- full digest that was sent
);

CREATE TABLE classification_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,           -- regex or keyword match
  source TEXT,                     -- optional: only match from this source
  tier TEXT NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0      -- higher = checked first
);

CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_tier ON messages(tier, status);
CREATE INDEX idx_messages_created ON messages(created_at);
```

## Classification Rules

**File:** `skills/notification-queue/rules.json`

```json
{
  "rules": [
    {
      "tier": "critical",
      "patterns": [
        "system error",
        "CRITICAL",
        "security alert",
        "build failed.*urgent",
        "interactive prompt",
        "requires.*input",
        "action required"
      ],
      "description": "System errors, security issues, user input needed"
    },
    {
      "tier": "high",
      "patterns": [
        "task completed.*urgent",
        "task completed.*high",
        "review.*needs_revision",
        "sync failed",
        "job failed",
        "council.*digest",
        "briefing.*ready"
      ],
      "description": "Important completions, failures, council/briefing output"
    },
    {
      "tier": "medium",
      "patterns": [
        "task completed",
        "maintenance.*complete",
        "standing order",
        "lead research",
        "content.*created",
        "routine.*update"
      ],
      "description": "Routine completions, standing orders, content creation"
    }
  ],
  "defaults": {
    "tier": "medium",
    "llm_fallback": true,
    "llm_model": "lmstudio/qwen3:4b"
  }
}
```

## Components

### 1. Classifier

**File:** `skills/notification-queue/classifier.js`

```javascript
const fs = require('fs');
const rules = require('./rules.json');

class NotificationClassifier {
  classify(message, source = 'unknown') {
    // Check rules in priority order (highest first)
    const sorted = rules.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const rule of sorted) {
      // Check source filter
      if (rule.source && rule.source !== source) continue;

      for (const pattern of rule.patterns) {
        if (new RegExp(pattern, 'i').test(message)) {
          return { tier: rule.tier, reason: rule.description, pattern };
        }
      }
    }

    // LLM fallback for ambiguous messages
    if (rules.defaults.llm_fallback) {
      return this.llmClassify(message, source);
    }

    return { tier: rules.defaults.tier, reason: 'default' };
  }

  async llmClassify(message, source) {
    // Call local LLM for classification
    const prompt = `Classify this notification into exactly one tier:
- critical: requires immediate human attention (errors, security, interactive prompts)
- high: important but can wait up to 1 hour (task failures, review results)
- medium: routine update, can wait 3 hours (completions, status updates)

Source: ${source}
Message: ${message}

Reply with ONLY the tier name: critical, high, or medium`;

    try {
      const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: rules.defaults.llm_model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 10
        })
      });

      const data = await response.json();
      const tier = data.choices[0].message.content.trim().toLowerCase();

      if (['critical', 'high', 'medium'].includes(tier)) {
        return { tier, reason: 'llm_classified' };
      }
    } catch (err) {
      // LLM unavailable, use default
    }

    return { tier: 'medium', reason: 'default_fallback' };
  }
}

module.exports = new NotificationClassifier();
```

### 2. Queue Manager

**File:** `skills/notification-queue/queue.js`

```javascript
const Database = require('better-sqlite3');
const classifier = require('./classifier');

const DB_PATH = '/Volumes/reeseai-memory/data/notifications/notify-queue.db';

class NotificationQueue {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  initSchema() {
    // Create tables from schema above
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tier TEXT NOT NULL CHECK(tier IN ('critical', 'high', 'medium')),
        source TEXT NOT NULL,
        channel TEXT DEFAULT 'telegram',
        topic TEXT,
        message TEXT NOT NULL,
        metadata TEXT,
        status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'delivered', 'failed', 'expired')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivered_at TIMESTAMP,
        batch_id INTEGER
      );

      CREATE TABLE IF NOT EXISTS batch_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tier TEXT NOT NULL,
        message_count INTEGER,
        delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        digest_text TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_messages_tier ON messages(tier, status);
    `);
  }

  // Enqueue a message (auto-classify if tier not provided)
  async enqueue(message, { source = 'unknown', channel = 'telegram', topic = null, tier = null, metadata = null, bypass = false } = {}) {
    // Bypass: send immediately, skip queue
    if (bypass) {
      await this.deliverImmediate(message, channel);
      return { delivered: true, tier: 'bypass' };
    }

    // Classify if tier not provided
    if (!tier) {
      const classification = await classifier.classify(message, source);
      tier = classification.tier;
    }

    // Critical messages: deliver immediately AND store in queue
    if (tier === 'critical') {
      await this.deliverImmediate(message, channel);
      this.db.prepare(`
        INSERT INTO messages (tier, source, channel, topic, message, metadata, status, delivered_at)
        VALUES (?, ?, ?, ?, ?, ?, 'delivered', datetime('now'))
      `).run(tier, source, channel, topic, message, metadata ? JSON.stringify(metadata) : null);
      return { delivered: true, tier: 'critical' };
    }

    // High/Medium: queue for batch delivery
    this.db.prepare(`
      INSERT INTO messages (tier, source, channel, topic, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tier, source, channel, topic, message, metadata ? JSON.stringify(metadata) : null);

    return { queued: true, tier };
  }

  // Flush queued messages for a tier
  async flush(tier) {
    const messages = this.db.prepare(`
      SELECT * FROM messages
      WHERE tier = ? AND status = 'queued'
      ORDER BY created_at ASC
    `).all(tier);

    if (messages.length === 0) return { flushed: 0 };

    // Group by channel and topic
    const groups = {};
    for (const msg of messages) {
      const key = `${msg.channel}:${msg.topic || 'general'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(msg);
    }

    // Format and deliver digests
    const batchId = Date.now();
    for (const [key, msgs] of Object.entries(groups)) {
      const [channel, topic] = key.split(':');
      const digest = this.formatDigest(msgs, tier, topic);
      await this.deliverImmediate(digest, channel);

      // Mark as delivered
      const ids = msgs.map(m => m.id);
      this.db.prepare(`
        UPDATE messages
        SET status = 'delivered', delivered_at = datetime('now'), batch_id = ?
        WHERE id IN (${ids.join(',')})
      `).run(batchId);
    }

    // Log batch
    this.db.prepare(`
      INSERT INTO batch_log (tier, message_count)
      VALUES (?, ?)
    `).run(tier, messages.length);

    return { flushed: messages.length, batchId };
  }

  formatDigest(messages, tier, topic) {
    const tierEmoji = { high: '🔔', medium: '📋' }[tier] || '📬';
    const count = messages.length;
    const header = `${tierEmoji} **${tier.toUpperCase()} Priority Digest** (${count} update${count > 1 ? 's' : ''})`;

    const body = messages.map((msg, i) => {
      const source = msg.source !== 'unknown' ? `_${msg.source}_: ` : '';
      return `${i + 1}. ${source}${msg.message.substring(0, 200)}${msg.message.length > 200 ? '...' : ''}`;
    }).join('\n\n');

    return `${header}\n\n${body}`;
  }

  async deliverImmediate(message, channel) {
    // Send via OpenClaw message tool
    // This is the actual delivery mechanism
    const fetch = require('node-fetch');
    await fetch('http://localhost:18789/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', channel, message })
    });
  }

  // Get queue stats
  stats() {
    return {
      critical: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE tier='critical' AND status='queued'").get().count,
      high: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE tier='high' AND status='queued'").get().count,
      medium: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE tier='medium' AND status='queued'").get().count,
      total_delivered: this.db.prepare("SELECT COUNT(*) as count FROM messages WHERE status='delivered'").get().count
    };
  }

  // Expire old queued messages (>24 hours)
  expireStale() {
    const expired = this.db.prepare(`
      UPDATE messages
      SET status = 'expired'
      WHERE status = 'queued' AND created_at < datetime('now', '-24 hours')
    `).run();
    return expired.changes;
  }
}

module.exports = new NotificationQueue();
```

### 3. Shell Wrapper

**File:** `skills/notification-queue/notify.sh`

```bash
#!/bin/bash
# Usage: notify "message" [--tier=critical|high|medium] [--source=agent-name] [--bypass]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MESSAGE="$1"
TIER=""
SOURCE="shell"
BYPASS="false"
CHANNEL="telegram"
TOPIC=""

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
```

**File:** `skills/notification-queue/cli-enqueue.js`

```javascript
const queue = require('./queue');

const [message, tier, source, channel, topic, bypass] = process.argv.slice(2);

(async () => {
  const result = await queue.enqueue(message, {
    tier: tier || null,
    source: source || 'shell',
    channel: channel || 'telegram',
    topic: topic || null,
    bypass: bypass === 'true'
  });
  console.log(JSON.stringify(result));
})();
```

### 4. Flush Cron Jobs

**OpenClaw gateway cron configuration:**

```json
[
  {
    "name": "Notification Queue: Flush High Priority (hourly)",
    "schedule": { "kind": "cron", "expr": "0 * * * *", "tz": "America/New_York" },
    "payload": {
      "kind": "systemEvent",
      "text": "Run: node /workspace/skills/notification-queue/flush.js high"
    },
    "sessionTarget": "main",
    "enabled": true
  },
  {
    "name": "Notification Queue: Flush Medium Priority (3h)",
    "schedule": { "kind": "cron", "expr": "0 */3 * * *", "tz": "America/New_York" },
    "payload": {
      "kind": "systemEvent",
      "text": "Run: node /workspace/skills/notification-queue/flush.js medium"
    },
    "sessionTarget": "main",
    "enabled": true
  }
]
```

**File:** `skills/notification-queue/flush.js`

```javascript
const queue = require('./queue');
const tier = process.argv[2];

if (!tier || !['high', 'medium', 'all'].includes(tier)) {
  console.error('Usage: node flush.js <high|medium|all>');
  process.exit(1);
}

(async () => {
  if (tier === 'all') {
    const high = await queue.flush('high');
    const medium = await queue.flush('medium');
    console.log(`Flushed: ${high.flushed} high, ${medium.flushed} medium`);
  } else {
    const result = await queue.flush(tier);
    console.log(`Flushed ${result.flushed} ${tier} messages`);
  }

  // Also expire stale messages
  const expired = queue.expireStale();
  if (expired > 0) console.log(`Expired ${expired} stale messages`);
})();
```

## Integration Points

**All agent output routes through queue:**
- Task completions → classified and queued
- Review results → classified and queued
- System alerts → critical tier (immediate)
- Council/briefing digests → high tier
- Routine maintenance → medium tier

**Other systems use this:**
- BI Council: posts digest through queue (high priority)
- Daily Briefing: posts through queue (high priority)
- Cron system: failure alerts through queue (critical)
- Financial system: confidential data flagged before queuing

## Deliverables

- [ ] SQLite queue database
- [ ] Classifier with rules config + LLM fallback
- [ ] Queue manager (enqueue, flush, stats, expire)
- [ ] Shell wrapper (`notify.sh`)
- [ ] CLI enqueue tool
- [ ] Flush script with cron integration
- [ ] Digest formatter (groups by topic)
- [ ] Cron job configs for hourly/3h flush
- [ ] Documentation in SKILL.md
- [ ] Git commit: "feat: notification priority queue"

## Testing

1. Enqueue critical message → delivered immediately
2. Enqueue 5 high messages → wait 1 hour → digest delivered
3. Enqueue 10 medium messages → wait 3 hours → digest delivered
4. Shell wrapper: `notify "test" --tier=high --source=brunel`
5. Bypass: `notify "urgent" --bypass` → immediate delivery
6. Stats: check queue counts
7. Expire: verify 24h+ messages get expired
