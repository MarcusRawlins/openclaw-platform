# Personal CRM Engine

Headless, standalone CRM engine for managing contacts, scoring relationships, and generating follow-up nudges. Designed to be consumed by Mission Control (UI), AnselAI (photography CRM), R3 Studios, and Marcus via Telegram.

## Features

- **Contact Discovery**: Automatically extract contacts from email pipeline with learning system
- **Relationship Scoring**: 0-100 score based on recency, frequency, priority, depth, and reciprocity
- **Nudge Generator**: Identifies contacts needing attention based on configurable rules
- **Natural Language Queries**: Intent detection for common CRM questions
- **LLM Profiling**: AI-generated relationship summaries and communication style analysis
- **Email Draft System**: Two-phase approval for email drafts (disabled by default)
- **Follow-up Management**: Due dates, snoozing, and reminders
- **Integration API**: Importable module for other services

## Installation

```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/crm-engine
npm install
```

## Quick Start

### Initialize Database

```bash
node db.js
```

### Add a Contact

```bash
node contacts.js --add --name "Jane Doe" --email jane@example.com --company "Acme Inc"
```

### Natural Language Query

```bash
node query.js "who needs attention?"
node query.js "tell me about Jane Doe"
node query.js "who works at Acme?"
```

### Daily Sync

```bash
node sync.js --run
```

## Architecture

```
Email Pipeline → Discovery → Contacts
                     ↓
            Interactions + Scoring
                     ↓
         Nudges + Profiler + Drafts
                     ↓
             Mission Control UI
```

## CLI Commands

### Contacts

```bash
node contacts.js --list [--sort score|name|company|recent] [--limit N]
node contacts.js --search "query"
node contacts.js --merge <keep_id> <merge_id>
```

### Discovery

```bash
node discovery.js --scan [--last 24h]
node discovery.js --pending
node discovery.js --approve <id>
node discovery.js --reject <id>
node discovery.js --patterns
```

### Interactions

```bash
node interactions.js --log --contact <id> --type email_sent --subject "..."
node interactions.js --list --contact <id>
node interactions.js --stats --contact <id>
```

### Follow-ups

```bash
node follow-ups.js --add --contact <id> --description "..." --due YYYY-MM-DD
node follow-ups.js --list [--overdue]
node follow-ups.js --snooze <id> --until YYYY-MM-DD
node follow-ups.js --done <id>
```

### Scoring

```bash
node scorer.js --recalculate
node scorer.js --report
node scorer.js --score <contact_id>
```

### Nudges

```bash
node nudges.js
```

### Profiling

```bash
node profiler.js --generate <contact_id>
node profiler.js --update-stale
node profiler.js --show <contact_id>
```

### Drafts (disabled by default)

```bash
node drafts.js --for <contact_id> [--purpose "..."]
node drafts.js --pending
node drafts.js --approve <draft_id>
```

### Sync

```bash
node sync.js --run
node sync.js --dry-run
```

## Integration API

```javascript
const crm = require('./api');

// Search contacts
const results = crm.searchContacts('photographer');

// Get contact summary
const summary = crm.getSummary(12);

// Natural language query
const result = crm.query('who needs attention?');

// Get stats
const stats = crm.getStats();
```

See `api.js` for full API documentation.

## Configuration

Edit `config.json`:

- `discovery.auto_add_enabled`: Enable/disable auto-add after learning
- `discovery.skip_domains`: Domains to always skip
- `scoring.weights`: Adjust scoring weights
- `nudges.dormant_threshold_days`: Days before "long silence" nudge
- `drafts.enabled`: Enable/disable draft generation (default: false)

## Safety

- Drafts disabled by default (set `drafts.enabled = true` to enable)
- Two-phase approval for drafts (writer + reviewer)
- Content gate catches secrets/paths/amounts
- PII redacted from logs (names OK, emails OK, phone numbers redacted)
- Skip patterns never expose why a contact was rejected

## Database

SQLite with WAL mode at `/Volumes/reeseai-memory/data/crm-engine/crm.db`

Tables:
- `contacts` - Contact records
- `interactions` - Interaction history
- `follow_ups` - Follow-up reminders
- `contact_context` - Context for semantic search (future)
- `contact_summaries` - LLM-generated profiles
- `company_news` - Company news tracking (future)
- `discovery_decisions` - Approval/rejection history
- `skip_patterns` - Learned skip patterns

## Dependencies

- `better-sqlite3` - Database
- `himalaya` CLI - Email backend
- LM Studio - Local LLM models
- LLM Router skill - Model calls
- Logger skill - Structured logging
- Email Pipeline skill - Reads its database

## Cron Integration

Add to cron for daily sync at 7am ET:

```bash
0 7 * * * cd /Users/marcusrawlins/.openclaw/workspace/skills/crm-engine && node sync.js --run
```

## License

MIT
