# Usage Tracking Skill

**Track all LLM API calls, costs, and usage across the agent ecosystem.**

## Quick Start

```javascript
const UsageLogger = require('/workspace/skills/usage-tracking/logger');
const logger = UsageLogger.getInstance();

// Log an LLM call
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
  durationMs: 8500,
  sessionKey: 'session-abc-123',
  status: 'success'
});

// Log an API call (non-LLM)
logger.logAPI({
  agent: 'scout',
  service: 'serpapi',
  endpoint: '/search',
  statusCode: 200,
  durationMs: 1200
});
```

## What Gets Tracked

- **LLM Calls:** All calls to Claude, GPT, local models, etc.
- **Token Usage:** Input, output, and cache tokens
- **Costs:** Estimated costs based on current provider pricing
- **API Calls:** SerpAPI, web fetches, other external services
- **Performance:** Duration, error rates, cache savings

## Features

### 🔥 Fire-and-Forget
Logging is buffered and never blocks your code. Writes happen in the background.

### 🔒 Auto-Redaction
Prompts and responses are automatically scrubbed of:
- API keys and secrets
- Email addresses
- File paths with usernames
- Dollar amounts
- Private IP addresses

### 💰 Cost Estimation
Real-time cost calculation using current provider pricing (Anthropic, OpenAI, Google).

### 📊 Daily Reports
```bash
# Today's usage
node /workspace/skills/usage-tracking/report.js --today

# Last 7 days
node /workspace/skills/usage-tracking/report.js --last 7d

# Filter by agent
node /workspace/skills/usage-tracking/report.js --agent marcus --last 30d

# JSON output
node /workspace/skills/usage-tracking/report.js --today --json
```

### 📈 Dashboard
```bash
# Visual dashboard
node /workspace/skills/usage-tracking/dashboard.js

# JSON for Mission Control integration
node /workspace/skills/usage-tracking/dashboard.js --json
```

## Integration Patterns

### Build Scripts (Brunel)
```javascript
const UsageLogger = require('/workspace/skills/usage-tracking/logger');
const logger = UsageLogger.getInstance();

async function buildTask() {
  const start = Date.now();
  
  // Make LLM call
  const response = await callLLM(prompt);
  
  // Log it
  logger.logLLM({
    agent: 'brunel',
    provider: 'lmstudio',
    model: 'devstral-small-2-2512',
    taskType: 'build',
    taskDescription: 'Building client dashboard',
    prompt: prompt,
    response: response.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs: Date.now() - start
  });
}

// Always flush on exit
process.on('exit', () => {
  logger.shutdown();
});
```

### Review Scripts (Walt)
```javascript
logger.logLLM({
  agent: 'walt',
  provider: 'openai',
  model: 'gpt-4-turbo',
  taskType: 'review',
  taskDescription: 'Weekly agent performance review',
  prompt: reviewPrompt,
  response: reviewResponse,
  inputTokens: 12000,
  outputTokens: 8000,
  cacheReadTokens: 50000,
  durationMs: 15000
});
```

### Heartbeats
```javascript
logger.logLLM({
  agent: 'marcus',
  provider: 'lmstudio',
  model: 'qwen3:4b',
  taskType: 'heartbeat',
  taskDescription: 'Checking email and calendar',
  inputTokens: 800,
  outputTokens: 50,
  durationMs: 1200
});
```

### OpenClaw Gateway (Auto-Sync)
The gateway sync runs automatically every 30 minutes via cron. No manual integration needed.

## CLI Tools

### Report
```bash
# Daily report
node report.js --today

# Last 7 days by agent
node report.js --agent marcus --last 7d

# Cost breakdown by provider
node report.js --breakdown provider --last 30d

# Top models by cost
node report.js --top-models --last 7d
```

### Dashboard
```bash
# Visual dashboard
node dashboard.js

# JSON output
node dashboard.js --json
```

### Archive
```bash
# Dry run (show what would be archived)
node archive.js --dry-run

# Archive records older than 90 days
node archive.js --auto
```

### Gateway Sync
```bash
# Manual sync
node gateway-sync.js
```

## Database Location

All data stored in:
```
/Volumes/reeseai-memory/data/usage-tracking/
├── usage.db              # Main database (90-day rolling)
├── logs/                 # Daily JSONL logs
│   └── YYYY-MM-DD.jsonl
└── archive/              # Monthly archive databases
    └── YYYY-MM.db
```

## Provider Pricing

Current pricing (as of Feb 2026):

**Anthropic**
- Claude Opus 4-6: $15/1M in, $75/1M out
- Claude Sonnet 4-5: $3/1M in, $15/1M out

**OpenAI**
- GPT-4 Turbo: $10/1M in, $30/1M out
- GPT-4o: $5/1M in, $15/1M out

**Local Models (LM Studio)**
- All models: $0 (local inference)

**Google**
- Gemini 2.5 Pro: $1.25/1M in, $10/1M out

Pricing is in `config.json` and can be updated as rates change.

## Budget Alerts

Default budgets (configurable in `config.json`):
- Daily: $10
- Monthly: $150

The dashboard shows percentage of budget used. Agents can check during heartbeats:

```javascript
const { getTodaySpending } = require('/workspace/skills/usage-tracking/dashboard');
const today = getTodaySpending();

if (today.cost > config.budgets.daily_usd * 0.8) {
  // Alert: 80% of daily budget used
  console.warn(`⚠️  Daily budget 80% used: $${today.cost}`);
}
```

## Task Types

Standard task types for consistent reporting:
- `build` - Building code, features, systems
- `review` - Code reviews, performance reviews
- `chat` - Interactive chat with Marcus
- `heartbeat` - Periodic health checks
- `cron` - Scheduled tasks
- `synthesis` - Research, analysis, summarization
- `gateway` - Gateway-tracked sessions

## Best Practices

1. **Always log LLM calls** - Even zero-cost local models (for usage tracking)
2. **Include task descriptions** - Makes reports more useful
3. **Log errors too** - Set `status: 'error'` and include `errorMessage`
4. **Flush on exit** - Call `logger.shutdown()` in process exit handler
5. **Check budgets** - Monitor spending during heartbeats
6. **Archive monthly** - Run `archive.js` on the 1st of each month

## Troubleshooting

**Logger not writing to database?**
- Check that database directory exists: `/Volumes/reeseai-memory/data/usage-tracking/`
- Look for errors in stderr
- Try manual flush: `await logger.flush()`

**Wrong cost estimates?**
- Check provider/model names match `config.json` pricing keys
- Update pricing in `config.json` if rates changed
- Local models should use provider `lmstudio` for $0 cost

**Archive failed?**
- Check disk space on `/Volumes/reeseai-memory/`
- Verify database not locked by other processes
- Run with `--dry-run` first to test

## Maintenance

- **Daily:** Check dashboard for budget alerts
- **Weekly:** Review reports by agent/model
- **Monthly:** Run archive process
- **Quarterly:** Update provider pricing in config
- **As needed:** Sync gateway usage manually if automatic sync fails

## Support

Questions? Check the code comments or ask Marcus/Brunel.

Built by Brunel, maintained by the agent ecosystem.
