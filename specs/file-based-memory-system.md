# File-Based Memory System

**Priority:** High (keeps agents lean, enables knowledge access)
**Estimated Time:** 2-3 days
**Dependencies:** Cron Automation (for weekly synthesis job)

## Goal

Formalize and automate the memory system across all agents. Agents stay lean on startup (minimal token cost), but know exactly how to find and access everything. Includes automated weekly synthesis from daily notes into MEMORY.md, heartbeat state tracking, and team-wide rollout.

## Design Principles

1. **Agents are lean:** Boot files (AGENTS.md ~50 lines + lessons.md ~20 lines) tell agents WHERE to find info, not carry it all
2. **Daily notes are raw capture:** Append-only, never edited, permanent record
3. **MEMORY.md is curated wisdom:** Distilled patterns, preferences, lessons from daily notes
4. **Heartbeat stays local:** Uses local LM Studio model (zero API cost)
5. **Never loaded in group chats:** Memory files contain personal/business details
6. **Synthesis is automated:** Weekly cron reads daily notes → updates MEMORY.md

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  FILE-BASED MEMORY SYSTEM                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PER-AGENT STRUCTURE:                                       │
│                                                              │
│  /agents/{agent-id}/                                        │
│  ├── AGENTS.md          (identity, ~50 lines, boot file)    │
│  ├── lessons.md          (active lessons, max 20)           │
│  └── memory/                                                │
│      ├── YYYY-MM-DD.md   (daily notes, append-only)         │
│      └── state.json      (heartbeat + check tracking)       │
│                                                              │
│  MARCUS ONLY (workspace root):                              │
│  ├── MEMORY.md           (synthesized long-term memory)     │
│  ├── memory/                                                │
│  │   ├── YYYY-MM-DD.md   (daily notes)                     │
│  │   └── heartbeat-state.json (check timestamps)           │
│  └── SOUL.md, USER.md, etc.                                │
│                                                              │
│  ARCHIVE (memory drive):                                    │
│  /Volumes/reeseai-memory/agents/{agent-id}/                │
│  ├── memory-archive/YYYY-MM.md  (monthly archives)          │
│  └── lesson-archive/             (archived lessons)         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WEEKLY SYNTHESIS CRON:                                     │
│  ┌─────────────────────────────────────────────┐            │
│  │ 1. Read daily notes from past 7 days        │            │
│  │ 2. Identify durable patterns + insights     │            │
│  │ 3. Update MEMORY.md with new findings       │            │
│  │ 4. Archive daily notes >30 days old         │            │
│  │ 5. Enforce MEMORY.md size limit (100 lines) │            │
│  │ 6. Never delete daily notes (permanent)     │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  STATE TRACKING:                                            │
│  ┌─────────────────────────────────────────────┐            │
│  │ heartbeat-state.json:                       │            │
│  │ {                                           │            │
│  │   "lastChecks": {                          │            │
│  │     "email": <timestamp>,                   │            │
│  │     "calendar": <timestamp>,                │            │
│  │     "weather": null,                        │            │
│  │     "error_log_scan": <timestamp>,          │            │
│  │     "security_audit": <timestamp>           │            │
│  │   },                                        │            │
│  │   "lastSynthesis": <timestamp>,             │            │
│  │   "corruptionRecovery": false               │            │
│  │ }                                           │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Agent Boot Loader

**File:** `skills/memory-system/boot-loader.js`

Determines what an agent should load on startup based on context:

