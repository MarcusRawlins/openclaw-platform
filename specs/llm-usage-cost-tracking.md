# LLM Usage & Cost Tracking System
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** HIGH
**Estimated Build:** 3-4 days (Brunel)
**Location:** `/workspace/skills/usage-tracking/`

---

## 1. Overview

Centralized system for tracking all LLM calls, API usage, and estimated costs across the entire OpenClaw agent ecosystem. Every model call, whether from Marcus on Opus, Brunel on Devstral, Walt on GPT-4 Turbo, or heartbeats on qwen3:4b, gets logged, costed, and queryable from one place.

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│                usage-tracking/                   │
├─────────────────────────────────────────────────┤
│  db.js              SQLite interaction store     │
│  logger.js          Fire-and-forget log calls    │
│  cost-estimator.js  Per-model pricing + calc     │
│  gateway-sync.js    Pull OpenClaw gateway usage  │
│  report.js          Query + aggregate + filter   │
│  dashboard.js       CLI dashboard / JSON output  │
│  archive.js         90-day rolling archive       │
│  redact.js          Secret/PII redaction         │
│  config.json        Provider pricing, settings   │
│  SKILL.md           Agent integration guide      │
└─────────────────────────────────────────────────┘
```

## 3. Interaction Store (SQLite)

### Database Location
`/Volumes/reeseai-memory/data/usage-tracking/usage.db`

### Schema

```sql
-- LLM calls table
CREATE TABLE llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent TEXT NOT NULL,              -- marcus, brunel, walt, scout, etc.
  provider TEXT NOT NULL,           -- anthropic, openai, lmstudio, google
  model TEXT NOT NULL,              -- claude-opus-4-6, devstral-small-2-2512, etc.
  task_type TEXT,                   -- build, review, chat, heartbeat, cron, synthesis
  task_description TEXT,            -- brief description of what the call was for
  prompt_hash TEXT,                 -- SHA-256 of redacted prompt (for dedup tracking)
  prompt_preview TEXT,              -- first 200 chars of redacted prompt
  response_preview TEXT,            -- first 200 chars of redacted response
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  duration_ms INTEGER,             -- wall clock time
  estimated_cost_usd REAL,         -- calculated from cost-estimator
  status TEXT DEFAULT 'success',   -- success, error, timeout, rate_limited
  error_message TEXT,
  session_key TEXT,                 -- OpenClaw session ID if available
  metadata TEXT                    -- JSON blob for extra context
);

-- API calls table (non-LLM: SerpAPI, web fetches, etc.)
CREATE TABLE api_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent TEXT,
  service TEXT NOT NULL,            -- serpapi, brave, web_fetch, lm_studio, etc.
  endpoint TEXT,
  method TEXT DEFAULT 'GET',
  status_code INTEGER,
  duration_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  estimated_cost_usd REAL,
  error_message TEXT
);

-- Daily aggregates (materialized for fast dashboard queries)
CREATE TABLE daily_aggregates (
  date TEXT NOT NULL,
  agent TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task_type TEXT,
  call_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  avg_duration_ms REAL DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  PRIMARY KEY (date, agent, provider, model, task_type)
);

-- Indexes
CREATE INDEX idx_llm_timestamp ON llm_calls(timestamp);
CREATE INDEX idx_llm_agent ON llm_calls(agent);
CREATE INDEX idx_llm_model ON llm_calls(model);
CREATE INDEX idx_llm_task ON llm_calls(task_type);
CREATE INDEX idx_api_timestamp ON api_calls(timestamp);
CREATE INDEX idx_api_service ON api_calls(service);
```

## 4. Fire-and-Forget Logger (`logger.js`)

### Design Principles
- **Zero blocking:** Logging never slows down the calling code
- **Fail silent:** Log errors are caught and swallowed (logged to stderr only)
- **Auto-redact:** All prompts/responses pass through redaction before storage
- **Singleton:** One logger instance shared across the process

### API

```javascript
const UsageLogger = require('./logger');
const logger = UsageLogger.getInstance();

// Log an LLM call
logger.logLLM({
  agent: 'brunel',
  provider: 'lmstudio',
  model: 'devstral-small-2-2512',
  taskType: 'build',
  taskDescription: 'Building BI Council expert framework',
  prompt: rawPromptText,        // will be auto-redacted
  response: rawResponseText,    // will be auto-redacted
  inputTokens: 1200,
  outputTokens: 3400,
  durationMs: 8500,
  sessionKey: 'abc-123',
  status: 'success'
});

// Log an API call
logger.logAPI({
  agent: 'scout',
  service: 'serpapi',
  endpoint: '/search',
  method: 'GET',
  statusCode: 200,
  durationMs: 1200,
  requestSizeBytes: 256,
  responseSizeBytes: 15000
});

