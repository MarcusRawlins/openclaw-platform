# Usage Tracking - Quick Start Guide

## Installation

System is already installed at:
```
/Users/marcusrawlins/.openclaw/workspace/skills/usage-tracking/
```

Database location:
```
/Volumes/reeseai-memory/data/usage-tracking/
```

## Basic Commands

### View Dashboard
```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/usage-tracking
node dashboard.js
```

### Generate Reports
```bash
# Today's usage
node report.js --today

# Last 7 days
node report.js --last 7d

# Last 30 days by agent
node report.js --agent marcus --last 30d

# Cost breakdown by provider
node report.js --breakdown provider --last 30d

# Top models by cost
node report.js --top-models --last 7d

# JSON output (for Mission Control)
node report.js --today --json
node dashboard.js --json
```

### Maintenance
```bash
# Check what would be archived (dry run)
node archive.js --dry-run

# Archive old records (90+ days)
node archive.js --auto

# Sync gateway usage (manual)
node gateway-sync.js

# Run health check
node test.js

# Generate demo data
node demo.js
```

## Integration in Scripts

### Log LLM Call
```javascript
const UsageLogger = require('/workspace/skills/usage-tracking/logger');
const logger = UsageLogger.getInstance();

logger.logLLM({
  agent: 'brunel',
  provider: 'lmstudio',
  model: 'devstral-small-2-2512',
  taskType: 'build',
  taskDescription: 'Building feature X',
  prompt: fullPrompt,
  response: fullResponse,
  inputTokens: 1200,
  outputTokens: 3400,
  durationMs: 8500
});

// Always flush on exit
process.on('exit', () => logger.shutdown());
```

### Log API Call
```javascript
logger.logAPI({
  agent: 'scout',
  service: 'serpapi',
  endpoint: '/search',
  statusCode: 200,
  durationMs: 890
});
```

### Check Budget (Heartbeat)
```javascript
const { getTodaySpending } = require('/workspace/skills/usage-tracking/dashboard');

const today = getTodaySpending();
if (today.cost > 8.00) {  // 80% of $10 daily budget
  console.warn(`⚠️  Daily budget alert: $${today.cost} spent`);
}
```

## Configuration

Edit `/workspace/skills/usage-tracking/config.json` to change:
- Daily/monthly budgets
- Provider pricing
- Buffer size and flush interval
- Archive retention period
- Redaction patterns

## Task Types

Standard task types for consistent reporting:
- `build` - Building code, features
- `review` - Reviews and analysis
- `chat` - Interactive conversations
- `heartbeat` - Health checks
- `cron` - Scheduled tasks
- `synthesis` - Research and summarization

## Files

```
archive.js          - 90-day rolling archive system
config.json         - Configuration and pricing
cost-estimator.js   - Cost calculation engine
dashboard.js        - Visual dashboard CLI
db.js               - Database layer
demo.js             - Demo data generator
gateway-sync.js     - Gateway usage sync
logger.js           - Fire-and-forget logger
redact.js           - Secret/PII redaction
report.js           - Report generator
test.js             - Health check tests
SKILL.md            - Integration guide
README.md           - Full documentation
```

## Support

Questions? Read SKILL.md for detailed integration instructions.

Built by Brunel, maintained by the agent ecosystem.
