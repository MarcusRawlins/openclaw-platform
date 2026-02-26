# Memory System Skill

**Module:** `skills/memory-system/`

Team-wide memory management system. Agents stay lean on startup but have full access to personal/team memory. Daily notes are permanent archive; MEMORY.md is synthesized weekly using local LLM (zero API cost).

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│           FILE-BASED MEMORY SYSTEM                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  BOOT LAYER:                                            │
│  • Load identity files (~70 lines total)                │
│  • Load today/yesterday daily notes                      │
│  • Never load MEMORY.md in group chats                   │
│  • Estimate token cost                                  │
│                                                          │
│  DAILY LAYER:                                           │
│  • Append entries to YYYY-MM-DD.md                      │
│  • Permanent append-only journal                         │
│  • No editing or deletion                               │
│                                                          │
│  WEEKLY LAYER:                                          │
│  • Read past 7 days of daily notes                      │
│  • Use local LLM to identify patterns                   │
│  • Update MEMORY.md (~100 line limit)                   │
│  • Archive notes >30 days old                           │
│  • Zero API cost (local model)                          │
│                                                          │
│  STATE LAYER:                                           │
│  • heartbeat-state.json tracking                        │
│  • Last check timestamps                                │
│  • Corruption detection & recovery                      │
│  • Idempotency tracking                                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Components

### 1. Agent Boot Loader (`boot-loader.js`)

Determines what memory files to load based on context.

**Usage:**
```javascript
const loader = require('./boot-loader');

const context = {
  isDirect: true,           // Direct chat with agent
  isGroupChat: false,       // Group chat (restrictive)
  isMainSession: agentId === 'main'
};

const loaded = loader.loadBootFiles('brunel', context);
console.log(loaded.identity);      // Files always loaded
console.log(loaded.optional);      // Files loaded if available
console.log(loaded.tokenEstimate); // Estimated tokens used
```

**Context Rules:**
- **Group chats**: Only load AGENTS.md + lessons.md (no personal data)
- **Main session**: Load everything (full context)
- **Direct context**: Load identity + recent daily notes
- **Default**: Lean boot (identity only)

**Output:**
```javascript
{
  identity: [
    { path: '...', name: 'AGENTS.md', content: '...' },
    { path: '...', name: 'lessons.md', content: '...' }
  ],
  optional: [
    { path: '...', name: '2026-02-26.md', content: '...' },
    { path: '...', name: '2026-02-25.md', content: '...' }
  ],
  missing: [],
  reason: 'direct context',
  tokenEstimate: 4500
}
```

### 2. Daily Notes Manager (`daily-notes.js`)

Append-only journal system. Daily notes are permanent and never edited.

**Usage:**
```javascript
const DailyNotesManager = require('./daily-notes');
const notes = new DailyNotesManager('brunel');

// Append to today's notes
notes.append('Implemented task X. Key insight: pattern A repeated twice.');

// Get recent notes (7 days)
const recent = notes.getRecentNotes(7);
recent.forEach(note => {
  console.log(`${note.date}: ${note.content.split('\n').length} lines`);
});

// Get specific date
const yesterday = notes.getNotesByDate('2026-02-25');
console.log(yesterday.content);

// Archive notes >30 days old
const result = notes.archiveOldNotes(30);
console.log(`Archived ${result.archived} old notes`);

// Get statistics
const stats = notes.getStats();
console.log(`Total files: ${stats.totalFiles}`);
console.log(`Size: ${(stats.totalBytes / 1024).toFixed(1)} KB`);
```

**File Structure:**
```
/workspace/memory/
  ├── 2026-02-26.md
  ├── 2026-02-25.md
  ├── 2026-02-24.md
  └── heartbeat-state.json

/agents/brunel/memory/
  ├── 2026-02-26.md
  ├── state.json
  └── (old files get archived)
```

**Rules:**
- Daily notes are APPEND-ONLY
- Never edit or delete daily note files
- Create one file per date (YYYY-MM-DD.md)
- Archive (not delete) files >30 days old
- Keep recent 2 days in active directory

### 3. Weekly Synthesis Engine (`synthesize.js`)

Uses local LLM to extract patterns from daily notes and update MEMORY.md.