// Flush pending writes (call on graceful shutdown)
await logger.flush();
```

### Implementation Details
- Buffer writes in memory, flush to SQLite every 5 seconds or 50 entries (whichever first)
- Use `better-sqlite3` for synchronous batch inserts (fast on local disk)
- WAL mode for concurrent read/write
- Auto-calculate `estimated_cost_usd` using cost-estimator module

## 5. Secret Redaction (`redact.js`)

### Patterns to Redact
```javascript
const REDACTION_PATTERNS = [
  // API keys and tokens
  { pattern: /(?:sk|pk|api|key|token|secret|password|bearer)[-_]?[\w]{20,}/gi, replace: '[REDACTED_KEY]' },
  // Email addresses
  { pattern: /[\w.-]+@[\w.-]+\.\w{2,}/g, replace: '[REDACTED_EMAIL]' },
  // File paths with usernames
  { pattern: /\/Users\/\w+/g, replace: '/Users/[REDACTED]' },
  // IP addresses (private ranges)
  { pattern: /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g, replace: '[PRIVATE_IP]' },
  // Dollar amounts (financial confidentiality)
  { pattern: /\$[\d,]+(?:\.\d{2})?/g, replace: '[REDACTED_AMOUNT]' },
  // Port numbers on localhost
  { pattern: /localhost:\d+/g, replace: 'localhost:[PORT]' },
  // Common secret env vars
  { pattern: /(?:STRIPE|OPENAI|ANTHROPIC|SERPAPI|TAVILY|GOOGLE)_[\w]*(?:KEY|SECRET|TOKEN)\s*[=:]\s*\S+/gi, replace: '[REDACTED_ENV]' }
];
```

### Behavior
- Redaction is deterministic (same input always produces same output)
- Original text is never stored
- Prompt hash is computed AFTER redaction (so identical redacted prompts match)
- Preview fields store first 200 chars of redacted text

## 6. Cost Estimator Module (`cost-estimator.js`)

### Pricing Data (config.json)

```json
{
  "pricing": {
    "anthropic": {
      "claude-opus-4-6": {
        "input_per_1m": 15.00,
        "output_per_1m": 75.00,
        "cache_read_per_1m": 1.50,
        "cache_write_per_1m": 18.75
      },
      "claude-sonnet-4-5": {
        "input_per_1m": 3.00,
        "output_per_1m": 15.00,
        "cache_read_per_1m": 0.30,
        "cache_write_per_1m": 3.75
      }
    },
    "openai": {
      "gpt-4-turbo": {
        "input_per_1m": 10.00,
        "output_per_1m": 30.00
      }
    },
    "lmstudio": {
      "_default": {
        "input_per_1m": 0,
        "output_per_1m": 0,
        "note": "Local models, zero API cost"
      }
    },
    "google": {
      "gemini-2.5-pro": {
        "input_per_1m": 1.25,
        "output_per_1m": 10.00
      }
    }
  },
  "electricity_cost_per_kwh": 0.12,
  "local_model_watts": 15,
  "include_electricity_for_local": false
}
```

### API

```javascript
const CostEstimator = require('./cost-estimator');

// Calculate cost for a completed call
const cost = CostEstimator.estimateCost({
  provider: 'anthropic',
  model: 'claude-opus-4-6',
  inputTokens: 5000,
  outputTokens: 2000,
  cacheReadTokens: 30000,
  cacheWriteTokens: 0
});
// Returns: { cost_usd: 0.2250, breakdown: { input: 0.075, output: 0.150, cache_read: 0.045, cache_write: 0 } }

// Estimate before making a call
const estimate = CostEstimator.estimateFromText(text, 'anthropic', 'claude-opus-4-6');
// Returns: { estimated_tokens: 1250, estimated_cost_usd: 0.01875 }

// Get model pricing
const pricing = CostEstimator.getPricing('anthropic', 'claude-opus-4-6');

