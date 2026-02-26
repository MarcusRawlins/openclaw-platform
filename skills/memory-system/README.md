# File-Based Memory System

**Status:** ✅ Production Ready  
**Version:** 1.0  
**Last Updated:** 2026-02-26

Complete team-wide memory management system. Agents stay lean on startup (minimal token cost), but have full access to personal and team memory. Daily notes are permanent archive; MEMORY.md is synthesized weekly using local LLM (zero API cost).

## Quick Start

### 1. Setup (One-Time)

```bash
cd /Users/marcusrawlins/.openclaw/workspace
node skills/memory-system/setup-team.js
node skills/memory-system/setup-team.js verify
```

✅ Done! Memory system initialized for all agents.

### 2. Test Components

```bash
# Check boot loader
node skills/memory-system/boot-loader.js main

# Check daily notes stats
node skills/memory-system/daily-notes.js main stats

# Check heartbeat state
node skills/memory-system/state-tracker.js main status

# Check synthesis readiness
node skills/memory-system/synthesize.js main status
```

### 3. Add Cron Jobs

Cron configuration ready at: `cron-config.json`

To activate weekly synthesis (Sunday 3 AM EST):
- Add jobs from `cron-config.json` to your cron scheduler
- 7 jobs total (1 per agent)
- Each agent gets +5 minute offset to avoid collision

## Architecture

### Four-Layer System

```
BOOT LAYER       → Load only what's needed for context
                   (identity + recent memory for agents)

DAILY LAYER      → Append-only journal per agent
                   (YYYY-MM-DD.md files, permanent)

WEEKLY LAYER     → Synthesize patterns from daily notes
                   (MEMORY.md updates, local LLM)

STATE LAYER      → Track heartbeats and check times
                   (heartbeat-state.json per agent)
```

### Directory Structure

```
/workspace/
├── MEMORY.md                    ← Marcus's curated long-term memory (100 lines max)
├── SOUL.md, USER.md, etc.      ← Boot files
└── memory/
    ├── 2026-02-26.md           ← Today's daily notes
    ├── 2026-02-25.md           ← Yesterday's notes
    └── heartbeat-state.json    ← State tracking

/agents/{agent}/
├── AGENTS.md                    ← Identity (lean ~50 lines)
├── lessons.md                   ← Active lessons (max 20)
└── memory/
    ├── state.json              ← Heartbeat state
    ├── 2026-02-26.md           ← Daily notes
    └── (archive moved to /Volumes/)

/Volumes/reeseai-memory/agents/
├── marcus/memory-archive/      ← Archived notes >30 days
├── brunel/memory-archive/      ← Per-agent archives
└── ... (one per agent)
```

## Components

### 1. boot-loader.js
**Context-aware file loader**

Determines what to load based on situation:
- **Group chats:** Identity only (security)
- **Main session:** Full context (everything)
- **Direct chat:** Identity + recent memory
- **Default:** Lean boot (identity only)

```javascript
const loader = require('./boot-loader');
const loaded = loader.loadBootFiles('brunel', { isDirect: true });
// Returns: essential files, optional files, token estimate
```

### 2. daily-notes.js
**Append-only daily journal**

Permanent record of each agent's work:
- Append entries with timestamp
- Never edit or delete (permanent)
- Archive old files automatically
- Per-agent and per-day organization

```javascript
const notes = new (require('./daily-notes'))('brunel');
notes.append('Completed X task. Learned Y pattern.');
```

### 3. synthesize.js
**Weekly LLM-powered synthesis**

Converts daily notes into curated MEMORY.md:
- Reads 7 days of daily notes
- Sends to local LLM (zero API cost)
- Identifies durable patterns
- Updates MEMORY.md (100 line limit)
- Archives notes >30 days old

```javascript
const synthesizer = require('./synthesize');
const result = await synthesizer.synthesize('brunel');
if (result.success) {
  console.log('✓ Synthesis complete');
  console.log(result.synthesis.additions);
}
```

### 4. state-tracker.js
**Heartbeat state management**

Tracks check timestamps and detects corruption:
- Last check times (email, calendar, etc.)
- Last synthesis timestamp
- Corruption detection + auto-recovery
- Idempotency tracking

```javascript
const StateTracker = require('./state-tracker');
const tracker = new StateTracker('brunel');
if (tracker.shouldCheck('email', 3600000)) {
  // Do email check
  tracker.recordCheck('email');
}
```

### 5. setup-team.js
**Initialize memory for all agents**

One-time setup script:
- Creates memory/ directories
- Creates state.json files
- Creates archive directories
- Validates lean boot configuration
- Provides verification report

```bash
node setup-team.js        # Setup
node setup-team.js verify # Verify
```

## Usage Patterns

### Pattern 1: Agent Appending Daily Notes

After completing work, capture learnings:

```javascript
const DailyNotesManager = require('./daily-notes');
const notes = new DailyNotesManager('brunel');

notes.append(`Completed Lead Research task.
Key insight: HVAC businesses respond best to web design positioning.
Will use this pattern for R3 Studios outreach next week.`);
```

### Pattern 2: Marcus Heartbeat Loop

Check things periodically:

```javascript
const StateTracker = require('./state-tracker');
const tracker = new StateTracker('main');

const checks = [
  { name: 'email', interval: 3600000 },     // 1 hour
  { name: 'calendar', interval: 3600000 },  // 1 hour
  { name: 'weather', interval: 3600000 },   // 1 hour
];

for (const check of checks) {
  if (tracker.shouldCheck(check.name, check.interval)) {
    // Do the check
    tracker.recordCheck(check.name);
  }
}
```

### Pattern 3: Boot-Time Context Loading

When an agent starts, load appropriate memory:

