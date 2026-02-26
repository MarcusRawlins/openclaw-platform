# Logging Infrastructure
## Specification v1.0

**Author:** Marcus Rawlins (Opus)
**Date:** 2026-02-26
**Priority:** HIGH
**Estimated Build:** 2-3 days (Brunel)
**Location:** `/workspace/skills/logging/`

---

## 1. Overview

Centralized logging infrastructure for the entire OpenClaw agent ecosystem. Every system, skill, and cron job writes structured events to a unified log pipeline. Events flow into per-event JSONL files and a unified stream, get rotated daily, and are ingested nightly into SQLite for querying. Secret redaction is applied before any write.

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                     logging/                          │
├──────────────────────────────────────────────────────┤
│  logger.js           Core logging library (Node.js)  │
│  logger.sh           Shell helper (source in scripts)│
│  redact.js           Secret/PII redaction engine     │
│  viewer.js           CLI log viewer + filters        │
│  ingest.js           Nightly JSONL → SQLite ingest   │
│  rotate.js           Daily log rotation + archival   │
│  db.js               SQLite schema + query helpers   │
│  config.json         Paths, thresholds, retention    │
│  SKILL.md            Integration guide for agents    │
│  README.md           Overview and usage              │
│  package.json        Dependencies                    │
└──────────────────────────────────────────────────────┘

Data flow:

  Any system
      │
      ▼
  logger.js / logger.sh
      │
      ├──▶ data/logs/<event_name>.jsonl   (per-event file)
      │
      └──▶ data/logs/all.jsonl            (unified stream)
                │
                ▼ (nightly)
          ingest.js → logs.db
                │
                ▼ (daily)
          rotate.js → archive/
```

## 3. Log Directory Structure

```
/Volumes/reeseai-memory/data/logs/
├── all.jsonl                      # Unified stream (every event)
├── agent.chat.jsonl               # Agent chat events
├── agent.heartbeat.jsonl          # Heartbeat events
├── agent.cron.jsonl               # Cron job executions
├── agent.subagent.jsonl           # Sub-agent spawns/completions
├── email.inbound.jsonl            # Inbound email pipeline events
├── email.outbound.jsonl           # Outbound email events
├── lead.scored.jsonl              # Lead scoring events
├── lead.stage_change.jsonl        # Stage transitions
├── build.start.jsonl              # Brunel build starts
├── build.complete.jsonl           # Brunel build completions
├── review.start.jsonl             # Walt review starts
├── review.complete.jsonl          # Walt review completions
├── kb.query.jsonl                 # Knowledge base queries
├── kb.ingest.jsonl                # Knowledge base ingestions
├── content.idea.jsonl             # Content pipeline ideas
├── council.run.jsonl              # BI Council runs
├── briefing.run.jsonl             # Daily briefing runs
├── system.error.jsonl             # System errors
├── system.startup.jsonl           # System/service startups
├── usage.llm.jsonl                # LLM usage (mirrors usage-tracking JSONL)
├── usage.api.jsonl                # API usage
├── security.quarantine.jsonl      # Security quarantine events
├── security.blocked.jsonl         # Blocked/suspicious events
├── archive/                       # Rotated log archives
│   ├── 2026-02/
│   │   ├── all.2026-02-25.jsonl.gz
│   │   ├── agent.chat.2026-02-25.jsonl.gz
│   │   └── ...
│   └── 2026-03/
└── logs.db                        # SQLite structured log database
```

## 4. Event Schema

Every log entry follows the same structure:

```json
{
  "ts": "2026-02-26T15:30:00.123Z",
  "event": "lead.scored",
  "level": "info",
  "agent": "marcus",
  "source": "email-pipeline/scorer.js",
  "data": {
    "email_id": 42,
    "from": "jane@example.com",
    "score": 85,
    "bucket": "exceptional"
  },
  "session": "agent:main:main",
  "duration_ms": 1200,
  "error": null
}
```

### Required Fields
| Field | Type | Description |
|---|---|---|
| `ts` | string | ISO 8601 timestamp with milliseconds |
| `event` | string | Dot-notation event name (determines per-event file) |
| `level` | string | `debug`, `info`, `warn`, `error`, `fatal` |

### Optional Fields
| Field | Type | Description |
|---|---|---|
| `agent` | string | Which agent produced the event |
| `source` | string | File/module that emitted the event |
| `data` | object | Event-specific payload (any shape) |
| `session` | string | OpenClaw session key |
| `duration_ms` | number | How long the operation took |
| `error` | string/null | Error message if level is error/fatal |

### Standard Event Names

| Event | When |
|---|---|
| `agent.chat` | Agent sends/receives a message |
| `agent.heartbeat` | Heartbeat poll fires |
| `agent.cron` | Cron job executes |
| `agent.subagent` | Sub-agent spawned or completed |
| `email.inbound` | New email fetched |
| `email.outbound` | Email sent or draft created |
| `lead.scored` | Lead scored by pipeline |
| `lead.stage_change` | Deal stage transition |
| `build.start` | Brunel starts a build task |
| `build.complete` | Brunel completes a build |
| `review.start` | Walt starts a review |
| `review.complete` | Walt completes a review |
| `kb.query` | Knowledge base searched |
| `kb.ingest` | Knowledge base file ingested |
| `content.idea` | Content idea processed |
| `council.run` | BI Council nightly run |
| `briefing.run` | Daily briefing generated |
| `system.error` | Unhandled error caught |
| `system.startup` | Service/system starts |
| `usage.llm` | LLM call logged |
| `usage.api` | API call logged |
| `security.quarantine` | Email quarantined |
| `security.blocked` | Security event blocked |

Custom event names are allowed. Any `event` value automatically creates its JSONL file on first write.

## 5. Core Logging Library (`logger.js`)

### API

```javascript
const Logger = require('/workspace/skills/logging/logger');
const log = Logger.getInstance();