// Check if model is local (zero cost)
const isLocal = CostEstimator.isLocalModel('lmstudio', 'devstral-small-2-2512');
// Returns: true
```

### Token Estimation
- Default ratio: 1 token per 4 characters (English text)
- Configurable per-model overrides
- Used for pre-call cost estimation only (actual token counts from API response preferred)

## 7. Gateway/Framework Usage Sync (`gateway-sync.js`)

### Purpose
OpenClaw gateway tracks its own LLM usage internally. This module pulls that data into our centralized store so all usage appears in one dashboard.

### Implementation

```javascript
// Sync approach: query gateway API for recent sessions
async function syncGatewayUsage() {
  // 1. GET /api/sessions (list recent sessions)
  // 2. For each session, extract token usage from metadata
  // 3. Deduplicate against existing llm_calls (by session_key + timestamp)
  // 4. Insert new entries
  
  const gatewayUrl = 'http://localhost:18789';
  
  // Pull session list
  const sessions = await fetch(`${gatewayUrl}/api/sessions`);
  
  // Pull usage stats per session
  for (const session of sessions) {
    // Extract model, tokens, duration from session metadata
    // Insert into llm_calls with source='gateway_sync'
  }
}
```

### Sync Schedule
- Run every 30 minutes via cron
- Track last sync timestamp to only pull new data
- Deduplicate by session_key to avoid double-counting

### Mapping
| Gateway Field | Our Field |
|---|---|
| session.model | model |
| session.provider | provider |
| session.agent | agent |
| session.tokensIn | input_tokens |
| session.tokensOut | output_tokens |
| session.key | session_key |

## 8. JSONL Log (`logger.js` secondary output)

### Purpose
Lightweight, append-only log for quick grep/analysis without touching SQLite.

### Location
`/Volumes/reeseai-memory/data/usage-tracking/logs/YYYY-MM-DD.jsonl`

### Format
```jsonl
{"ts":"2026-02-26T10:30:00Z","agent":"marcus","provider":"anthropic","model":"claude-opus-4-6","type":"llm","task":"chat","in":5000,"out":2000,"cost":0.225,"ms":3200,"status":"ok"}
{"ts":"2026-02-26T10:30:05Z","agent":"scout","provider":"lmstudio","model":"gemma-3-12b","type":"llm","task":"research","in":1200,"out":800,"cost":0,"ms":1500,"status":"ok"}
{"ts":"2026-02-26T10:31:00Z","agent":"marcus","service":"serpapi","type":"api","status":200,"ms":890}
```

### Rotation
- One file per day
- Auto-created on first write
- Old files retained (daily notes policy: never deleted)

## 9. Report Generator (`report.js`)

### CLI Interface

```bash
# Daily summary
node report.js --today

# Date range
node report.js --from 2026-02-20 --to 2026-02-26

# Filter by agent
node report.js --agent marcus --last 7d

# Filter by model
node report.js --model claude-opus-4-6 --last 30d

# Filter by task type
node report.js --task build --last 7d

# Cost breakdown by provider
node report.js --breakdown provider --last 30d

# JSON output for programmatic consumption
node report.js --today --json

# Top consumers
node report.js --top-agents --last 7d
node report.js --top-models --last 7d
```

### Report Sections
1. **Summary:** Total calls, total tokens, total cost, avg cost per call
2. **By Agent:** Cost and token breakdown per agent
3. **By Provider:** Cost split (Anthropic vs OpenAI vs local)
4. **By Model:** Which specific models used most
5. **By Task Type:** Build vs review vs chat vs heartbeat vs cron
6. **Trends:** Day-over-day comparison, rolling 7-day average
7. **API Usage:** Non-LLM API calls summary
8. **Anomalies:** Unusually expensive calls, error spikes

## 10. Dashboard (`dashboard.js`)

### CLI Dashboard (default)

```
╔══════════════════════════════════════════════════════╗
║           USAGE DASHBOARD — 2026-02-26              ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║  TODAY'S SPEND          $4.32 / $10 daily budget     ║
║  MTD SPEND              $87.50 / $150 monthly budget ║
║                                                      ║
║  CALLS TODAY                                         ║
║  ├─ Marcus (Opus)       12 calls    $3.15            ║
║  ├─ Walt (Sonnet)        8 calls    $0.92            ║
║  ├─ Brunel (Devstral)   45 calls    $0.00            ║
║  ├─ Heartbeats (qwen3)  48 calls    $0.00            ║
║  └─ Ed (Gemma)           6 calls    $0.00            ║
║                                                      ║
║  TOKEN USAGE                                         ║
║  ├─ Input:    125,400 tokens                         ║
║  ├─ Output:    43,200 tokens                         ║
║  └─ Cached:   890,000 tokens (saved $12.40)          ║
║                                                      ║
║  API CALLS                                           ║
║  ├─ SerpAPI:    3 calls    $0.015                    ║
║  ├─ Web Fetch: 12 calls    free                      ║
║  └─ LM Studio: 99 calls    local                    ║
║                                                      ║
║  CRON RELIABILITY (7d)                               ║
║  ├─ Heartbeats:    336/336  100%                     ║
║  ├─ Daily Briefing:  7/7   100%                      ║
║  └─ BI Council:      6/7    86% (1 timeout)          ║
║                                                      ║
║  DB SIZES                                            ║
║  ├─ usage.db:       2.4 MB                           ║
║  ├─ council.db:     1.1 MB                           ║
║  ├─ kb-rag.db:     45.0 MB                           ║
║  └─ financial.db:   0.3 MB                           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