```javascript
class AgentBootLoader {
  getBootFiles(agentId, context) {
    const files = {
      always: [
        `/agents/${agentId}/AGENTS.md`,   // Identity (~50 lines)
        `/agents/${agentId}/lessons.md`    // Active lessons (~20 lines)
      ],
      mainSessionOnly: [
        '/workspace/MEMORY.md',            // Long-term memory
        '/workspace/SOUL.md',              // Personality
        '/workspace/USER.md'               // Tyler's info
      ],
      recentContext: [
        `/workspace/memory/${today()}.md`,     // Today's notes
        `/workspace/memory/${yesterday()}.md`  // Yesterday's notes
      ]
    };

    // Group chats: ONLY load identity + lessons (no personal data)
    if (context.isGroupChat) {
      return files.always;
    }

    // Main session (Marcus direct): load everything
    if (agentId === 'main' && context.isDirect) {
      return [...files.always, ...files.mainSessionOnly, ...files.recentContext];
    }

    // Other agents in direct context: identity + lessons + recent memory
    if (context.isDirect) {
      return [...files.always, ...files.recentContext];
    }

    // Default: lean boot
    return files.always;
  }

  estimateTokenCost(files) {
    // Rough estimate based on file sizes
    let totalBytes = 0;
    for (const file of files) {
      try {
        const stat = require('fs').statSync(file);
        totalBytes += stat.size;
      } catch (e) {
        // File missing, skip
      }
    }
    // ~4 chars per token, rough estimate
    return Math.ceil(totalBytes / 4);
  }
}

module.exports = new AgentBootLoader();
```

### 2. Daily Notes Manager

**File:** `skills/memory-system/daily-notes.js`

```javascript
const fs = require('fs');
const path = require('path');

class DailyNotesManager {
  constructor(agentId) {
    this.agentId = agentId;
    this.basePath = agentId === 'main'
      ? '/Users/marcusrawlins/.openclaw/workspace/memory'
      : `/Users/marcusrawlins/.openclaw/agents/${agentId}/memory`;
  }

  getNotePath(date = new Date()) {
    const dateStr = date.toISOString().split('T')[0];
    return path.join(this.basePath, `${dateStr}.md`);
  }

  append(content) {
    const notePath = this.getNotePath();

    // Create directory if needed
    fs.mkdirSync(path.dirname(notePath), { recursive: true });

    // Append to daily note
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });

    const entry = `\n## ${timestamp}\n${content}\n`;

    if (fs.existsSync(notePath)) {
      fs.appendFileSync(notePath, entry);
    } else {
      const dateStr = new Date().toISOString().split('T')[0];
      const header = `# ${dateStr} — Daily Notes\n`;
      fs.writeFileSync(notePath, header + entry);
    }
  }

  getRecentNotes(days = 7) {
    const notes = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const notePath = this.getNotePath(date);

      if (fs.existsSync(notePath)) {
        notes.push({
          date: date.toISOString().split('T')[0],
          content: fs.readFileSync(notePath, 'utf-8')
        });
      }
    }
    return notes;
  }

  archiveOldNotes(maxAgeDays = 30) {
    const archivePath = `/Volumes/reeseai-memory/agents/${this.agentId}/memory-archive`;
    fs.mkdirSync(archivePath, { recursive: true });

    const files = fs.readdirSync(this.basePath).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));

    let archived = 0;
    for (const file of files) {
      const dateStr = file.replace('.md', '');
      const fileDate = new Date(dateStr);
      const ageDays = (Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24);

      if (ageDays > maxAgeDays) {
        // Move to archive (organized by month)
        const month = dateStr.substring(0, 7); // YYYY-MM
        const monthDir = path.join(archivePath, month);
        fs.mkdirSync(monthDir, { recursive: true });

        fs.copyFileSync(
          path.join(this.basePath, file),
          path.join(monthDir, file)
        );
        // Don't delete original — daily notes are permanent
        // But move out of active directory to reduce clutter
        archived++;
      }
    }

    return archived;
  }
}

module.exports = DailyNotesManager;
```

### 3. Weekly Synthesis Engine

**File:** `skills/memory-system/synthesize.js`

```javascript
const fs = require('fs');
const fetch = require('node-fetch');
const DailyNotesManager = require('./daily-notes');

const MEMORY_PATH = '/Users/marcusrawlins/.openclaw/workspace/MEMORY.md';
const MAX_MEMORY_LINES = 100;
const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1/chat/completions';

class MemorySynthesizer {
  async synthesize(agentId = 'main') {
    console.log(`Synthesizing memory for ${agentId}...`);

    const notes = new DailyNotesManager(agentId);
    const recentNotes = notes.getRecentNotes(7);

    if (recentNotes.length === 0) {
      console.log('No recent notes to synthesize');
      return;
    }

    // Read current MEMORY.md
    const currentMemory = fs.existsSync(MEMORY_PATH)
      ? fs.readFileSync(MEMORY_PATH, 'utf-8')
      : '';

    // Generate synthesis using local LLM
    const synthesis = await this.generateSynthesis(recentNotes, currentMemory);

    // Update MEMORY.md
    this.updateMemory(synthesis, currentMemory);

    // Archive old notes
    const archived = notes.archiveOldNotes(30);
    if (archived > 0) {
      console.log(`Archived ${archived} old daily notes`);
    }

    console.log('✓ Synthesis complete');
  }

