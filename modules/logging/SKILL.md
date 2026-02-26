# Logging Infrastructure - Integration Guide

## Overview

The logging skill provides centralized structured logging for the entire OpenClaw ecosystem. Every agent, skill, and cron job should use this for observability, debugging, and analytics.

## When to Use

Use logging for:
- **Event tracking**: User actions, agent decisions, system events
- **Error monitoring**: Catch and log all errors with context
- **Performance**: Track operation durations
- **Audit trail**: Record state changes, API calls, decisions
- **Debugging**: Add debug-level logs for troubleshooting

## Quick Start

### Node.js

```javascript
const Logger = require('/workspace/skills/logging/logger');
const log = Logger.getInstance();

// Basic logging
log.info('event.name', { key: 'value' });

// With metadata
log.info('event.name', { data: 'payload' }, { agent: 'marcus', source: 'my-script.js' });

// Error logging
try {
  riskyOperation();
} catch (err) {
  log.error('system.error', { 
    message: err.message, 
    stack: err.stack,
    operation: 'riskyOperation'
  });
}
```

### Shell Scripts

```bash
#!/usr/bin/env bash
source /workspace/skills/logging/logger.sh

log_info "script.start" "Starting my script" "system"
# ... do work ...
log_info "script.complete" "Script finished successfully" "system"
```

## Integration Examples

### Email Pipeline

```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

// Log inbound email
log.info('email.inbound', {
  account: 'photography',
  from: email.from,
  subject: email.subject,
  size_bytes: email.size
}, { agent: 'scout', source: 'email-pipeline/fetch.js' });

// Log lead scoring
log.info('lead.scored', {
  email_id: id,
  from: email.from,
  score: 85,
  bucket: 'exceptional',
  signals: ['pricing_question', 'local_business', 'urgent']
}, { agent: 'scout', source: 'email-pipeline/scorer.js' });

// Log stage change
log.info('lead.stage_change', {
  email_id: id,
  from_stage: 'New',
  to_stage: 'Contacted',
  reason: 'manual_reply_sent'
}, { agent: 'marcus', source: 'email-pipeline/stage-manager.js' });

// Log quarantine
log.warn('security.quarantine', {
  email_id: id,
  reason: 'spam_score_high',
  from: email.from
}, { agent: 'scout', source: 'email-pipeline/security.js' });
```

### Build System (Brunel)

```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

// Log build start
log.info('build.start', {
  task: 'logging-infrastructure',
  spec_path: '/workspace/specs/logging-infrastructure.md',
  estimated_duration: '2-3 days'
}, { agent: 'brunel', source: 'build-task.js' });

// Log progress
log.info('build.progress', {
  task: 'logging-infrastructure',
  step: 'core-logger',
  status: 'complete',
  files_created: 3
}, { agent: 'brunel' });

// Log completion
log.info('build.complete', {
  task: 'logging-infrastructure',
  duration_ms: 450000,
  files_created: 11,
  status: 'success'
}, { agent: 'brunel' });

// Log build error
log.error('build.complete', {
  task: 'logging-infrastructure',
  error: 'Syntax error in logger.js',
  step: 'testing',
  duration_ms: 120000
}, { agent: 'brunel' });
```

### Review System (Walt)

```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

// Log review start
log.info('review.start', {
  artifact_path: '/workspace/skills/logging',
  artifact_type: 'skill',
  reviewer: 'walt'
}, { agent: 'walt', source: 'review-system.js' });

// Log review complete
log.info('review.complete', {
  artifact_path: '/workspace/skills/logging',
  rating: 9.5,
  issues_found: 2,
  duration_ms: 180000
}, { agent: 'walt' });
```

### Agent Lifecycle

```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

// Log agent startup
log.info('system.startup', {
  agent: 'marcus',
  session: 'agent:main:main',
  model: 'anthropic/claude-sonnet-4-5',
  channel: 'telegram'
}, { agent: 'marcus', source: 'session-init' });

// Log heartbeat
log.debug('agent.heartbeat', {
  checks_performed: ['email', 'calendar'],
  issues_found: 0
}, { agent: 'marcus' });

// Log subagent spawn
log.info('agent.subagent', {
  action: 'spawned',
  subagent: 'brunel',
  task: 'Build logging infrastructure',
  parent_session: 'agent:main:main'
}, { agent: 'marcus' });

// Log subagent completion
log.info('agent.subagent', {
  action: 'completed',
  subagent: 'brunel',
  duration_ms: 450000,
  status: 'success'
}, { agent: 'marcus' });
```

