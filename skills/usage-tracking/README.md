# LLM Usage & Cost Tracking System

Centralized tracking for all LLM API calls, token usage, and estimated costs across the OpenClaw agent ecosystem.

## Overview

Every model call—whether Marcus on Opus, Brunel on Devstral, Walt on GPT-4 Turbo, or heartbeats on qwen3:4b—gets logged, costed, and made queryable from one place.

## Features

- **Fire-and-Forget Logging:** Buffered writes, never blocks calling code
- **Auto-Redaction:** Secrets, emails, paths, and PII automatically scrubbed
- **Cost Estimation:** Real-time cost calculation with current provider pricing
- **JSONL Logs:** Lightweight append-only daily logs for quick analysis
- **Daily Reports:** Filter by agent, model, date range, task type
- **Visual Dashboard:** CLI dashboard with budget tracking
- **90-Day Archive:** Automatic rolling archive to keep main DB fast
- **Gateway Sync:** Pull usage from OpenClaw gateway API (stub ready)

## Installation

```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/usage-tracking
npm install
```

## Quick Start

### Initialize Database

```bash
npm run init
```

This creates the SQLite database at `/Volumes/reeseai-memory/data/usage-tracking/usage.db`

### Log Usage

```javascript
const UsageLogger = require('./logger');
const logger = UsageLogger.getInstance();

logger.logLLM({
  agent: 'brunel',
  provider: 'lmstudio',
  model: 'devstral-small-2-2512',
  taskType: 'build',
  taskDescription: 'Building usage tracking system',
  prompt: fullPromptText,
  response: fullResponseText,
  inputTokens: 1200,
  outputTokens: 3400,
  durationMs: 8500
});

// Flush on shutdown
await logger.shutdown();
```

### View Dashboard

```bash
npm run dashboard
```

### Generate Report

```bash
# Today's usage
npm run report -- --today

# Last 7 days
npm run report -- --last 7d

# By agent
npm run report -- --agent marcus --last 30d
```

## Architecture

```
usage-tracking/
├── db.js                  # SQLite database + schema
├── logger.js              # Fire-and-forget logger (singleton)
├── cost-estimator.js      # Provider pricing + calculations
├── gateway-sync.js        # Sync from OpenClaw gateway
├── report.js              # Query + filter + aggregate reports
├── dashboard.js           # CLI dashboard + JSON output
├── archive.js             # 90-day rolling archive
├── redact.js              # Secret/PII redaction
├── config.json            # Configuration + pricing
├── SKILL.md               # Agent integration guide
└── README.md              # This file
```

## Database Schema

**llm_calls** - LLM API calls
- Timestamp, agent, provider, model
- Task type and description
- Token counts (input, output, cache read/write)
- Redacted prompt/response previews
- Cost estimate, duration, status

**api_calls** - Non-LLM API calls
- Timestamp, agent, service
- Endpoint, method, status code
- Request/response sizes, duration

**daily_aggregates** - Materialized daily summaries
- Fast queries for dashboard
- Call counts, token totals, costs by agent/model/task

## Configuration

Edit `config.json` for:
- Database path
- JSONL log directory
- Buffer size and flush interval
- Archive retention (default 90 days)
- Daily/monthly budgets
- Provider pricing
- Redaction patterns

## CLI Tools

### Dashboard
```bash
node dashboard.js           # Visual dashboard
node dashboard.js --json    # JSON output for Mission Control
```

### Report
```bash
node report.js --today                          # Today's report
node report.js --last 7d                        # Last 7 days
node report.js --from 2026-02-20 --to 2026-02-26
node report.js --agent marcus --last 30d
node report.js --model claude-opus-4-6 --last 7d
node report.js --task build --last 7d
node report.js --breakdown provider --last 30d
node report.js --top-agents --last 7d
node report.js --json                           # JSON output
```

### Archive
```bash
node archive.js --dry-run   # Show what would be archived
node archive.js --auto      # Archive records older than 90 days
```

### Gateway Sync
```bash
node gateway-sync.js        # Sync gateway usage (manual)
```

## Integration

### In Build Scripts

```javascript
const UsageLogger = require('/workspace/skills/usage-tracking/logger');
const logger = UsageLogger.getInstance();

async function build() {
  const start = Date.now();
  const response = await callLLM(prompt);
  
  logger.logLLM({
    agent: 'brunel',
    provider: 'lmstudio',
    model: 'devstral-small-2-2512',
    taskType: 'build',
    prompt: prompt,
    response: response.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs: Date.now() - start
  });
}

process.on('exit', () => logger.shutdown());
```

### In Heartbeats

```javascript
const { getTodaySpending } = require('/workspace/skills/usage-tracking/dashboard');

// Check budget during heartbeat
const today = getTodaySpending();
if (today.cost > 8.00) {  // 80% of $10 daily budget
  console.warn(`Daily budget alert: $${today.cost} spent today`);
}
```

## Cost Estimation

Pricing is configured in `config.json` and includes:
- Anthropic (Claude Opus, Sonnet)
- OpenAI (GPT-4 Turbo, GPT-4o, GPT-4o-mini)
- Google (Gemini 2.5 Pro, 2.0 Flash)
- Local models (LM Studio, Ollama) - $0

Costs are estimated in real-time based on token counts and current provider rates.

## Auto-Redaction

Before storing prompts/responses, the system automatically redacts:
- API keys and tokens
- Email addresses
- File paths with usernames
- Private IP addresses
- Dollar amounts
- Environment variable secrets

Original text is **never** stored. Only redacted previews are kept.

## Archive System

Records older than 90 days are automatically moved to monthly archive databases:
```
/Volumes/reeseai-memory/data/usage-tracking/archive/
├── 2025-11.db
├── 2025-12.db
└── 2026-01.db
```

Archives can be queried directly if needed (same schema as main DB).

## JSONL Logs

Lightweight daily logs for quick grep/analysis:
```
/Volumes/reeseai-memory/data/usage-tracking/logs/
├── 2026-02-24.jsonl
├── 2026-02-25.jsonl
└── 2026-02-26.jsonl
```

Each line is a JSON object with timestamp, agent, model, tokens, cost, and duration.

## Budget Tracking

Default budgets (configurable):
- Daily: $10
- Monthly: $150

Dashboard shows percentage used. Set up alerts in heartbeat code:

```javascript
if (today.cost > config.budgets.daily_usd * 0.8) {
  // Warn at 80% budget
}
```

## Maintenance

- **Daily:** Check dashboard for anomalies
- **Weekly:** Review cost trends by agent/model
- **Monthly:** Run archive process (can be automated via cron)
- **Quarterly:** Update provider pricing if rates change

## Performance

- **Buffered writes:** Logs written every 5 seconds or 50 entries
- **WAL mode:** Concurrent reads while writing
- **Materialized aggregates:** Fast dashboard queries
- **Indexed:** Timestamp, agent, model, task type

## Testing

See test plan in spec. Key areas:
- Logger doesn't block
- Redaction catches all patterns
- Cost estimates match known pricing
- Archive moves records correctly
- Reports filter accurately

## Support

Built by: Brunel
Maintained by: Agent ecosystem
Questions: Ask Marcus or Brunel

## License

MIT