### JSON Mode
`node dashboard.js --json` outputs structured JSON for Mission Control integration.

### Integration Points
- Reads from: usage.db, council-history.db, cron logs, filesystem (db sizes)
- Can be called by Marcus during heartbeats for proactive cost alerts
- Threshold alerts: warn if daily spend > budget, error rate > 5%, etc.

## 11. Archive System (`archive.js`)

### Rolling Archive
- Rows older than 90 days moved to monthly archive databases
- Archive path: `/Volumes/reeseai-memory/data/usage-tracking/archive/YYYY-MM.db`
- Same schema as main db (can be queried directly if needed)
- Daily aggregates table is NOT archived (always kept for trend analysis)

### Archive Process
```bash
# Run manually
node archive.js

# Or via cron (monthly on 1st at 3 AM)
node archive.js --auto
```

### Behavior
1. Find all llm_calls and api_calls older than 90 days
2. Create/open archive db for that month
3. INSERT into archive db
4. DELETE from main db
5. VACUUM main db to reclaim space
6. Log archive operation

## 12. Integration with Existing Systems

### How Agents Log Usage
Each agent's build/review/task scripts should call the logger:

```javascript
// At the top of any script that makes LLM calls
const UsageLogger = require('/workspace/skills/usage-tracking/logger');
const logger = UsageLogger.getInstance();

// After each LLM call
logger.logLLM({ agent: 'brunel', provider: 'lmstudio', model: '...', ... });
```

### Gateway Sync Cron
```json
{
  "schedule": { "kind": "every", "everyMs": 1800000 },
  "payload": { "kind": "systemEvent", "text": "Run gateway usage sync" },
  "sessionTarget": "main"
}
```

### Dashboard in Heartbeat
Marcus can check the dashboard during heartbeats:
```javascript
// In HEARTBEAT.md or heartbeat logic
// Check: node /workspace/skills/usage-tracking/dashboard.js --json
// Alert if daily spend > threshold
```

### Mission Control Integration
Dashboard JSON output can feed into MC's System view for a visual cost panel.

## 13. Configuration (`config.json`)

```json
{
  "database": {
    "path": "/Volumes/reeseai-memory/data/usage-tracking/usage.db"
  },
  "logging": {
    "jsonl_dir": "/Volumes/reeseai-memory/data/usage-tracking/logs",
    "buffer_size": 50,
    "flush_interval_ms": 5000,
    "store_prompt_preview": true,
    "preview_length": 200
  },
  "archive": {
    "retention_days": 90,
    "archive_dir": "/Volumes/reeseai-memory/data/usage-tracking/archive"
  },
  "gateway_sync": {
    "url": "http://localhost:18789",
    "interval_minutes": 30,
    "last_sync_file": "/Volumes/reeseai-memory/data/usage-tracking/.last-sync"
  },
  "budgets": {
    "daily_usd": 10.00,
    "monthly_usd": 150.00,
    "alert_threshold_pct": 80
  },
  "redaction": {
    "redact_emails": true,
    "redact_paths": true,
    "redact_amounts": true,
    "redact_keys": true,
    "custom_patterns": []
  }
}
```

## 14. File Structure

```
/workspace/skills/usage-tracking/
├── db.js                  # Database initialization + schema
├── logger.js              # Fire-and-forget logging singleton
├── cost-estimator.js      # Per-model pricing calculations
├── gateway-sync.js        # Pull OpenClaw gateway usage
├── report.js              # Query, aggregate, filter reports
├── dashboard.js           # CLI dashboard + JSON output
├── archive.js             # 90-day rolling archive
├── redact.js              # Secret/PII redaction
├── config.json            # All configuration
├── SKILL.md               # Integration guide for agents
├── README.md              # Overview and usage
├── package.json           # Dependencies (better-sqlite3)
└── node_modules/
```

## 15. Dependencies

- `better-sqlite3` (fast synchronous SQLite, already used elsewhere)
- Node.js built-ins: `crypto` (for hashing), `fs`, `path`
- No external API dependencies (reads from gateway, doesn't call external services)

## 16. Testing Checklist

- [ ] Logger: fire-and-forget doesn't block caller
- [ ] Logger: handles DB write failures gracefully
- [ ] Redaction: all secret patterns caught
- [ ] Redaction: safe content passes through unchanged
- [ ] Cost estimator: matches known Anthropic/OpenAI pricing
- [ ] Cost estimator: local models return $0
- [ ] Gateway sync: deduplicates correctly
- [ ] Report: date range filtering works
- [ ] Report: agent/model/task filters work
- [ ] Dashboard: JSON output valid
- [ ] Archive: old rows moved correctly
- [ ] Archive: main db shrinks after VACUUM
- [ ] JSONL: one file per day, proper rotation
