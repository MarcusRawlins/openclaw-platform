# Email Pipeline

Automated inbound email monitoring, scoring, classification, and response drafting system.

## Overview

Monitors multiple email accounts, quarantines suspicious content, scores leads against an editable rubric, tracks deal stages, and generates safe reply drafts through a two-layer LLM pipeline.

## Features

- **Multi-account monitoring** via himalaya CLI (IMAP/Gmail)
- **Two-layer security quarantine** (deterministic + LLM semantic scanner)
- **LLM-based lead scoring** against editable rubric
- **Dual label system** (immutable score labels + mutable stage labels)
- **State machine stage tracking** with audit trail
- **Three-layer draft safety** (writer → reviewer → content gate)
- **Sender domain research** with SSRF protection
- **Automatic escalation** (Telegram + CRM integration)

## Quick Start

```bash
# Install dependencies
npm install

# Initialize database
npm run init

# Poll all accounts
npm run poll

# View stats
npm run stats

# Rescore emails after editing rubric
npm run rescore
```

## Architecture

```
monitor.js → quarantine.js → scorer.js → labeler.js
                                 ↓
                         stage-tracker.js
                                 ↓
                            drafter.js
                                 ↓
                           escalator.js
```

## Configuration

Edit `config.json` to:
- Add/remove email accounts
- Adjust polling intervals
- Configure scoring models
- Set escalation rules

Edit `rubric.md` to change scoring criteria.

## Security

All inbound emails pass through:
1. **Deterministic sanitization**: Strip scripts, tracking pixels, external images
2. **Semantic scanner**: LLM-based phishing/social engineering detection (fail-closed)
3. **SSRF protection**: Block private IP ranges for domain research

All outbound drafts pass through:
1. **Writer LLM**: Personalize template
2. **Reviewer LLM**: Independent validation
3. **Content gate**: Deterministic checks for secrets/paths/amounts

## CLI Commands

```bash
# Monitoring
node monitor.js --poll                    # Poll all accounts
node monitor.js --poll --account photography
node monitor.js --list --last 24h
node monitor.js --list --leads --last 7d
node monitor.js --stats

# Scoring
node scorer.js --rescore --since 2026-02-20

# Stage Management
node stage-tracker.js --email 42 --stage "Qualified" --reason "Phone call went well"
node stage-tracker.js --audit --email 42

# Research
node researcher.js --domain example.com

# Drafting
node drafter.js --email 42
```

## Database Schema

- `emails`: All inbound emails with scores, labels, stages
- `sender_research`: Cached domain research
- `stage_audit`: Complete audit trail of stage changes
- `scoring_log`: Historical scores with rubric versions
- `poll_state`: Track last_seen_uid per account

## Integration

Called by cron job every 10 minutes:
```json
{
  "name": "email-pipeline-poll",
  "schedule": { "kind": "every", "everyMs": 600000 },
  "payload": { "kind": "agentTurn", "message": "Run email pipeline poll" }
}
```

## Files

- `monitor.js` - Multi-account polling loop
- `quarantine.js` - Security sanitization + scanning
- `scorer.js` - LLM scoring against rubric
- `labeler.js` - Score labels + stage labels
- `stage-tracker.js` - State machine + audit trail
- `drafter.js` - Two-layer draft generation
- `researcher.js` - Domain research with SSRF protection
- `escalator.js` - CRM push + notifications
- `db.js` - Database schema and initialization
- `rubric.md` - Editable scoring rubric
- `config.json` - All configuration
- `templates/` - 8 response templates (photo/rehive × 4 score buckets)

## Development

Uses:
- `better-sqlite3` for database
- `himalaya` CLI for email (IMAP/SMTP)
- LM Studio for local LLM inference
- LLM router skill for model calls
- Logging skill for event logging

## License

Proprietary - Marcus Rawlins / ReeseAI
