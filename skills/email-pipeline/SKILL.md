# Email Pipeline Skill

## Agent Integration Guide

### Purpose

Automated monitoring and processing of inbound sales/lead emails across multiple accounts with security scanning, LLM-based scoring, and safe draft generation.

### When to Use

- **Scheduled**: Every 10 minutes via cron job
- **On-demand**: Manual poll when checking for new leads
- **Analysis**: Review pipeline stats, audit trails, or rescore after rubric changes

### How Agents Call This Skill

```javascript
const { pollAll, getStats, listEmails } = require('/workspace/skills/email-pipeline/monitor');
const { changeStage } = require('/workspace/skills/email-pipeline/stage-tracker');
const { generateDraft } = require('/workspace/skills/email-pipeline/drafter');
const { researchDomain } = require('/workspace/skills/email-pipeline/researcher');

// Poll all accounts
const results = await pollAll();

// Get pipeline stats
const stats = getStats();

// List recent leads
const leads = listEmails(24, true); // last 24h, leads only

// Manually change stage
const db = require('/workspace/skills/email-pipeline/db').getDatabase();
changeStage(db, emailId, 'Qualified', 'agent', 'Manual qualification after review');

// Generate draft for an email
const draft = await generateDraft(emailId);

// Research a domain
const research = await researchDomain('example.com');
```

### Cron Job Configuration

```json
{
  "name": "email-pipeline-poll",
  "schedule": { "kind": "every", "everyMs": 600000 },
  "payload": { 
    "kind": "agentTurn", 
    "message": "Run email pipeline poll for all accounts" 
  },
  "sessionTarget": "isolated"
}
```

### Expected Outputs

**Poll Results:**
```json
[
  { "account": "photography", "new_count": 3 },
  { "account": "rehive", "new_count": 1 }
]
```

**Pipeline Stats:**
```json
{
  "total_emails": 42,
  "by_status": { "clean": 38, "blocked": 2, "held": 2 },
  "by_classification": { "lead": 12, "vendor_outreach": 5, "spam": 8 },
  "by_score_bucket": { "exceptional": 2, "high": 5, "medium": 4, "low": 1 },
  "by_account": { "photography": 25, "rehive": 17 }
}
```

**Email List:**
```json
[
  {
    "id": 42,
    "account_id": "photography",
    "from_email": "bride@example.com",
    "from_name": "Sarah Johnson",
    "subject": "Wedding Photography Inquiry - June 2027",
    "score": 92,
    "score_bucket": "exceptional",
    "classification": "lead",
    "stage_label": "Stage/New",
    "received_at": "2026-02-26T14:30:00Z"
  }
]
```

### Security Guarantees

1. **Never fetches URLs from email bodies** (policy + SSRF protection)
2. **Fails closed on scanner errors** (held for manual review)
3. **Three-layer draft safety** (writer → reviewer → content gate)
4. **Blocks private IP ranges** for domain research
5. **Sanitizes all HTML** before LLM processing

### Configuration

**Multi-account**: Add accounts in `config.json`
**Scoring rubric**: Edit `rubric.md` (will trigger rescore flag)
**Templates**: Edit files in `templates/`
**Models**: Set in `config.json` (uses LLM router)

### State Machine

```
New → Contacted → Qualified → Proposal Sent → Negotiating → Booked
  ↓       ↓           ↓            ↓               ↓
  └───────┴───────────┴────────────┴───────────────┴──→ Lost
  └───────┴───────────┴────────────┴───────────────┴──→ Archived
```

Illegal transitions are rejected with an error. All transitions are logged to `stage_audit`.

### Label System

**Score Labels** (immutable, set once):
- `Lead/Exceptional 95`
- `Lead/High 78`
- `Vendor/Florist Partnership Inquiry`

**Stage Labels** (mutable, updated as deal progresses):
- `Stage/New`
- `Stage/Contacted`
- `Stage/Qualified`
- etc.

### Escalation Rules

- **Exceptional (85-100)**: Telegram notification + CRM push + high priority
- **High (70-84)**: Telegram notification + CRM push + medium priority
- **Medium (40-69)**: CRM push only + low priority
- **Low (15-39)**: No escalation
- **Spam (0-14)**: Auto-archive if configured

### Error Handling

All errors are logged via the logging skill. Pipeline continues on individual email failures (logs error, moves to next email).

Connection failures to email accounts: retry with backoff, alert after 3 consecutive failures.

LLM errors: fall back to safe defaults (template as-is for drafts, hold for review on scanner errors).

### Database Location

`/Volumes/reeseai-memory/data/email-pipeline/pipeline.db`

### Dependencies

- `himalaya` CLI (already installed)
- `better-sqlite3` (npm package)
- LM Studio (local inference)
- LLM router skill
- Logging skill

### Maintenance

- **Rescoring**: After editing `rubric.md`, run `node scorer.js --rescore`
- **Template updates**: Edit template files, drafts will use new version immediately
- **Account changes**: Edit `config.json`, restart polling
- **Database cleanup**: Archive old emails, keep recent 90 days in hot storage

### Monitoring

Check these regularly:
- `monitor.js --stats` for pipeline health
- `stage_audit` table for unusual transitions
- `quarantine_status = 'held'` for emails needing manual review
- Poll state updates (should update every 10 minutes)

### Integration with AnselAI CRM

Currently pushes to Mission Control as tasks. When AnselAI is live, will:
- Create/update lead records
- Sync stage labels bidirectionally
- Attach email threads to leads
- Link sender research

### Notes

- All times are stored in UTC, convert to EST for display
- Thread IDs group related emails
- Sender research is cached for 30 days
- Draft generation can fall back to canonical template (always safe)
- Score labels are immutable (rescoring creates new entries in scoring_log)