// Basic logging
log.info('lead.scored', { email_id: 42, score: 85, bucket: 'exceptional' });
log.warn('system.error', { message: 'LM Studio connection timeout', retries: 3 });
log.error('build.complete', { task: 'bi-council', error: 'Compilation failed' });
log.debug('kb.query', { query: 'wedding pricing', results: 12, duration_ms: 450 });

// With agent context
log.info('agent.subagent', {
  action: 'spawned',
  agent: 'brunel',
  task: 'Build usage tracking system'
}, { agent: 'marcus', source: 'main-session' });

// Fatal (also writes to stderr)
log.fatal('system.error', { message: 'Database corruption detected' });
```

### Implementation Details

```javascript
const fs = require('fs');
const path = require('path');
const { redact } = require('./redact');
const config = require('./config.json');

class Logger {
  static _instance = null;
  
  static getInstance() {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  constructor() {
    this.logDir = config.log_dir;
    this.buffer = [];
    this.bufferSize = config.buffer_size || 20;
    this.flushInterval = config.flush_interval_ms || 3000;
    this.minLevel = config.min_level || 'info';
    this._openStreams = new Map();  // event_name → WriteStream
    this._allStream = null;
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Open unified stream
    this._allStream = fs.createWriteStream(
      path.join(this.logDir, 'all.jsonl'),
      { flags: 'a' }
    );
    
    // Periodic flush
    this._flushTimer = setInterval(() => this.flush(), this.flushInterval);
    
    // Flush on exit
    process.on('beforeExit', () => this.flush());
    process.on('SIGTERM', () => { this.flush(); process.exit(0); });
    process.on('SIGINT', () => { this.flush(); process.exit(0); });
  }

  _levelNum(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
    return levels[level] || 1;
  }

  _shouldLog(level) {
    return this._levelNum(level) >= this._levelNum(this.minLevel);
  }

  _getEventStream(eventName) {
    if (!this._openStreams.has(eventName)) {
      const filename = `${eventName}.jsonl`;
      const stream = fs.createWriteStream(
        path.join(this.logDir, filename),
        { flags: 'a' }
      );
      this._openStreams.set(eventName, stream);
    }
    return this._openStreams.get(eventName);
  }

  _write(level, event, data, meta = {}) {
    if (!this._shouldLog(level)) return;

    const entry = {
      ts: new Date().toISOString(),
      event,
      level,
      ...meta,
      data: redact(data),
      error: data.error || null
    };

    const line = JSON.stringify(entry) + '\n';

    // Write to per-event file
    try {
      const eventStream = this._getEventStream(event);
      eventStream.write(line);
    } catch (err) {
      // Logging should never crash the caller
      process.stderr.write(`[logging] Failed to write to ${event}.jsonl: ${err.message}\n`);
    }

    // Mirror to unified stream
    try {
      this._allStream.write(line);
    } catch (err) {
      process.stderr.write(`[logging] Failed to write to all.jsonl: ${err.message}\n`);
    }

    // Fatal also goes to stderr
    if (level === 'fatal') {
      process.stderr.write(`[FATAL] ${event}: ${JSON.stringify(data)}\n`);
    }
  }

  debug(event, data = {}, meta = {}) { this._write('debug', event, data, meta); }
  info(event, data = {}, meta = {})  { this._write('info', event, data, meta); }
  warn(event, data = {}, meta = {})  { this._write('warn', event, data, meta); }
  error(event, data = {}, meta = {}) { this._write('error', event, data, meta); }
  fatal(event, data = {}, meta = {}) { this._write('fatal', event, data, meta); }

  flush() {
    // Flush all open streams
    for (const stream of this._openStreams.values()) {
      if (stream.writable) stream.cork(); stream.uncork();
    }
    if (this._allStream && this._allStream.writable) {
      this._allStream.cork(); this._allStream.uncork();
    }
  }

  close() {
    clearInterval(this._flushTimer);
    for (const stream of this._openStreams.values()) {
      stream.end();
    }
    this._openStreams.clear();
    if (this._allStream) this._allStream.end();
  }
}

module.exports = Logger;
```

### Key Design Decisions
- **Write streams, not sync writes:** append-mode WriteStreams for performance
- **Never throw:** all write errors caught and sent to stderr only
- **Auto-create event files:** first log to a new event name creates its JSONL file
- **Singleton:** one logger per process, shared across all modules
- **Signal handling:** flush on SIGTERM/SIGINT to prevent data loss

## 6. Shell Helper (`logger.sh`)

For shell scripts, cron jobs, and non-Node contexts:

```bash
#!/usr/bin/env bash
# Source this in shell scripts: source /workspace/skills/logging/logger.sh

LOG_DIR="/Volumes/reeseai-memory/data/logs"

log_event() {
  local level="$1"
  local event="$2"
  local message="$3"
  local agent="${4:-system}"
  
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  
  local entry
  entry=$(cat <<EOF
{"ts":"${ts}","event":"${event}","level":"${level}","agent":"${agent}","data":{"message":"${message}"}}
EOF
)
  
  # Write to per-event file
  echo "$entry" >> "${LOG_DIR}/${event}.jsonl"
  
  # Mirror to unified stream
  echo "$entry" >> "${LOG_DIR}/all.jsonl"
}

log_info()  { log_event "info"  "$@"; }
log_warn()  { log_event "warn"  "$@"; }
log_error() { log_event "error" "$@"; }
log_debug() { log_event "debug" "$@"; }
```

### Usage in Shell Scripts

```bash
#!/usr/bin/env bash
source /workspace/skills/logging/logger.sh

log_info "briefing.run" "Starting daily briefing generation" "marcus"
# ... do work ...
log_info "briefing.run" "Daily briefing complete, delivered to Telegram" "marcus"
```

## 7. Secret Redaction (`redact.js`)

Shared with the usage-tracking system. If usage-tracking is built first, import from there. Otherwise, standalone implementation.

```javascript
const PATTERNS = [
  // API keys and tokens (20+ char alphanumeric after key-like prefix)
  { re: /(?:sk|pk|api|key|token|secret|password|bearer)[-_]?[\w]{20,}/gi, sub: '[REDACTED_KEY]' },
  // Standalone long hex/base64 strings (likely tokens)
  { re: /\b[A-Za-z0-9+/]{40,}={0,2}\b/g, sub: '[REDACTED_TOKEN]' },
  // Email addresses
  { re: /[\w.+-]+@[\w.-]+\.\w{2,}/g, sub: '[REDACTED_EMAIL]' },
  // File paths with usernames
  { re: /\/Users\/\w+/g, sub: '/Users/[USER]' },
  // Private IPs
  { re: /\b(?:192\.168|10\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g, sub: '[PRIVATE_IP]' },
  // Dollar amounts
  { re: /\$[\d,]+(?:\.\d{2})?/g, sub: '[AMOUNT]' },
  // Localhost with ports
  { re: /localhost:\d+/g, sub: 'localhost:[PORT]' },
  // Env var assignments with secrets
  { re: /(?:STRIPE|OPENAI|ANTHROPIC|SERPAPI|TAVILY|GOOGLE)_[\w]*(?:KEY|SECRET|TOKEN)\s*[=:]\s*\S+/gi, sub: '[REDACTED_ENV]' }
];

function redact(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return redactString(data);
  if (typeof data === 'number' || typeof data === 'boolean') return data;
  if (Array.isArray(data)) return data.map(redact);
  if (typeof data === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = redact(v);
    }
    return out;
  }
  return data;
}

function redactString(str) {
  let result = str;
  for (const { re, sub } of PATTERNS) {
    result = result.replace(re, sub);
  }
  return result;
}

module.exports = { redact, redactString, PATTERNS };
```

## 8. Log Viewer CLI (`viewer.js`)

### Interface

```bash
# View all recent logs
node viewer.js --last 1h

# Filter by event
node viewer.js --event lead.scored --last 24h

# Filter by level
node viewer.js --level error --last 7d

# Filter by content
node viewer.js --grep "timeout" --last 24h

# Filter by agent
node viewer.js --agent brunel --last 12h

# Combine filters
node viewer.js --event build.complete --level error --agent brunel --last 7d

# Time range
node viewer.js --from 2026-02-25T00:00:00Z --to 2026-02-26T00:00:00Z

# JSON output (for piping/scripting)
node viewer.js --event lead.scored --last 24h --json

# Tail mode (watch live)
node viewer.js --tail

# Tail specific event
node viewer.js --tail --event system.error

# Count events
node viewer.js --count --event agent.heartbeat --last 24h

# From SQLite (for older/aggregated data)
node viewer.js --db --event lead.scored --last 30d
```

### Implementation

```javascript
// Reads from JSONL files for recent data, SQLite for historical
// Two modes: JSONL scan (fast for recent) and DB query (indexed for old)

class LogViewer {
  constructor(options) {
    this.logDir = config.log_dir;
    this.options = options;
  }

