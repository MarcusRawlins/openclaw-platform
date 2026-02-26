# Logging Infrastructure

Centralized logging infrastructure for the OpenClaw agent ecosystem. Every system, skill, and cron job writes structured events to a unified log pipeline.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Any System → logger.js/logger.sh                    │
│       ↓                                               │
│  Per-event JSONL + all.jsonl                         │
│       ↓ (nightly)                                     │
│  SQLite Database (logs.db)                           │
│       ↓ (daily)                                       │
│  Archive (gzipped, monthly)                          │
└──────────────────────────────────────────────────────┘
```

## Quick Start

### Node.js Integration

```javascript
const Logger = require('/workspace/skills/logging/logger');
const log = Logger.getInstance();

// Log events
log.info('lead.scored', { email_id: 42, score: 85, bucket: 'exceptional' });
log.warn('system.error', { message: 'Connection timeout', retries: 3 });
log.error('build.complete', { task: 'bi-council', error: 'Compilation failed' });

// With metadata
log.info('agent.subagent', {
  action: 'spawned',
  agent: 'brunel',
  task: 'Build logging system'
}, { agent: 'marcus', source: 'main-session' });
```

### Shell Script Integration

```bash
#!/usr/bin/env bash
source /workspace/skills/logging/logger.sh

log_info "briefing.run" "Starting daily briefing" "marcus"
# ... do work ...
log_info "briefing.run" "Briefing complete" "marcus"
```

## Features

- **Per-event files**: Each event type gets its own JSONL file
- **Unified stream**: All events mirrored to `all.jsonl`
- **Never throws**: Logging errors go to stderr, never crash your code
- **Auto-rotation**: Files over 50MB are archived and compressed
- **SQLite ingest**: Nightly import for indexed querying
- **Secret redaction**: Automatic PII/secret scrubbing before write
- **Rich viewer**: CLI with filters, tail mode, time ranges
- **Singleton**: One logger per process, shared across modules

## Components

| File | Purpose |
|---|---|
| `logger.js` | Core Node.js logging library |
| `logger.sh` | Shell helper for bash scripts |
| `redact.js` | Secret/PII redaction engine |
| `viewer.js` | CLI log viewer with filters |
| `ingest.js` | Nightly JSONL → SQLite ingest |
| `rotate.js` | Daily rotation and archival |
| `db.js` | SQLite schema and queries |
| `config.json` | Configuration |

## Log Viewer

```bash
# View recent logs
node viewer.js --last 1h

# Filter by event
node viewer.js --event lead.scored --last 24h

# Filter by level
node viewer.js --level error --last 7d

# Grep for content
node viewer.js --grep "timeout" --last 24h

# Tail live logs
node viewer.js --tail --event system.error

# Count events
node viewer.js --count --event agent.heartbeat --last 24h

# Query from database (for older data)
node viewer.js --db --event build.complete --last 30d
```

## Standard Events

| Event | When |
|---|---|
| `agent.chat` | Agent sends/receives a message |
| `agent.heartbeat` | Heartbeat poll fires |
| `agent.cron` | Cron job executes |
| `agent.subagent` | Sub-agent spawned or completed |
| `email.inbound` | New email fetched |
| `email.outbound` | Email sent or draft created |
| `lead.scored` | Lead scored by pipeline |
| `lead.stage_change` | Deal stage transition |
| `build.start` | Brunel starts a build |
| `build.complete` | Brunel completes a build |
| `review.start` | Walt starts a review |
| `review.complete` | Walt completes a review |
| `kb.query` | Knowledge base searched |
| `kb.ingest` | Knowledge base file ingested |
| `content.idea` | Content idea processed |
| `council.run` | BI Council nightly run |
| `briefing.run` | Daily briefing generated |
| `system.error` | Unhandled error caught |
| `system.startup` | Service/system starts |
| `usage.llm` | LLM call logged |
| `usage.api` | API call logged |
| `security.quarantine` | Email quarantined |
| `security.blocked` | Security event blocked |

Custom event names are allowed. Any new event automatically creates its JSONL file.

## Event Schema

Every log entry follows the same structure:

```json
{
  "ts": "2026-02-26T15:30:00.123Z",
  "event": "lead.scored",
  "level": "info",
  "agent": "marcus",
  "source": "email-pipeline/scorer.js",
  "data": {
    "email_id": 42,
    "from": "jane@example.com",
    "score": 85,
    "bucket": "exceptional"
  },
  "session": "agent:main:main",
  "duration_ms": 1200,
  "error": null
}
```

### Required Fields
- `ts` (string): ISO 8601 timestamp
- `event` (string): Dot-notation event name
- `level` (string): debug|info|warn|error|fatal

### Optional Fields
- `agent` (string): Which agent produced the event
- `source` (string): File/module that emitted
- `data` (object): Event-specific payload
- `session` (string): OpenClaw session key
- `duration_ms` (number): Operation duration
- `error` (string): Error message if applicable

## Maintenance

### Nightly Ingest
Runs at 3 AM daily via cron:
```bash
node /workspace/skills/logging/ingest.js
```

Parses JSONL files into SQLite for indexed querying. Tracks byte offsets to avoid re-reading, handles file rotation.

### Daily Rotation
Runs at 4 AM daily via cron:
```bash
node /workspace/skills/logging/rotate.js
```

Archives files over 50MB, compresses with gzip, keeps last 1000 lines in active file. Archives old DB rows beyond 90-day retention.

## Configuration

Edit `config.json` to customize:

```json
{
  "log_dir": "/Volumes/reeseai-memory/data/logs",
  "db_path": "/Volumes/reeseai-memory/data/logs/logs.db",
  "min_level": "info",
  "rotation": {
    "max_size_mb": 50,
    "keep_recent": 3,
    "db_retention_days": 90
  }
}
```

## Directory Structure

```
/Volumes/reeseai-memory/data/logs/
├── all.jsonl                      # Unified stream
├── agent.chat.jsonl               # Per-event files
├── agent.heartbeat.jsonl
├── lead.scored.jsonl
├── system.error.jsonl
├── ...
├── archive/                       # Rotated archives
│   ├── 2026-02/
│   │   ├── all.2026-02-25.jsonl.gz
│   │   └── ...
│   └── 2026-03/
└── logs.db                        # SQLite database
```

## Secret Redaction

Automatically redacts before writing:
- API keys and tokens (20+ chars after key-like prefix)
- Long hex/base64 strings
- Email addresses
- File paths with usernames
- Private IP addresses
- Dollar amounts
- Localhost ports
- Environment variable secrets

## Best Practices

1. **Use specific event names**: `lead.scored` not `event`
2. **Include agent context**: Pass `{ agent: 'marcus' }` as meta
3. **Log durations**: Track performance with `duration_ms`
4. **Don't log secrets**: Redaction is automatic, but avoid sensitive data
5. **Use appropriate levels**: info for normal, warn for issues, error for failures
6. **Keep data small**: Large payloads slow down queries

## Testing

Run the verification tests:

```bash
npm test
```

This validates:
- Logger writes to per-event and all.jsonl
- Redaction catches all patterns
- Viewer filters correctly
- Ingest populates database
- Rotation works as expected

## Integration Examples

See `SKILL.md` for detailed integration guides for:
- Email pipeline
- Build system (Brunel)
- Review system (Walt)
- BI Council
- Daily briefing
- Knowledge base
- Usage tracking

## Support

For issues or questions, check:
- This README
- `SKILL.md` for integration details
- Source code comments
- Spec: `/workspace/specs/logging-infrastructure.md`