### Knowledge Base

```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

// Log query
log.info('kb.query', {
  query: 'wedding pricing strategies',
  results_count: 12,
  duration_ms: 450,
  top_result: 'pricing-guide.md'
}, { agent: 'dewey', source: 'kb-search.js' });

// Log ingest
log.info('kb.ingest', {
  file_path: '/path/to/document.pdf',
  pages: 24,
  chunks_created: 156,
  duration_ms: 8000
}, { agent: 'dewey', source: 'kb-ingest.js' });
```

### BI Council

```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

// Log council run
log.info('council.run', {
  session_id: 5,
  experts: ['Marcus', 'Claude', 'Emma', 'Jake', 'Sarah', 'Dr. Chen'],
  topics: ['Q1 revenue', 'marketing strategy', 'hiring'],
  recommendations: 3,
  duration_ms: 45000
}, { agent: 'marcus', source: 'bi-council/session.js' });
```

### Daily Briefing

```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

// Log briefing generation
log.info('briefing.run', {
  sections: ['calendar', 'email', 'tasks', 'news'],
  events_today: 2,
  unread_emails: 15,
  delivered_to: 'telegram',
  duration_ms: 12000
}, { agent: 'marcus', source: 'briefing/generate.js' });
```

### Usage Tracking

```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

// Log LLM usage
log.info('usage.llm', {
  agent: 'marcus',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5',
  input_tokens: 12000,
  output_tokens: 3000,
  cost_usd: 0.45,
  cached_tokens: 8000
}, { source: 'usage-tracker' });

// Log API usage
log.info('usage.api', {
  service: 'tavily',
  endpoint: '/search',
  queries: 5,
  cost_usd: 0.05
}, { source: 'usage-tracker' });
```

### Cron Jobs

```bash
#!/usr/bin/env bash
source /workspace/skills/logging/logger.sh

log_info "agent.cron" "Starting nightly ingest" "system"

node /workspace/skills/logging/ingest.js

if [ $? -eq 0 ]; then
  log_info "agent.cron" "Nightly ingest complete" "system"
else
  log_error "agent.cron" "Nightly ingest failed" "system"
fi
```

## Event Naming Conventions

Use dot-notation for hierarchical event names:

- `category.action`: `lead.scored`, `build.complete`
- `category.subcategory.action`: `email.inbound.processed`

Standard categories:
- `agent.*`: Agent lifecycle events
- `email.*`: Email pipeline events
- `lead.*`: Lead management events
- `build.*`: Build system events
- `review.*`: Review system events
- `kb.*`: Knowledge base events
- `content.*`: Content pipeline events
- `council.*`: BI Council events
- `briefing.*`: Daily briefing events
- `system.*`: System/infrastructure events
- `usage.*`: Usage tracking events
- `security.*`: Security events

## Log Levels

| Level | When to Use | Example |
|---|---|---|
| `debug` | Detailed diagnostic info | "Parsed 156 email headers" |
| `info` | Normal operations | "Lead scored: 85 (exceptional)" |
| `warn` | Issues that don't stop execution | "LM Studio slow to respond (3s)" |
| `error` | Failures that affect functionality | "Failed to send email: connection timeout" |
| `fatal` | Critical failures that stop the system | "Database corruption detected" |

## Best Practices

### 1. Log at the Right Level

```javascript
// ✅ Good
log.info('lead.scored', { email_id: 42, score: 85 });
log.warn('system.performance', { operation: 'email_fetch', duration_ms: 5000 });
log.error('email.outbound', { error: 'SMTP timeout', email_id: 42 });

// ❌ Bad
log.error('lead.scored', { email_id: 42, score: 85 });  // Not an error!
log.info('system.error', { error: 'SMTP timeout' });     // Should be error level
```

### 2. Include Context

