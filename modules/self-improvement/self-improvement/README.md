# Self-Improvement Systems

Automated systems for continuous agent improvement, platform health monitoring, security auditing, and proactive error reporting.

## Overview

This skill provides a comprehensive self-improvement infrastructure that enables agents to:
- Learn from mistakes and user feedback
- Monitor platform health automatically
- Conduct security reviews from multiple perspectives
- Identify automation opportunities
- Run tiered testing (free → low-cost → full end-to-end)
- Report failures proactively

## Components

### 📚 Learnings Directory

- **capture.js** - Capture corrections and insights from user feedback
- **error-tracker.js** - Detect and log recurring error patterns
- **feature-log.js** - Track feature requests and improvement ideas
- **LEARNINGS.md** - Automatically curated learning history
- **ERRORS.md** - Recurring error pattern log
- **FEATURE_REQUESTS.md** - Innovation backlog

### 🏛️ Review Councils

- **health-review.js** - Platform health across 6 dimensions
- **security-review.js** - Multi-perspective security analysis
- **innovation-scout.js** - Automation opportunity scanner
- **council-runner.js** - Orchestrates all councils

### 🧪 Tiered Testing

- **tier1-nightly.js** - Integration tests (NO LLM calls, free)
- **tier2-weekly.js** - Live LLM provider tests (low cost)
- **tier3-weekly.js** - Full end-to-end tests (moderate cost)
- **test-runner.js** - Unified test orchestrator

### 🚨 Error Reporter

- **error-reporter.js** - Proactive failure notification system
- Formats errors for human readability
- Logs to error tracker and logging system
- Provides wrapWithReporting() for automatic error handling

## Quick Start

```bash
# Run all councils
npm run councils

# Run health review only
npm run councils:health

# Run tier 1 tests (free, nightly)
npm run test:tier1

# Run all tests
npm test
```

## Usage Examples

### Capture a Learning

```javascript
const LearningsCapture = require('./learnings/capture');

LearningsCapture.addCorrection({
  context: 'KB RAG migration script',
  lesson: 'Always verify output after migration/batch jobs, not just exit code',
  applied: 'Added post-migration verification step to all batch scripts',
  agent: 'brunel'
});
```

### Track Errors

```javascript
const ErrorTracker = require('./learnings/error-tracker');
const tracker = new ErrorTracker();

// Scan tool output for known patterns
const errors = tracker.scan(toolOutput, { source: 'build-script' });

// Get frequency report
const report = tracker.getFrequencyReport();
```

### Wrap Background Tasks with Error Reporting

```javascript
const ErrorReporter = require('./error-reporter');

const safeTask = ErrorReporter.wrapWithReporting(
  async () => {
    // Your risky task here
    await performMigration();
  },
  {
    title: 'Database Migration',
    agent: 'brunel',
    description: 'migrate.js processing 269 files'
  }
);

await safeTask();
```

### Run Health Review

```javascript
const HealthReview = require('./councils/health-review');

const review = new HealthReview();
const report = await review.run();

console.log(`Health: ${report.healthPct}%`);
console.log(`Issues: ${report.issues.length}`);
```

## Integration

### Cron Jobs

Add to your cron configuration:

```json
[
  {
    "name": "self-improvement-councils",
    "schedule": { "kind": "cron", "expr": "0 2 * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run councils: node /workspace/skills/self-improvement/councils/council-runner.js" }
  },
  {
    "name": "tier1-tests-nightly",
    "schedule": { "kind": "cron", "expr": "0 3 * * *", "tz": "America/New_York" },
    "payload": { "kind": "agentTurn", "message": "Run tier 1 tests: node /workspace/skills/self-improvement/testing/test-runner.js 1" }
  }
]
```

### Import in Other Skills

```javascript
// Error reporting
const ErrorReporter = require('/workspace/skills/self-improvement/error-reporter');

// Learnings capture
const LearningsCapture = require('/workspace/skills/self-improvement/learnings/capture');

// Error tracker
const ErrorTracker = require('/workspace/skills/self-improvement/learnings/error-tracker');
```

## Configuration

Edit `config.json` to customize paths and settings:

```json
{
  "learnings_dir": "/Users/marcusrawlins/.openclaw/workspace/skills/self-improvement/learnings",
  "reports_dir": "/Volumes/reeseai-memory/agents/reviews/councils",
  "test_reports_dir": "/Volumes/reeseai-memory/agents/reviews/tests",
  "error_reporting": {
    "telegram_chat_id": "8172900205",
    "min_severity": "error",
    "batch_window_seconds": 60
  }
}
```

## File Structure

```
self-improvement/
├── learnings/
│   ├── capture.js
│   ├── error-tracker.js
│   ├── feature-log.js
│   ├── LEARNINGS.md
│   ├── ERRORS.md
│   └── FEATURE_REQUESTS.md
├── councils/
│   ├── health-review.js
│   ├── security-review.js
│   ├── innovation-scout.js
│   └── council-runner.js
├── testing/
│   ├── tier1-nightly.js
│   ├── tier2-weekly.js
│   ├── tier3-weekly.js
│   └── test-runner.js
├── error-reporter.js
├── config.json
├── package.json
├── SKILL.md
└── README.md
```

## Reports

All reports are saved to the memory drive:

- **Council reports:** `/Volumes/reeseai-memory/agents/reviews/councils/YYYY-MM-DD-council-report.md`
- **Test reports:** `/Volumes/reeseai-memory/agents/reviews/tests/YYYY-MM-DD-test-report.json`

## Dependencies

- `better-sqlite3` - For database integrity checks in tests
- Node.js built-ins: `fs`, `path`, `child_process`
- Optional: `/workspace/skills/logging/logger` (graceful fallback)
- Optional: `/workspace/skills/llm-router/router` (for Tier 2+ tests)

## Best Practices

1. **Always report failures** - Background tasks MUST use ErrorReporter
2. **Capture learnings immediately** - Don't wait, write it down
3. **Run councils weekly** - Automated reviews catch issues early
4. **Tier 1 tests nightly** - Keep them fast and free
5. **Review reports** - Councils generate insights, but humans decide

## Author

Marcus Rawlins (Opus) - 2026-02-26