```javascript
const loader = require('./boot-loader');

const context = {
  isDirect: req.query.isDirect === 'true',
  isGroupChat: req.query.isGroupChat === 'true',
  isMainSession: agentId === 'main'
};

const loaded = loader.loadBootFiles(agentId, context);
console.log(`Loaded ${loaded.identity.length} files, est. ${loaded.tokenEstimate} tokens`);
```

### Pattern 4: Detecting Synthesis Due

Check if synthesis should run:

```javascript
const synthesizer = require('./synthesize');
const StateTracker = require('./state-tracker');

const tracker = new StateTracker('brunel');
const synthStatus = tracker.getSynthesisStatus();

if (synthStatus.isDueForSynthesis) {
  const result = await synthesizer.synthesize('brunel');
  // Adds patterns from weekly notes to MEMORY.md
}
```

## Key Constraints

- ✅ **Agents stay lean:** Boot files ~70 lines total
- ✅ **Daily notes permanent:** Never delete, only archive
- ✅ **MEMORY.md curated:** 100 line limit, weekly updates
- ✅ **Synthesis is local:** LM Studio (zero API cost)
- ✅ **No group chat leaks:** Memory excluded from group contexts
- ✅ **Corruption recovery:** Auto-detect and reset
- ✅ **Atomic writes:** Safe from interruption

## Performance

| Operation | Time | Cost |
|-----------|------|------|
| Boot load | ~500ms | 4-8k tokens |
| Daily append | ~50ms | $0 |
| Weekly synthesis | 5-10s | $0 (local) |
| State save | ~10ms | $0 |
| Archive old notes | ~100ms | $0 |

## Cron Jobs Configured

All jobs in `cron-config.json`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| memory-synthesis-main | Sun 3:00 AM | Marcus synthesis |
| memory-synthesis-brunel | Sun 3:05 AM | Brunel synthesis |
| memory-synthesis-scout | Sun 3:10 AM | Scout synthesis |
| memory-synthesis-ada | Sun 3:15 AM | Ada synthesis |
| memory-synthesis-ed | Sun 3:20 AM | Ed synthesis |
| memory-synthesis-dewey | Sun 3:25 AM | Dewey synthesis |
| memory-synthesis-walt | Sun 3:30 AM | Walt synthesis |
| memory-archive-daily | Daily 6:00 AM | Archive old notes |

## Troubleshooting

### Problem: State file corrupted
**Solution:** StateTracker auto-detects and resets to defaults
- Daily notes unaffected
- No manual recovery needed

### Problem: LLM unavailable during synthesis
**Solution:** Synthesis records empty changes, system continues
- No API cost impact
- Try again next week
- Daily notes still safe

### Problem: MEMORY.md exceeds 100 lines
**Solution:** Overflow automatically archived to drive
- Oldest entries removed
- Archive location: `/Volumes/reeseai-memory/agents/{agent}/memory-archive/`

### Problem: Synthesis took too long / timed out
**Solution:** Timeout configured to 60 seconds
- If LLM slow, upgrade to faster model in LM Studio
- Or increase timeout in cron config

## Advanced Configuration

### Change LLM Model

Edit `synthesize.js`:
```javascript
body: JSON.stringify({
  model: 'mistral', // Change this
  messages: [...],
  temperature: 0.3,
  max_tokens: 1000
})
```

Available models in LM Studio:
- `mistral` (fast, good)
- `qwen3:4b` (very fast)
- `neural-chat` (accurate)

### Adjust Memory Limits

Edit `synthesize.js`:
```javascript
const MAX_MEMORY_LINES = 100;  // Change this
```

### Adjust Archive Timing

Edit daily archive cron or manually:
```bash
node skills/memory-system/daily-notes.js {agentId} archive
```

Default: Archive notes >30 days old

### Custom Check Tracking

Add to heartbeat-state.json:
```json
{
  "lastChecks": {
    "email": null,
    "custom_check_name": null   // Add here
  }
}
```

Then use:
```javascript
tracker.recordCheck('custom_check_name');
tracker.shouldCheck('custom_check_name', 86400000); // 24h
```

## API Reference

See `SKILL.md` for complete API documentation.

Quick reference:
- `BootLoader.getBootFiles(agentId, context)`
- `BootLoader.loadBootFiles(agentId, context)`
- `DailyNotesManager(agentId)`
  - `append(content)`
  - `getRecentNotes(days)`
  - `getNotesByDate(dateStr)`
  - `archiveOldNotes(maxAgeDays)`
  - `getStats()`
- `MemorySynthesizer.synthesize(agentId)`
- `StateTracker(agentId)`
  - `recordCheck(checkName)`
  - `shouldCheck(checkName, intervalMs)`
  - `recordSynthesis()`
  - `getSynthesisStatus()`

## File Manifest

```
skills/memory-system/
├── README.md                      ← This file
├── SKILL.md                       ← Full documentation
├── cron-config.json              ← Cron job configurations
├── boot-loader.js                ← Context-aware file loader
├── daily-notes.js                ← Daily note manager
├── synthesize.js                 ← Weekly synthesis engine
├── state-tracker.js              ← Heartbeat state tracking
└── setup-team.js                 ← Team initialization script
```

## Next Steps

1. ✅ Files created and tested
2. ✅ Team setup completed
3. ⏭️ Add cron jobs (from cron-config.json)
4. ⏭️ Monitor first weekly synthesis (Sunday 3 AM)
5. ⏭️ Review MEMORY.md updates
6. ⏭️ Iterate on synthesis prompts

## Support

For issues or questions:
- Check SKILL.md for API docs
- Run `node setup-team.js verify` to diagnose
- Check `heartbeat-state.json` for state integrity
- Monitor LM Studio availability (http://127.0.0.1:1234)

---

**Built for lean, efficient, scalable agent memory.**