**Usage:**
```javascript
const synthesizer = require('./synthesize');

// Run synthesis for an agent
const result = await synthesizer.synthesize('brunel');
if (result.success) {
  console.log('Synthesis complete');
  console.log(`Synthesis:`, result.synthesis);
  // {
  //   additions: ['pattern 1', 'pattern 2'],
  //   removals: ['outdated info'],
  //   summary: 'This week we learned X and Y'
  // }
}

// Get status
const status = synthesizer.getStatus('brunel');
console.log(`Memory lines: ${status.memoryLines}/100`);
console.log(`Last synthesis: ${status.lastSynthesis}`);
```

**How it Works:**
1. Reads daily notes from past 7 days
2. Concatenates them into single text
3. Sends to local LLM with synthesis prompt
4. LLM identifies durable patterns
5. Updates MEMORY.md (enforcing 100 line limit)
6. Archives notes >30 days old
7. Records synthesis timestamp

**Synthesis Rules:**
- Only add DURABLE patterns (repeated multiple times)
- Never add secrets or API keys
- Keep additions to one concise line each
- Enforce 100 line MEMORY.md limit
- Archive overflow to drive

**Local Model:**
- Uses LM Studio (http://127.0.0.1:1234/v1)
- Model: mistral or qwen3:4b
- Zero API cost
- Temperature: 0.3 (low variance)
- Timeout: 30 seconds

### 4. State Tracker (`state-tracker.js`)

Maintains heartbeat-state.json with check timestamps and corruption recovery.

**Usage:**
```javascript
const StateTracker = require('./state-tracker');
const tracker = new StateTracker('brunel');

// Record a check
tracker.recordCheck('email');
tracker.recordCheck('calendar');
tracker.recordCheck('security_audit');

// Get last check time
const lastEmail = tracker.getLastCheck('email');
console.log(`Last email check: ${new Date(lastEmail)}`);

// Should we run this check?
const shouldEmail = tracker.shouldCheck('email', 3600000); // 1 hour
if (shouldEmail) {
  // run email check
  tracker.recordCheck('email');
}

// Get seconds since check
const secondsAgo = tracker.secondsSinceCheck('calendar');
console.log(`Calendar checked ${secondsAgo}s ago`);

// Record weekly synthesis
tracker.recordSynthesis();

// Get synthesis status
const synthStatus = tracker.getSynthesisStatus();
console.log(`Due for synthesis? ${synthStatus.isDueForSynthesis}`);
console.log(`Days since last: ${synthStatus.daysAgo}`);

// Print all statuses
tracker.printStatus();
```

**State File:**
```json
{
  "lastChecks": {
    "email": 1708904400000,
    "calendar": 1708890000000,
    "weather": null,
    "error_log_scan": null,
    "security_audit": 1708804800000,
    "daily_maintenance": 1708944000000
  },
  "lastSynthesis": 1708944000000,
  "corruptionRecovery": false,
  "version": 1,
  "agentId": "brunel"
}
```

**Corruption Recovery:**
- Detects invalid/missing state.json
- Automatically resets to defaults
- Sets corruptionRecovery: true flag
- Saves clean state atomically
- No data loss (daily notes are permanent)

### 5. Team Setup Script (`setup-team.js`)

Initializes memory system for all agents.

**Usage:**
```bash
# Initial setup
node setup-team.js

# Verify setup
node setup-team.js verify
```

**What it Does:**
1. Creates memory/ directories for all agents
2. Creates state.json files
3. Creates archive directories on drive
4. Validates AGENTS.md is lean (<60 lines)
5. Validates lessons.md is under 20 lessons
6. Creates archive structure

**Output Example:**
```
============================================================
🚀 TEAM MEMORY SYSTEM SETUP
============================================================

🔧 Setting up brunel...
  ✓ Created brunel/memory/state.json
  ✓ AGENTS.md is lean (48 lines)
  ✓ lessons.md lean (8 lessons)

🔧 Setting up scout...
  ✓ brunel/memory/state.json exists
  ✓ AGENTS.md is lean (52 lines)
  ✓ lessons.md lean (12 lessons)

...

============================================================
✅ SETUP COMPLETE
============================================================
```

## Cron Integration

**Weekly Synthesis Job**

Schedule: Sunday 3 AM EST

```json
{
  "name": "Memory: Weekly Synthesis",
  "schedule": { "kind": "cron", "expr": "0 3 * * 0", "tz": "America/New_York" },
  "payload": {
    "kind": "systemEvent",
    "text": "node /workspace/skills/memory-system/synthesize.js main"
  },
  "sessionTarget": "main",
  "enabled": true
}
```

All agents get synthesis job:
- brunel: Sunday 3:05 AM
- scout: Sunday 3:10 AM
- ada: Sunday 3:15 AM
- ed: Sunday 3:20 AM
- dewey: Sunday 3:25 AM
- walt: Sunday 3:30 AM

## Integration Examples

### Use Case 1: Agent Appending Daily Notes

```javascript
// In an agent's work session
const DailyNotesManager = require('./daily-notes');
const notes = new DailyNotesManager('brunel');

// After completing a task
notes.append(`Completed Lead Research task. Generated 50 qualified leads.
Key patterns:
- HVAC businesses most responsive to web design offer
- Real estate needs CRM integration
- Service businesses want Google review management`);
```

### Use Case 2: Heartbeat Check Tracking

```javascript
// In Marcus's heartbeat loop
const StateTracker = require('./state-tracker');
const tracker = new StateTracker('main');

// Check email if >1 hour since last
const oneHourMs = 3600000;
if (tracker.shouldCheck('email', oneHourMs)) {
  // Do email check
  tracker.recordCheck('email');
}
```

### Use Case 3: Detecting Due Synthesis

```javascript
// In a cron job or heartbeat
const synthesizer = require('./synthesize');
const StateTracker = require('./state-tracker');

const tracker = new StateTracker('brunel');
const synthStatus = tracker.getSynthesisStatus();

if (synthStatus.isDueForSynthesis) {
  const result = await synthesizer.synthesize('brunel');
  if (result.success) {
    console.log('✓ Synthesis complete');
  }
}
```

### Use Case 4: Boot-Time Context Loading

```javascript
// In agent initialization
const loader = require('./boot-loader');

const context = {
  isDirect: true,
  isGroupChat: false,
  isMainSession: false
};

const loaded = loader.loadBootFiles('scout', context);

console.log(`Loading ${loaded.identity.length} essential files`);
console.log(`Loading ${loaded.optional.length} optional files`);
console.log(`Token estimate: ${loaded.tokenEstimate}`);
```

## Key Constraints

- ✅ **Agents stay lean:** Boot files < 70 lines (AGENTS.md + lessons.md)
- ✅ **Daily notes are permanent:** Never delete, only archive
- ✅ **MEMORY.md is curated:** 100 line limit, weekly updates
- ✅ **Synthesis is local:** Uses LM Studio (zero API cost)
- ✅ **No group chat leaks:** Memory files excluded from group contexts
- ✅ **Corruption recovery:** Automatic reset on invalid state
- ✅ **Atomic writes:** No partial updates, safe to interrupt

## Common Issues

**Problem:** State file corrupted
- Solution: StateTracker auto-detects and resets to defaults
- Daily notes unaffected (permanent archive)

**Problem:** LLM unavailable during synthesis
- Solution: Synthesis records empty changes (system continues)
- No API cost impact
- Try again next week

**Problem:** MEMORY.md exceeds 100 lines
- Solution: Overflow archived to drive
- Oldest entries removed automatically
- Keep only most valuable insights

**Problem:** Daily notes directory too large
- Solution: archiveOldNotes() moves >30d files to drive
- Workspace stays lean for boot context

## CLI Commands

```bash
# Boot loader
node boot-loader.js [agentId] [isDirect]

# Daily notes
node daily-notes.js [agentId] [action]
# Actions: stats, append "content", recent, archive

# Synthesis
node synthesize.js [agentId] [action]
# Actions: synthesize, status

# State tracker
node state-tracker.js [agentId] [action]
# Actions: status, record checkName, check checkName interval, reset

# Team setup
node setup-team.js [action]
# Actions: setup, verify
```

## Performance Notes

- **Boot time:** ~500ms per agent (loading files)
- **Token cost:** 4-8k tokens per boot (depends on context)
- **Synthesis time:** ~5-10s (local LLM inference)
- **Synthesis cost:** $0 (local model, no API calls)
- **Archival:** ~50ms (file copy + cleanup)
- **State save:** ~10ms (atomic write)

## Next Steps

1. Run `node setup-team.js` to initialize system
2. Run `node setup-team.js verify` to validate
3. Add cron jobs for weekly synthesis (all agents)
4. Test with manual synthesis: `node synthesize.js brunel`
5. Monitor MEMORY.md growth and overflow archival