  async generateSynthesis(recentNotes, currentMemory) {
    const notesText = recentNotes.map(n =>
      `## ${n.date}\n${n.content}`
    ).join('\n\n');

    const prompt = `You are reviewing daily notes from the past week for a personal AI assistant.

CURRENT LONG-TERM MEMORY (MEMORY.md):
${currentMemory.substring(0, 3000)}

DAILY NOTES FROM PAST WEEK:
${notesText.substring(0, 6000)}

Your task:
1. Identify DURABLE patterns worth preserving (not one-off events)
2. Note new preferences, decisions, or lessons learned
3. Flag anything that contradicts or updates existing memory
4. Suggest specific lines to ADD to MEMORY.md
5. Suggest specific lines to REMOVE from MEMORY.md (outdated info)

Format as JSON:
{
  "additions": ["line to add 1", "line to add 2"],
  "removals": ["exact line to remove 1"],
  "summary": "One paragraph summary of what changed this week"
}

Rules:
- Only add DURABLE patterns (appeared multiple times or explicitly stated as preference)
- Never add secrets, API keys, or credentials
- Keep additions concise (one line each)
- Total MEMORY.md must stay under ${MAX_MEMORY_LINES} lines`;

    try {
      const response = await fetch(LM_STUDIO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen3:4b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { additions: [], removals: [], summary: 'Parse failed' };
    } catch (err) {
      console.error('Synthesis LLM call failed:', err.message);
      return { additions: [], removals: [], summary: 'LLM unavailable' };
    }
  }

  updateMemory(synthesis, currentMemory) {
    let lines = currentMemory.split('\n');

    // Remove outdated lines
    for (const removal of synthesis.removals) {
      lines = lines.filter(line => !line.includes(removal));
    }

    // Add new lines (append to relevant section or end)
    for (const addition of synthesis.additions) {
      lines.push(`- ${addition}`);
    }

    // Enforce size limit
    if (lines.length > MAX_MEMORY_LINES) {
      console.log(`MEMORY.md exceeds ${MAX_MEMORY_LINES} lines. Archiving overflow.`);
      const overflow = lines.splice(MAX_MEMORY_LINES);
      const archivePath = `/Volumes/reeseai-memory/agents/marcus/memory-archive/${new Date().toISOString().split('T')[0]}-overflow.md`;
      fs.writeFileSync(archivePath, overflow.join('\n'));
    }

    fs.writeFileSync(MEMORY_PATH, lines.join('\n'));
    console.log(`✓ MEMORY.md updated (${lines.length} lines)`);
  }
}

module.exports = new MemorySynthesizer();

// CLI
if (require.main === module) {
  new MemorySynthesizer().synthesize(process.argv[2] || 'main');
}
```

### 4. State Tracker

**File:** `skills/memory-system/state-tracker.js`

```javascript
const fs = require('fs');
const path = require('path');

const STATE_PATH = '/Users/marcusrawlins/.openclaw/workspace/memory/heartbeat-state.json';

class StateTracker {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(STATE_PATH)) {
        const data = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
        return this.validate(data);
      }
    } catch (err) {
      console.error('State file corrupted, resetting:', err.message);
    }
    return this.getDefaultState();
  }

  validate(data) {
    // If structure is invalid, reset to defaults
    if (!data || typeof data !== 'object' || !data.lastChecks) {
      console.warn('Invalid state structure, resetting');
      return this.getDefaultState();
    }
    return data;
  }

  getDefaultState() {
    return {
      lastChecks: {
        email: null,
        calendar: null,
        weather: null,
        error_log_scan: null,
        security_audit: null,
        daily_maintenance: null
      },
      lastSynthesis: null,
      corruptionRecovery: false,
      version: 1
    };
  }

  save() {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(this.state, null, 2));
  }

  recordCheck(checkName) {
    this.state.lastChecks[checkName] = Date.now();
    this.save();
  }

  getLastCheck(checkName) {
    return this.state.lastChecks[checkName] || null;
  }

  shouldCheck(checkName, intervalMs) {
    const last = this.getLastCheck(checkName);
    if (!last) return true;
    return (Date.now() - last) > intervalMs;
  }

  recordSynthesis() {
    this.state.lastSynthesis = Date.now();
    this.save();
  }
}