  // JSONL mode: stream-parse the relevant file(s)
  async viewFromJSONL() {
    const files = this._getRelevantFiles();
    const results = [];
    
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (this._matchesFilters(entry)) {
            results.push(entry);
          }
        } catch (e) { /* skip malformed lines */ }
      }
    }
    
    return results.sort((a, b) => a.ts.localeCompare(b.ts));
  }

  // DB mode: query SQLite
  async viewFromDB() {
    const db = new LogDB();
    return db.query(this.options);
  }

  // Tail mode: watch file for new lines
  async tail() {
    const file = this.options.event
      ? path.join(this.logDir, `${this.options.event}.jsonl`)
      : path.join(this.logDir, 'all.jsonl');
    
    // Use fs.watch + read new bytes
    let pos = fs.statSync(file).size;
    
    console.log(`Tailing ${path.basename(file)}... (Ctrl+C to stop)\n`);
    
    fs.watch(file, () => {
      const stat = fs.statSync(file);
      if (stat.size > pos) {
        const fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(stat.size - pos);
        fs.readSync(fd, buf, 0, buf.length, pos);
        fs.closeSync(fd);
        pos = stat.size;
        
        const lines = buf.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (this._matchesFilters(entry)) {
              this._printEntry(entry);
            }
          } catch (e) { /* skip */ }
        }
      }
    });
  }

  _matchesFilters(entry) {
    if (this.options.event && entry.event !== this.options.event) return false;
    if (this.options.level && entry.level !== this.options.level) return false;
    if (this.options.agent && entry.agent !== this.options.agent) return false;
    if (this.options.grep && !JSON.stringify(entry).includes(this.options.grep)) return false;
    if (this.options.from && entry.ts < this.options.from) return false;
    if (this.options.to && entry.ts > this.options.to) return false;
    return true;
  }

  _printEntry(entry) {
    if (this.options.json) {
      console.log(JSON.stringify(entry));
    } else {
      const level = entry.level.toUpperCase().padEnd(5);
      const time = entry.ts.substring(11, 23);  // HH:MM:SS.mmm
      const event = entry.event.padEnd(25);
      const agent = (entry.agent || '').padEnd(8);
      const msg = entry.data?.message || JSON.stringify(entry.data || {}).substring(0, 80);
      console.log(`${time} ${level} ${agent} ${event} ${msg}`);
    }
  }
}
```

### Output Formats

**Human-readable (default):**
```
15:30:00.123 INFO  marcus   lead.scored               {"email_id":42,"score":85,"bucket":"exceptional"}
15:30:05.456 WARN  brunel   build.complete            {"task":"bi-council","warnings":2}
15:31:00.789 ERROR system   system.error              LM Studio connection timeout
```

**JSON mode (`--json`):**
```json
{"ts":"2026-02-26T15:30:00.123Z","event":"lead.scored","level":"info","agent":"marcus","data":{"email_id":42,"score":85}}
```

## 9. Nightly Database Ingest (`ingest.js`)

### Purpose
Parse JSONL files into SQLite for indexed querying of historical data.

### SQLite Schema

```sql
CREATE TABLE structured_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  event TEXT NOT NULL,
  level TEXT NOT NULL,
  agent TEXT,
  source TEXT,
  session TEXT,
  duration_ms INTEGER,
  error TEXT,
  data_json TEXT,              -- full data payload as JSON string
  ingested_at TEXT DEFAULT (datetime('now')),
  source_file TEXT             -- which JSONL file this came from
);

