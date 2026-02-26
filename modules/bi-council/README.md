# Business Intelligence Council

A multi-agent business intelligence system that analyzes business data through independent expert personas, synthesizes findings, and delivers strategic recommendations.

## Overview

The Business Intelligence Council runs every night at 10 PM EST. It:

1. **Syncs** data from 5 sources (Telegram, Mission Control, CRM, social analytics, financial)
2. **Analyzes** through 6 independent expert personas in parallel (Scout, Ada, Ed, Dewey, Brunel, Walt)
3. **Synthesizes** findings using Marcus (Sonnet) to create strategic insights
4. **Delivers** a nightly digest with ranked recommendations + CLI for deep dive

## Architecture

```
Data Sync Layer (3-4h intervals)
    ↓
Expert Analysis Layer (6 experts in parallel, Opus)
    ↓
Synthesis Layer (Marcus, Sonnet)
    ↓
Nightly Digest + CLI Feedback
```

## Quick Start

### Installation

```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/bi-council
npm install
```

### Run Commands

```bash
# Full council run (everything)
node run-council.js

# Just sync data
node sync-all.js

# Just run expert analyses
node run-experts.js

# CLI commands
node council-cli.js explore 42      # View session details
node council-cli.js accept 128      # Accept recommendation
node council-cli.js reject 129 "reason"  # Reject with reason
node council-cli.js history 7       # Show last 7 days
node council-cli.js status          # Current status
```

## Data Sync Layer

### Databases

Five SQLite databases store synced data:

- **team-chat.db** — Telegram messages (synced every 3 hours)
- **tasks.db** — Mission Control tasks (synced every 3 hours)
- **crm.db** — CRM inquiries and bookings (synced every 4 hours)
- **social.db** — Social analytics metrics (synced every 4 hours)
- **finance.db** — Financial records (manual import + automatic from financial-tracking skill)

Location: `/Volumes/reeseai-memory/data/bi-council/`

### Sync Scripts

```bash
node sync-mission-control.js  # MC tasks → tasks.db
node sync-crm.js              # AnselAI CRM → crm.db
node sync-social.js           # Analytics → social.db
node import-financial.js      # Import from financial-tracking skill
```

## Expert Analysis Layer

### The 6 Experts

Each expert analyzes their domain in parallel, using Claude Opus:

| Expert | Role | Focus | Data Source |
|--------|------|-------|-------------|
| Scout | Market Analyst | Trends, competition, audience | Tasks, social |
| Ada | Content Strategist | Engagement, performance, editorial | Social metrics, content |
| Ed | Revenue Guardian | Pipeline, conversions, sales | CRM, inquiries, bookings |
| Dewey | Operations Analyst | Efficiency, productivity, health | Tasks, chat |
| Brunel | Growth Strategist | Cross-domain opportunities | All sources |
| Walt | Financial Guardian | Revenue, costs, ROI | Finance, bookings |

Each expert produces:
- 2-3 key insights
- Risk assessment (none/low/medium/high/critical)
- 2-3 opportunities
- 3-5 ranked recommendations (impact × urgency)

### Running Experts

```bash
node run-experts.js
```

Output: Expert analyses stored in `council_sessions` + `expert_analyses` + `recommendations` tables.

## Synthesis Layer

Marcus (using Sonnet) merges expert findings:

1. Collects all expert analyses
2. Extracts cross-domain patterns
3. Ranks recommendations by impact × urgency
4. Identifies risk alerts
5. Creates executive summary

```bash
# Synthesis happens automatically in run-council.js
# Or trigger manually:
node synthesize.js <session-id>
```

## Nightly Digest

Formatted markdown digest includes:

- Executive summary (1 paragraph)
- Business health + primary trend
- Risk alerts (if any)
- Cross-domain insights
- Top 5 recommendations (ranked)
- Deep dive + feedback instructions

Example:

```
🏛 **Business Intelligence Council — Friday, February 28, 2026**

🟢 **Business Health:** GOOD 📈 growth

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Executive Summary

The business is in growth mode with healthy pipeline momentum and improving social engagement...

## 💡 Top Recommendations

**1. Increase content frequency by 50%**
   📊 Impact: [█████░] 8/10 | ⏱ Urgency: [█████░] 8/10
   🎯 Social engagement metrics trending up; audience appetite is clear...
   _— Ada_

...

Deep Dive: Use `council explore 42` for full analysis details.
Feedback: Accept with `council accept <rec-id>`, reject with `council reject <rec-id> <reason>`

Session: 42
```