module.exports = new StateTracker();
```

### 5. Team Rollout Script

**File:** `skills/memory-system/setup-team.js`

Sets up memory directories for all agents:

```javascript
const fs = require('fs');
const path = require('path');

const AGENTS = ['brunel', 'scout', 'ada', 'ed', 'dewey', 'walt'];
const AGENTS_DIR = '/Users/marcusrawlins/.openclaw/agents';
const ARCHIVE_DIR = '/Volumes/reeseai-memory/agents';

function setupAgent(agentId) {
  // Create memory directory
  const memoryDir = path.join(AGENTS_DIR, agentId, 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });

  // Create state.json
  const statePath = path.join(memoryDir, 'state.json');
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, JSON.stringify({
      lastChecks: {},
      lastSynthesis: null,
      version: 1
    }, null, 2));
  }

  // Create archive directory
  const archiveDir = path.join(ARCHIVE_DIR, agentId, 'memory-archive');
  fs.mkdirSync(archiveDir, { recursive: true });

  // Verify AGENTS.md exists and is lean
  const agentsFile = path.join(AGENTS_DIR, agentId, 'AGENTS.md');
  if (fs.existsSync(agentsFile)) {
    const lines = fs.readFileSync(agentsFile, 'utf-8').split('\n').length;
    if (lines > 60) {
      console.warn(`⚠️ ${agentId}/AGENTS.md is ${lines} lines (target: ~50)`);
    }
  }

  // Verify lessons.md exists and is under 20
  const lessonsFile = path.join(AGENTS_DIR, agentId, 'lessons.md');
  if (fs.existsSync(lessonsFile)) {
    const content = fs.readFileSync(lessonsFile, 'utf-8');
    const lessonCount = (content.match(/^## Lesson/gm) || []).length;
    if (lessonCount > 20) {
      console.warn(`⚠️ ${agentId}/lessons.md has ${lessonCount} lessons (max: 20)`);
    }
  }

  console.log(`✅ ${agentId}: memory system configured`);
}

// Run setup for all agents
for (const agent of AGENTS) {
  setupAgent(agent);
}
console.log('\n✓ Team memory system setup complete');
```

## Cron Integration

**Weekly synthesis:** Runs Sunday 3 AM (local model, zero API cost)

```json
{
  "name": "Memory: Weekly Synthesis (Sunday 3am)",
  "schedule": { "kind": "cron", "expr": "0 3 * * 0", "tz": "America/New_York" },
  "payload": {
    "kind": "systemEvent",
    "text": "Run: /workspace/skills/cron-automation/run.sh memory-synthesis 'node /workspace/skills/memory-system/synthesize.js' --idempotency=daily"
  },
  "sessionTarget": "main",
  "enabled": true
}
```

## Deliverables

- [ ] Agent boot loader (determines what to load based on context)
- [ ] Daily notes manager (append, read, archive)
- [ ] Weekly synthesis engine (daily notes → MEMORY.md updates)
- [ ] State tracker (heartbeat-state.json with corruption recovery)
- [ ] Team rollout script (sets up all 6 agents)
- [ ] MEMORY.md size enforcement (100 line limit + archive overflow)
- [ ] Cron job for weekly synthesis
- [ ] Verify all agents stay lean (<50 lines AGENTS.md, <20 lessons)
- [ ] Documentation in SKILL.md
- [ ] Git commit: "feat: file-based memory system with weekly synthesis"

## Key Constraints

- **Heartbeat stays local:** Uses LM Studio (qwen3:4b), zero API cost
- **Agents stay lean:** Boot files under 70 lines combined (AGENTS.md + lessons.md)
- **Never load MEMORY.md in group chats:** Security rule, enforced by boot loader
- **Daily notes are permanent:** Archive but never delete
- **Synthesis uses local model:** No API cost for weekly synthesis