-- For raw server/gateway logs
CREATE TABLE raw_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT,
  source TEXT NOT NULL,        -- 'gateway', 'lmstudio', 'nginx', etc.
  level TEXT,
  message TEXT,
  raw_line TEXT,
  ingested_at TEXT DEFAULT (datetime('now'))
);

-- Track what's been ingested to avoid duplicates
CREATE TABLE ingest_state (
  file_path TEXT PRIMARY KEY,
  last_byte_offset INTEGER DEFAULT 0,
  last_ingested_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast querying
CREATE INDEX idx_logs_ts ON structured_logs(ts);
CREATE INDEX idx_logs_event ON structured_logs(event);
CREATE INDEX idx_logs_level ON structured_logs(level);
CREATE INDEX idx_logs_agent ON structured_logs(agent);
CREATE INDEX idx_logs_event_ts ON structured_logs(event, ts);
CREATE INDEX idx_raw_ts ON raw_logs(ts);
CREATE INDEX idx_raw_source ON raw_logs(source);
```

### Ingest Process

```javascript
async function ingestNightly() {
  const logDir = config.log_dir;
  const db = new LogDB();
  
  // 1. Get all JSONL files
  const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl'));
  
  for (const file of files) {
    const filePath = path.join(logDir, file);
    
    // 2. Check last ingested offset
    const state = db.getIngestState(filePath);
    const lastOffset = state ? state.last_byte_offset : 0;
    
    // 3. Read new bytes only
    const stat = fs.statSync(filePath);
    if (stat.size <= lastOffset) continue;  // nothing new
    
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(stat.size - lastOffset);
    fs.readSync(fd, buf, 0, buf.length, lastOffset);
    fs.closeSync(fd);
    
    // 4. Parse and insert
    const lines = buf.toString().split('\n').filter(Boolean);
    let inserted = 0;
    
    const insertStmt = db.db.prepare(`
      INSERT OR IGNORE INTO structured_logs 
      (ts, event, level, agent, source, session, duration_ms, error, data_json, source_file)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.db.transaction((entries) => {
      for (const entry of entries) {
        insertStmt.run(
          entry.ts, entry.event, entry.level, entry.agent || null,
          entry.source || null, entry.session || null,
          entry.duration_ms || null, entry.error || null,
          JSON.stringify(entry.data || {}), file
        );
        inserted++;
      }
    });
    
    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) { /* skip malformed */ }
    }
    
    insertMany(entries);
    
    // 5. Update offset
    db.updateIngestState(filePath, stat.size);
    
    console.log(`  ${file}: +${inserted} entries`);
  }
  
  // 6. Ingest raw server logs (gateway, LM Studio)
  await ingestRawLogs(db);
  
  db.close();
}
```

### Raw Server Log Parsing
Parses known log formats:

```javascript
const RAW_LOG_SOURCES = [
  {
    name: 'gateway',
    path: '/Users/marcusrawlins/.openclaw/logs/*.log',
    parser: parseGatewayLog    // OpenClaw gateway log format
  },
  {
    name: 'lmstudio',
    path: '/Users/marcusrawlins/.cache/lm-studio/logs/*.log',
    parser: parseLMStudioLog   // LM Studio log format
  }
];
```

### Deduplication
- `INSERT OR IGNORE` with a composite uniqueness check on `(ts, event, agent, data_json)`
- `ingest_state` table tracks byte offset per file to avoid re-reading processed lines
- Handles rotated files: if file is smaller than last offset, assume rotation and re-read from 0

## 10. Log Rotation (`rotate.js`)

### Daily Rotation Cron

```bash
# Runs daily at 4 AM via cron automation system
node /workspace/skills/logging/rotate.js
```

### Rotation Logic

```javascript
async function rotateAll() {
  const logDir = config.log_dir;
  const archiveDir = path.join(logDir, 'archive');
  const maxSizeBytes = config.rotation.max_size_mb * 1024 * 1024;  // default 50MB
  const keepRotations = config.rotation.keep_recent;  // default 3
  
  const files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl'));
  
  for (const file of files) {
    const filePath = path.join(logDir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.size < maxSizeBytes) continue;  // under threshold, skip
    
    // Create monthly archive directory
    const month = new Date().toISOString().substring(0, 7);  // YYYY-MM
    const monthDir = path.join(archiveDir, month);
    if (!fs.existsSync(monthDir)) fs.mkdirSync(monthDir, { recursive: true });
    
    // Rotate: rename current → dated archive
    const date = new Date().toISOString().split('T')[0];
    const archiveName = `${file.replace('.jsonl', '')}.${date}.jsonl`;
    const archivePath = path.join(monthDir, archiveName);
    
    // Copy to archive
    fs.copyFileSync(filePath, archivePath);
    
    // Compress archive
    const { execSync } = require('child_process');
    execSync(`gzip "${archivePath}"`);
    
    // Truncate original (keep last 1000 lines for continuity)
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const keepLines = lines.slice(-1000).join('\n');
    fs.writeFileSync(filePath, keepLines + '\n');
    
    console.log(`  Rotated ${file}: ${(stat.size / 1024 / 1024).toFixed(1)}MB → archive + kept last 1000 lines`);
  }
  
  // Clean old rotations beyond keep_recent
  cleanOldArchives(archiveDir, keepRotations);
}

function cleanOldArchives(archiveDir, keepCount) {
  if (!fs.existsSync(archiveDir)) return;
  
  const months = fs.readdirSync(archiveDir).sort().reverse();
  
  // Keep the most recent N months
  const toDelete = months.slice(keepCount);
  for (const month of toDelete) {
    const monthPath = path.join(archiveDir, month);
    fs.rmSync(monthPath, { recursive: true });
    console.log(`  Cleaned old archive: ${month}`);
  }
}
```

### Archive of Database Rows
In addition to JSONL rotation, the `structured_logs` table gets archived:

```javascript
async function archiveOldRows() {
  const retentionDays = config.rotation.db_retention_days || 90;
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
  
  const db = new LogDB();
  
  // Create monthly archive DB
  const month = cutoff.substring(0, 7);
  const archiveDbPath = path.join(config.log_dir, 'archive', `logs-${month}.db`);
  const archiveDb = new Database(archiveDbPath);
  
  // Copy schema
  archiveDb.exec(db.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='structured_logs'").get().sql);
  
  // Move old rows
  const rows = db.db.prepare(`SELECT * FROM structured_logs WHERE ts < ?`).all(cutoff);
  
  const insert = archiveDb.prepare(`
    INSERT INTO structured_logs (ts, event, level, agent, source, session, duration_ms, error, data_json, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertAll = archiveDb.transaction((rows) => {
    for (const row of rows) {
      insert.run(row.ts, row.event, row.level, row.agent, row.source, row.session, row.duration_ms, row.error, row.data_json, row.source_file);
    }
  });
  
  insertAll(rows);
  
  // Delete from main
  db.db.prepare(`DELETE FROM structured_logs WHERE ts < ?`).run(cutoff);
  db.db.exec('VACUUM');
  
  console.log(`  Archived ${rows.length} rows older than ${retentionDays} days`);
  
  archiveDb.close();
  db.close();
}
```

## 11. Configuration (`config.json`)

```json
{
  "log_dir": "/Volumes/reeseai-memory/data/logs",
  "db_path": "/Volumes/reeseai-memory/data/logs/logs.db",
  "min_level": "info",
  "buffer_size": 20,
  "flush_interval_ms": 3000,
  "rotation": {
    "max_size_mb": 50,
    "keep_recent": 3,
    "db_retention_days": 90,
    "archive_compression": true
  },
  "raw_log_sources": [
    {
      "name": "gateway",
      "glob": "/Users/marcusrawlins/.openclaw/logs/*.log"
    },
    {
      "name": "lmstudio",
      "glob": "/Users/marcusrawlins/.cache/lm-studio/logs/*.log"
    }
  ],
  "redaction": {
    "enabled": true
  }
}
```

## 12. Cron Integration

```json
[
  {
    "name": "log-ingest-nightly",
    "schedule": { "kind": "cron", "expr": "0 3 * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run nightly log ingest: node /workspace/skills/logging/ingest.js" },
    "sessionTarget": "isolated"
  },
  {
    "name": "log-rotate-daily",
    "schedule": { "kind": "cron", "expr": "0 4 * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run daily log rotation: node /workspace/skills/logging/rotate.js" },
    "sessionTarget": "isolated"
  }
]
```

## 13. Integration with Other Systems

### Usage Tracking Integration
The usage-tracking system's JSONL output can be symlinked or the logger can replace it:

```javascript
// In usage-tracking/logger.js, add:
const log = require('/workspace/skills/logging/logger').getInstance();

// Each LLM call also emits a logging event
log.info('usage.llm', { agent, provider, model, inputTokens, outputTokens, cost });
```

### Email Pipeline Integration
```javascript
const log = require('/workspace/skills/logging/logger').getInstance();

log.info('email.inbound', { account: 'photography', from: email.from, subject: email.subject });
log.info('lead.scored', { email_id: id, score: 85, bucket: 'exceptional' });
log.info('lead.stage_change', { email_id: id, from: 'New', to: 'Contacted' });
```

### BI Council Integration
```javascript
log.info('council.run', { session_id: 5, experts: 6, recommendations: 3, duration_ms: 45000 });
```

### Daily Briefing Integration
```javascript
log.info('briefing.run', { sections: 10, delivered: true, duration_ms: 12000 });
```

## 14. File Structure

```
/workspace/skills/logging/
├── logger.js              # Core logging library (Node.js)
├── logger.sh              # Shell helper script
├── redact.js              # Secret/PII redaction
├── viewer.js              # CLI log viewer + filters
├── ingest.js              # Nightly JSONL → SQLite ingest
├── rotate.js              # Daily log rotation + archival
├── db.js                  # SQLite schema + query helpers
├── config.json            # All configuration
├── SKILL.md               # Integration guide for agents
├── README.md              # Overview and usage
└── package.json           # Dependencies (better-sqlite3)
```

## 15. Dependencies

- `better-sqlite3` (database, already available)
- Node.js built-ins: `fs`, `path`, `crypto`, `child_process` (for gzip)
- No external services

## 16. Testing Checklist

- [ ] Logger: writes to per-event and all.jsonl simultaneously
- [ ] Logger: never throws (errors go to stderr only)
- [ ] Logger: auto-creates event files on first write
- [ ] Logger: flush on SIGTERM preserves buffered entries
- [ ] Shell helper: produces valid JSONL
- [ ] Redaction: all secret patterns caught
- [ ] Redaction: recursively redacts nested objects
- [ ] Viewer: filters by event, level, agent, grep, time range
- [ ] Viewer: JSON output mode produces valid JSON per line
- [ ] Viewer: tail mode shows new entries in real time
- [ ] Viewer: --count mode returns correct counts
- [ ] Ingest: parses JSONL into structured_logs correctly
- [ ] Ingest: deduplicates on re-run
- [ ] Ingest: tracks byte offsets per file
- [ ] Ingest: handles rotated files (smaller than last offset)
- [ ] Rotation: only rotates files exceeding threshold
- [ ] Rotation: compresses archives with gzip
- [ ] Rotation: keeps last 1000 lines in active file
- [ ] Rotation: cleans archives beyond keep_recent
- [ ] DB archive: moves old rows to monthly archive DB
- [ ] DB archive: VACUUMs main DB after deletion