## Council History Database

Tracks all sessions, analyses, and recommendations:

**Tables:**
- `council_sessions` — Session metadata
- `expert_analyses` — Each expert's analysis snapshot
- `recommendations` — Ranked recommendations with feedback
- `synthesis` — Executive summary + insights

Location: `/Volumes/reeseai-memory/data/bi-council/council-history.db`

## Feedback Loop

Accept/reject recommendations to tune future analysis:

```bash
# Accept recommendation
council accept 128

# Reject with reason
council reject 129 "Not a priority right now"

# View acceptance rate
council status
```

Accepted recommendations are tracked for:
- Trend analysis (are recommendations improving?)
- Expert weight tuning (which experts are most accurate?)
- Future prioritization

## Cron Jobs

### Automatic Scheduling

Configure in OpenClaw gateway:

```json
[
  {
    "name": "BI Council: Nightly Run (10 PM EST)",
    "schedule": { "kind": "cron", "expr": "0 22 * * *", "tz": "America/New_York" },
    "payload": { "kind": "systemEvent", "text": "exec node /workspace/skills/bi-council/run-council.js" },
    "sessionTarget": "main",
    "enabled": true
  },
  {
    "name": "BI Council: Sync Data (3h + 4h staggered)",
    "schedule": { "kind": "every", "everyMs": 14400000 },
    "payload": { "kind": "systemEvent", "text": "exec node /workspace/skills/bi-council/sync-all.js" },
    "sessionTarget": "main",
    "enabled": true
  }
]
```

## Costs

- **Expert Analysis:** Opus × 6 experts × ~20K tokens each = ~120K tokens/night
  - Cost: ~$1.80/night or ~$54/month
- **Synthesis:** Sonnet × 1 → ~5K tokens/night
  - Cost: negligible
- **Total:** ~$55/month for comprehensive nightly strategic intelligence

## CLI Reference

```bash
# Deep dive into a session
council explore 42

# Show recent sessions
council history 7

# Accept a recommendation
council accept 128

# Reject with reason
council reject 129 "Not a priority"

# Current status
council status

# Help
council help
```

## Troubleshooting

### "Gateway unreachable"

Check OpenClaw gateway is running:
```bash
openclaw gateway status
openclaw gateway start  # if needed
```

### "LM Studio connection failed"

If Opus unavailable, system falls back to local LM Studio (qwen2.5:7b).

Ensure LM Studio is running: http://127.0.0.1:1234

### Database locked

Only one council session can run at a time. Check for hung processes:
```bash
ps aux | grep "run-council"
ps aux | grep "node"
```

Kill if stuck:
```bash
pkill -f "run-council"
```

### No recommendations generated

Check expert analyses exist in `council_sessions`:
```bash
sqlite3 /Volumes/reeseai-memory/data/bi-council/council-history.db
SELECT * FROM expert_analyses WHERE session_id = 42;
```

## Files

- `sync-all.js` — Master sync orchestrator
- `sync-mission-control.js` — MC task sync
- `sync-crm.js` — CRM data sync
- `sync-social.js` — Social analytics sync
- `import-financial.js` — Financial data import
- `expert-framework.js` — Expert analysis engine
- `experts.js` — 6 expert configurations
- `run-experts.js` — Parallel expert execution
- `synthesize.js` — Synthesis layer (Marcus)
- `format-digest.js` — Digest formatter
- `run-council.js` — Main orchestrator
- `council-cli.js` — CLI for exploration & feedback
- `init-council-db.js` — Database initialization
- `SKILL.md` — Skill documentation
- `README.md` — This file

## Future Enhancements

- Auto-tune expert weights based on acceptance rates
- Integration with Mission Control (create tasks from accepted recommendations)
- Predictive alerts (detect trends before they become problems)
- Scenario modeling (ROI calculations, "what-if" analysis)
- Weekly/monthly variants (different analysis depths)
- Export to PDF reports
- Slack/email digest delivery

## Questions?

Check:
- Spec: `/workspace/specs/business-intelligence-council.md`
- Logs: First 100 lines of run-council.js output
- Database: `sqlite3 /Volumes/reeseai-memory/data/bi-council/*.db`
