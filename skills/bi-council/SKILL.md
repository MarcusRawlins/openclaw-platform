# Business Intelligence Council Skill

**Purpose:** Multi-agent business intelligence system that analyzes business data through independent expert personas, synthesizes findings, and delivers strategic recommendations.

**Architecture:** 
- Data Sync Layer: 5 SQLite databases (Telegram, Mission Control, CRM, social, finance)
- Expert Analysis Layer: 6 parallel expert personas using Opus
- Synthesis Layer: Marcus merges findings using Sonnet
- Delivery: Nightly digest at 10 PM EST + CLI for deep dive

**Key Files:**
- `sync-telegram.js` — Telegram message sync (3h)
- `sync-mission-control.js` — Task sync from MC (3h)
- `sync-crm.js` — CRM data from AnselAI (4h)
- `sync-social.js` — Social analytics (4h)
- `import-financial.js` — Manual financial import
- `expert-framework.js` — Expert analysis engine
- `experts.js` — 6 expert configurations
- `run-experts.js` — Parallel expert execution
- `synthesize.js` — Synthesis engine (Marcus/Sonnet)
- `format-digest.js` — Nightly digest formatter
- `run-council.js` — Main orchestrator
- `council-cli.js` — CLI for exploration & feedback
- `council-history.db` — Recommendation tracking

**Usage:**

```bash
# Sync all data sources
node sync-all.js

# Run expert analyses
node run-experts.js

# Full council run (sync → analyze → synthesize → deliver)
node run-council.js

# Explore a council session
council explore 42

# Accept a recommendation
council accept 128

# Reject a recommendation
council reject 129 "Not a priority"

# Show history
council history 7
```

**Database Locations:**
- `/Volumes/reeseai-memory/data/bi-council/team-chat.db`
- `/Volumes/reeseai-memory/data/bi-council/tasks.db`
- `/Volumes/reeseai-memory/data/bi-council/crm.db`
- `/Volumes/reeseai-memory/data/bi-council/social.db`
- `/Volumes/reeseai-memory/data/bi-council/finance.db`
- `/Volumes/reeseai-memory/data/bi-council/council-history.db`

**Cron Jobs:**
- Data Sync (Telegram + MC): Every 3 hours
- Expert Analysis: Nightly at 10 PM EST
- Optional: Feedback reset on Sundays

**Cost:** ~$1.80/night for Opus expert analyses (~120K tokens) + Sonnet synthesis

**Status:** Building Phase 1 (data sync layer)
