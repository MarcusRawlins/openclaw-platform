# Self-Improvement Systems - Integration Guide

## Purpose

Automated systems for continuous agent improvement, platform health monitoring, security auditing, and proactive error reporting.

## Key Features

- **Learnings Capture** - Learn from mistakes and user feedback
- **Error Tracking** - Detect recurring error patterns automatically
- **Review Councils** - Health, security, and innovation reviews
- **Tiered Testing** - Free → low-cost → full end-to-end tests
- **Error Reporting** - Proactive failure notification

## When to Use

### Use Learnings Capture When:
- User corrects your output or approach
- You discover a better pattern or technique
- A migration or batch job reveals an insight
- Tyler gives feedback on writing, design, or process

### Use Error Tracker When:
- Running shell commands or external tools
- Processing batch operations
- Building or migrating systems
- Analyzing logs or output

### Use Error Reporter When:
- Running cron jobs or background tasks
- Executing subagent tasks
- Performing migrations or batch operations
- Any task that might fail silently

### Run Councils When:
- Weekly automated review (cron)
- After major system changes
- Investigating platform issues
- Preparing for audits or reviews

### Run Tests When:
- Tier 1: Nightly (free, fast integration tests)
- Tier 2: Weekly (low-cost LLM provider tests)
- Tier 3: Weekly (full end-to-end tests)

## Quick Reference

### Capture a Correction

```javascript
const LearningsCapture = require('/workspace/skills/self-improvement/learnings/capture');

LearningsCapture.addCorrection({
  context: 'What happened',
  lesson: 'What you learned',
  applied: 'What you changed',
  agent: 'your-name'
});
```

### Wrap Background Tasks

```javascript
const ErrorReporter = require('/workspace/skills/self-improvement/error-reporter');

const safeTask = ErrorReporter.wrapWithReporting(
  async () => { /* your task */ },
  { title: 'Task Name', agent: 'your-name', description: 'context' }
);

await safeTask();
```

### Track Errors

```javascript
const ErrorTracker = require('/workspace/skills/self-improvement/learnings/error-tracker');
const tracker = new ErrorTracker();

const errors = tracker.scan(output, { source: 'tool-name' });
if (errors.length > 0) {
  console.log('Known errors detected:', errors);
}
```

### Run Health Review

```bash
node /workspace/skills/self-improvement/councils/council-runner.js --health-only
```

### Run Tests

```bash
# Tier 1 only (free)
node /workspace/skills/self-improvement/testing/test-runner.js 1

# All tiers
node /workspace/skills/self-improvement/testing/test-runner.js
```

## Integration Points

### With Logging System
- Error Reporter automatically logs to `/workspace/skills/logging/logger`
- Graceful fallback if logger not available
- All errors go to `system.error` event type

### With LLM Router
- Tier 2+ tests use router for provider verification
- Optional dependency with try/catch fallback

### With Cron System
- Councils run daily at 2 AM
- Tier 1 tests run nightly at 3 AM
- Tier 2/3 tests run weekly (Sundays)

### With Memory Drive
- Reports saved to `/Volumes/reeseai-memory/agents/reviews/`
- Learnings stored in workspace for versioning
- Error patterns tracked by date

## Error Patterns Tracked

The error tracker automatically detects:
- LM Studio connection failures
- Gateway connection failures
- SQLite database locks
- Memory exhaustion
- API rate limiting
- Disk space issues
- Timeouts
- Permission errors
- sqlite-vec loading issues

## Council Checks

### Health Review (6 dimensions)
1. Cron reliability (7-day window)
2. Database health (integrity checks)
3. Storage usage (disk space)
4. Service availability (gateway, LM Studio, Mission Control)
5. Error rate (24-hour window)
6. Data integrity (critical files)

### Security Review (4 perspectives)
1. Offensive (exposed secrets, open ports)
2. Defensive (log redaction, backup recency)
3. Privacy (PII in public files, MEMORY.md access)
4. Operational (disk space, memory drive, Node version)

### Innovation Scout (4 scans)
1. Manual patterns (direct LLM calls, console.logs)
2. Code duplication (multiple redaction implementations)
3. Outdated patterns (callbacks vs async/await)
4. TODO/FIXME/HACK comments

## Testing Tiers

### Tier 1: Nightly (Free)
- Database schema validation
- Module import checks
- File system access
- Redaction tests
- Model utility tests
- No LLM calls

### Tier 2: Weekly (Low Cost)
- LM Studio provider tests
- Embedding generation
- Scoring rubric validation
- Optional paid provider tests (--include-paid flag)

### Tier 3: Weekly (Moderate Cost)
- Email pipeline flow
- Content pipeline
- BI Council expert
- Telegram delivery
- Logging round-trip

## Configuration

Edit `/workspace/skills/self-improvement/config.json`:

```json
{
  "learnings_dir": "path/to/learnings",
  "reports_dir": "path/to/reports",
  "test_reports_dir": "path/to/test-reports",
  "error_reporting": {
    "telegram_chat_id": "your-chat-id",
    "min_severity": "error",
    "batch_window_seconds": 60
  },
  "councils": {
    "health": { "enabled": true },
    "security": { "enabled": true },
    "innovation": { "enabled": true }
  },
  "testing": {
    "tier1_schedule": "nightly",
    "tier2_schedule": "weekly",
    "tier3_schedule": "weekly",
    "tier2_include_paid": false
  }
}
```

## Dependencies

Required:
- `better-sqlite3` (for DB integrity checks)

Optional (graceful fallback):
- `/workspace/skills/logging/logger`
- `/workspace/skills/llm-router/router`

## Best Practices

1. **Capture learnings immediately** - Don't rely on memory
2. **Wrap all background tasks** - Use ErrorReporter.wrapWithReporting()
3. **Review council reports weekly** - Automated doesn't mean ignored
4. **Run Tier 1 tests often** - They're free and fast
5. **Track feature requests** - Use FeatureLog for all improvement ideas

## Common Pitfalls

❌ **Don't**: Forget to report failures in cron jobs
✅ **Do**: Wrap with ErrorReporter.wrapWithReporting()

❌ **Don't**: Ignore council findings
✅ **Do**: Review reports and act on critical/high severity

❌ **Don't**: Skip Tier 1 tests because "it works on my machine"
✅ **Do**: Run them nightly to catch drift

❌ **Don't**: Let learnings pile up in memory
✅ **Do**: Capture corrections immediately

## Output Locations

- **Learnings:** `/workspace/skills/self-improvement/learnings/*.md`
- **Council reports:** `/Volumes/reeseai-memory/agents/reviews/councils/YYYY-MM-DD-council-report.md`
- **Test reports:** `/Volumes/reeseai-memory/agents/reviews/tests/YYYY-MM-DD-test-report.json`
- **Error logs:** Tracked in learnings/ERRORS.md and logging system

## Support

For questions or issues, check:
1. README.md for detailed usage
2. Spec at `/workspace/specs/self-improvement-systems.md`
3. Council reports for automated insights
4. LEARNINGS.md for historical context
