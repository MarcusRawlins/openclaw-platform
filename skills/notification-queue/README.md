# Notification Priority Queue

Three-tier notification system for routing agent messages through critical/high/medium priorities with automatic classification, batch digests, and shell wrapper.

## Quick Start

### Test Enqueue
```bash
node cli-enqueue.js "Task completed successfully" "" "brunel"
# Returns: { queued: true, tier: 'medium', id: 1 }
```

### Test Stats
```bash
node -e "const q = require('./queue'); console.log(q.stats());"
# Returns: { critical: 0, high: 0, medium: 1, ... }
```

### Test Flush
```bash
node flush.js all
# Returns: ✓ Flushed: 1 medium-priority message
```

## Shell Usage
```bash
./notify.sh "Critical error!" --tier=critical --source=brunel

./notify.sh "Task done" --topic=task-completion

./notify.sh "Urgent" --bypass  # Immediate delivery
```

## Integration

**In Node.js:**
```javascript
const queue = require('./queue');
await queue.enqueue('Message', { source: 'agent', topic: 'category' });
```

**In Scripts:**
```bash
notify "Message" --tier=high --source=brunel
```

## Documentation

See **SKILL.md** for full documentation, architecture, API reference, and examples.

## Files

- `queue.js` — SQLite queue manager
- `classifier.js` — Auto-classification with LLM fallback
- `rules.json` — Classification rules config
- `notify.sh` — Shell wrapper
- `cli-enqueue.js` — Node CLI
- `flush.js` — Batch flush script
- `SKILL.md` — Full documentation
- `README.md` — This file

## Database

Location: `/Volumes/reeseai-memory/data/notifications/notify-queue.db`

Auto-created on first use. Stores:
- **messages** — Queued/delivered messages
- **batch_log** — Flush history
- **classification_rules** — Dynamic rules (future)

## Status

✓ Production-ready  
✓ All components implemented  
✓ Ready for integration  