```javascript
// ✅ Good - includes all relevant context
log.info('lead.scored', {
  email_id: 42,
  from: 'jane@example.com',
  score: 85,
  bucket: 'exceptional',
  signals: ['pricing_question', 'local_business']
}, { agent: 'scout', source: 'scorer.js' });

// ❌ Bad - missing context
log.info('lead.scored', { score: 85 });
```

### 3. Track Performance

```javascript
// ✅ Good - includes duration
const start = Date.now();
await processEmail(email);
log.info('email.processed', {
  email_id: email.id,
  duration_ms: Date.now() - start
});

// ❌ Bad - no timing info
await processEmail(email);
log.info('email.processed', { email_id: email.id });
```

### 4. Error Logging

```javascript
// ✅ Good - full error context
try {
  await riskyOperation();
} catch (err) {
  log.error('operation.failed', {
    message: err.message,
    stack: err.stack,
    operation: 'riskyOperation',
    input: JSON.stringify(input)
  });
  throw err; // Re-throw if needed
}

// ❌ Bad - loses error details
try {
  await riskyOperation();
} catch (err) {
  log.error('error', { error: 'something failed' });
}
```

### 5. Avoid Logging Secrets

The redaction engine will catch most secrets, but be mindful:

```javascript
// ✅ Good - secrets will be redacted
log.info('email.sent', {
  to: 'client@example.com',
  subject: 'Wedding Quote',
  api_key: process.env.SENDGRID_API_KEY  // Will be redacted
});

// ⚠️ Better - don't log secrets at all
log.info('email.sent', {
  to: 'client@example.com',
  subject: 'Wedding Quote'
  // api_key not needed in logs
});
```

## Viewing Logs

### CLI Viewer

```bash
# Recent logs
node /workspace/skills/logging/viewer.js --last 1h

# Specific event
node /workspace/skills/logging/viewer.js --event lead.scored --last 24h

# By agent
node /workspace/skills/logging/viewer.js --agent brunel --last 12h

# Errors only
node /workspace/skills/logging/viewer.js --level error --last 7d

# Search content
node /workspace/skills/logging/viewer.js --grep "timeout" --last 24h

# Live tail
node /workspace/skills/logging/viewer.js --tail --event system.error

# Count events
node /workspace/skills/logging/viewer.js --count --event agent.heartbeat --last 24h
```

### Programmatic Access

```javascript
const LogDB = require('/workspace/skills/logging/db');

const db = new LogDB();

// Query logs
const logs = db.query({
  event: 'lead.scored',
  from: '2026-02-26T00:00:00Z',
  to: '2026-02-26T23:59:59Z'
});

// Count logs
const count = db.count({
  level: 'error',
  agent: 'brunel'
});

db.close();
```

## Maintenance

The logging system maintains itself through automated cron jobs:

- **Nightly ingest** (3 AM): Parses JSONL → SQLite
- **Daily rotation** (4 AM): Archives large files, cleans old data

No manual maintenance required.

## Performance

- **Non-blocking writes**: WriteStream-based, doesn't block your code
- **Buffered**: Periodic flushes reduce I/O
- **Per-event files**: Small files, fast scanning
- **Indexed DB**: SQLite indexes for fast historical queries
- **Never throws**: Logging failures don't crash your code

## Files

| File | Purpose |
|---|---|
| `logger.js` | Core Node.js API |
| `logger.sh` | Shell helper |
| `viewer.js` | CLI viewer |
| `ingest.js` | JSONL → SQLite |
| `rotate.js` | Rotation and archival |
| `db.js` | Database queries |
| `redact.js` | Secret scrubbing |
| `config.json` | Configuration |

## Configuration

Edit `/workspace/skills/logging/config.json`:

```json
{
  "log_dir": "/Volumes/reeseai-memory/data/logs",
  "min_level": "info",
  "rotation": {
    "max_size_mb": 50,
    "keep_recent": 3,
    "db_retention_days": 90
  }
}
```

## Support

- **README.md**: General usage and features
- **Spec**: `/workspace/specs/logging-infrastructure.md`
- **Source**: Well-commented code in each file
- **Ask Dewey**: For knowledge base integration questions
- **Ask Brunel**: For build system integration
