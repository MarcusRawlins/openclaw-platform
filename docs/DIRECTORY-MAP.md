# DIRECTORY-MAP.md

**The definitive reference for where everything lives in the OpenClaw system.**

Use this map to answer:
- "Where do I find X?"
- "Where should I save Y?"
- "What's the difference between workspace and memory drive?"

---

## Quick Reference

| What | Where |
|------|-------|
| **Active source code** | `/Users/marcusrawlins/.openclaw/workspace/` |
| **Long-term storage** | `/Volumes/reeseai-memory/` |
| **Agent configs** | `/Users/marcusrawlins/.openclaw/agents/` |
| **Documentation** | `workspace/docs/` |
| **Databases** | `/Volumes/reeseai-memory/data/databases/` |
| **Agent outputs** | `/Volumes/reeseai-memory/agents/` |
| **Photography data** | `/Volumes/reeseai-memory/photography/` |

---

## 1. Workspace (Active Development)

**Location:** `/Users/marcusrawlins/.openclaw/workspace/`

**Purpose:** Active development, lightweight files, frequently accessed data. Keep it lean — move completed/archived work to memory drive.

### Root Files

```
AGENTS.md          → Agent identity & instructions (loaded by all agents)
SOUL.md            → Core values & personality
USER.md            → Marcus's profile & preferences
IDENTITY.md        → Session identity context
MEMORY.md          → Long-term curated memory (MAIN SESSION ONLY)
TOOLS.md           → Local environment notes & quick references
HEARTBEAT.md       → Heartbeat polling checklist
```

### Source Code

#### `anselai/` — AnselAI CRM
- **Purpose:** Photography business CRM (port 3200)
- **Stack:** Next.js 16, Bun, PostgreSQL + Prisma 7, Stripe, Tailwind 4
- **Key dirs:**
  - `src/` — Application source
  - `prisma/` — Database schema & migrations
  - `public/` — Static assets
  - `.next/` — Build output (gitignored)

#### `mission_control/` — Mission Control Dashboard
- **Purpose:** Agent monitoring & management UI (port 3100)
- **Stack:** Next.js, TypeScript, TailwindCSS
- **Key dirs:**
  - `app/` — Next.js app router pages
  - `components/` — React components
  - `agents/` — Agent metadata
  - `data/` — Mock/test data
  - `workspace-reference/` — Reference docs
  - `.next/` — Build output (gitignored)

### Documentation

#### `docs/` — System Documentation
```
ARCHITECTURE.md          → System overview & design
PRD.md                   → Product requirements
REFERENCE-PRD.md         → Mature OpenClaw example (inspiration)
ANSELAI-ARCHITECTURE.md  → AnselAI CRM spec
BUILD-BACKLOG.md         → Brunel's priority list
AGENT-METRICS.md         → Agent performance tracking
DIRECTORY-MAP.md         → This file
```

#### `docs/sops/` — Standard Operating Procedures
```
AGENT-CREATION.md         → How to create new agents
AGENT-STANDING-ORDERS.md  → Agent behavior guidelines
CRON-JOBS.md             → Scheduled task setup
DATABASE.md              → Database management
GIT.md                   → Git workflow & conventions
MISSION-CONTROL.md       → Mission Control operations
SECURITY.md              → Security best practices
```

#### `docs/reference/` — Technical Reference
```
TECH-STACK.md      → Technology choices & rationale
INTEGRATIONS.md    → Third-party integrations
ZIPGOLF-AUDIT.md   → ZipGolf codebase audit
```

### Content & Publishing

#### `content/` — Ada's Publishing Output
```
blog/       → Blog post drafts
social/     → Social media content
resources/  → Educational resources, guides
```

#### `clients/` — Client-Facing Documents
```
timelines/  → Project timelines
briefs/     → Client briefs
```

#### `reviews/` — Walt's Review Triggers
- **Purpose:** Lightweight trigger files for Walt (reviewer)
- **What:** Small files that trigger full reviews
- **Full reviews saved to:** `/Volumes/reeseai-memory/agents/reviews/`

### Memory & State

#### `memory/` — Daily Session Notes
```
YYYY-MM-DD.md         → Daily logs (raw notes)
heartbeat-state.json  → Heartbeat check tracking
```

**Retention:** Keep recent (~30 days), archive older to memory drive

---

## 2. Memory Drive (Long-Term Storage)

**Location:** `/Volumes/reeseai-memory/`

**Purpose:** Long-term storage, large datasets, completed work, archives. This is where things live permanently.

### Root Files
```
CATALOG.md              → Full inventory of memory drive contents
CATALOG-SUMMARY.md      → Quick reference version
MIGRATION-LOG.md        → History of data migrations
ORGANIZATION-SUMMARY.md → Organizational changes log
CLEANUP-LOG.md          → Cleanup & archival actions
```

### Agent Outputs & Data

#### `agents/` — Agent Work Products
```
reviews/              → Walt's complete review files
tasks/                → Completed task archive
archive/              → Archived agent data

ada/
  lesson-archive/     → Archived lessons (when lessons.md exceeds 20)
  content-archive/    → Published content archive
  
brunel/
  lesson-archive/     → Build lessons archive
  project-archive/    → Completed projects
  
dewey/
  lesson-archive/     → Research lessons archive
  knowledge-base/     → Curated research findings
  
ed/
  lesson-archive/     → Outreach lessons archive
  email-archive/      → Sent emails archive
  
marcus/
  memory-archive/     → Archived MEMORY.md items
  lesson-archive/     → Main agent lessons
  
scout/
  lesson-archive/     → Scout lessons archive
  research-archive/   → Completed research
  
walt/
  lesson-archive/     → Review lessons archive
  review-templates/   → Review frameworks
```

**Pattern:** Each agent has a directory with `lesson-archive/` when `lessons.md` hits 20 items.

### Photography Business

#### `photography/` — Photography Business Data
```
leads/           → Scout's lead research & profiles
outreach/        → Ed's email drafts & campaigns
pipeline/        → Active pipeline data & tracking
brand/           → Logos, fonts, brand assets
resources/       → Courses, guides, templates
assets/          → Photography equipment, tools
briefs/          → Project briefs
client-personas/ → Target client profiles
content/         → Photography-related content
datasets/        → Lead lists, market data
playbooks/       → Sales playbooks & scripts
publishing/      → Published case studies, portfolio
sales/           → Sales collateral, proposals
social/          → Social media content
templates/       → Email templates, contracts
```

### R3 Studios

#### `r3-studios/` — R3 Studios (ZipGolf, etc.)
```
content/  → R3 Studios marketing content
```

**Note:** ZipGolf source code is at `/Volumes/reeseai-memory/code/zipgolf/`

### Code Archives

#### `code/` — Archived & Reference Code
```
wedding-crm/              → Old AnselAI codebase (reference only)
zipgolf/                  → ZipGolf multi-tenant SaaS
mission-control-dashboard → Old mission control versions
demos/                    → Code demos & experiments
scripts/                  → Utility scripts
```

**Active code stays in:** `/Users/marcusrawlins/.openclaw/workspace/`

### Data & Databases

#### `data/` — Persistent Data Storage
```
databases/     → reese-catalog.db, reeseai.db
datasets/      → Training data, exports
embeddings/    → Vector embeddings
google-takeout → Google data exports
logs/          → System logs
scripts/       → Data processing scripts
uploads/       → File uploads
```

### Resources & Learning

#### `resources/` — Educational & Reference Materials
```
content/       → Content creation resources
courses/       → Online courses, tutorials
outreach/      → Outreach templates & guides
photography/   → Photography education
sales/         → Sales training materials
```

### Agent Images

#### `AGENT-Images/` — Agent Headshots & Visuals
```
Sprite-Sheets/  → Animated sprite sheets
ada/            → Ada's headshots
brunel/         → Brunel's headshots
dewey/          → Dewey's headshots
ed/             → Ed's headshots
marcus/         → Marcus's headshots
scout/          → Scout's headshots
walt/           → Walt's headshots
```

### Documentation

#### `docs/` — Archived Documentation
```
old-reeseai/  → Previous ReeseAI system docs
```

---

## 3. Agent Configs (Identity & Lessons)

**Location:** `/Users/marcusrawlins/.openclaw/agents/`

**Purpose:** Per-agent configuration, identity, and active lessons. Each agent loads these on session start.

### Agent Directory Structure

```
/Users/marcusrawlins/.openclaw/agents/
├── main/          → Main agent (Marcus's primary assistant)
├── ada/           → Content creator & publisher
├── brunel/        → Builder & developer
├── dewey/         → Researcher & knowledge curator
├── ed/            → Outreach & email specialist
├── scout/         → Lead researcher
└── walt/          → Reviewer & quality assurance
```

### Files in Each Agent Directory

#### Standard Files (All Agents)
```
AGENTS.md   → Agent identity, role, instructions
            (loaded every session - this is who they are)
            
lessons.md  → Active lessons learned (max 20)
            (when full, archive oldest to memory drive)
```

#### Optional Files (Agent-Specific)
```
TOOLS.md    → Agent-specific tool notes
MEMORY.md   → Agent-specific memory (if needed)
SOUL.md     → Agent personality (if customized)
```

### Lesson Management

**Active lessons:** `/Users/marcusrawlins/.openclaw/agents/[agent]/lessons.md`
- Max 20 items
- Most recent, most relevant

**Archived lessons:** `/Volumes/reeseai-memory/agents/[agent]/lesson-archive/`
- When `lessons.md` exceeds 20, move oldest to archive
- Organized by date or topic

---

## Decision Guide: Where Should I Save This?

### Save to **Workspace** if:
- ✅ Actively working on it (code, docs)
- ✅ Frequently accessed (today's memory notes)
- ✅ Part of git repo (source code, docs)
- ✅ Small/lightweight file
- ✅ Trigger file (reviews/)

### Save to **Memory Drive** if:
- ✅ Completed work (archived tasks, sent emails)
- ✅ Long-term storage (databases, datasets)
- ✅ Large files (images, videos, archives)
- ✅ Business data (leads, pipeline, resources)
- ✅ Reference material (courses, guides)
- ✅ Old codebases (wedding-crm, zipgolf)

### Save to **Agent Configs** if:
- ✅ Agent identity/personality (AGENTS.md, SOUL.md)
- ✅ Active lessons (lessons.md)
- ✅ Agent-specific tools/memory

---

## Common Lookup Scenarios

### "Where's the AnselAI source code?"
→ `/Users/marcusrawlins/.openclaw/workspace/anselai/`

### "Where's the old AnselAI code for reference?"
→ `/Volumes/reeseai-memory/code/wedding-crm/`

### "Where do I save Scout's lead research?"
→ `/Volumes/reeseai-memory/photography/leads/`

### "Where's the database?"
→ `/Volumes/reeseai-memory/data/databases/reese-catalog.db`

### "Where do Walt's full reviews go?"
→ `/Volumes/reeseai-memory/agents/reviews/`

### "Where are agent headshots?"
→ `/Volumes/reeseai-memory/AGENT-Images/`

### "Where's the ZipGolf code?"
→ `/Volumes/reeseai-memory/code/zipgolf/`

### "Where do I find Ada's old lessons?"
→ `/Volumes/reeseai-memory/agents/ada/lesson-archive/`

### "Where's the tech stack documentation?"
→ `/Users/marcusrawlins/.openclaw/workspace/docs/reference/TECH-STACK.md`

### "Where do I save today's session notes?"
→ `/Users/marcusrawlins/.openclaw/workspace/memory/YYYY-MM-DD.md`

### "Where's Marcus's curated long-term memory?"
→ `/Users/marcusrawlins/.openclaw/workspace/MEMORY.md` (main session only!)

### "Where do I archive old memory items?"
→ `/Volumes/reeseai-memory/agents/marcus/memory-archive/`

---

## Maintenance Notes

**Keep workspace lean:**
- Archive old memory files (>30 days) to memory drive
- Move completed projects to memory drive
- Clean up build artifacts regularly

**Memory drive organization:**
- Each agent gets their own archive directory
- Use clear directory names
- Update CATALOG.md when adding new sections

**Agent configs:**
- Keep lessons.md under 20 items
- Archive to memory drive when full
- AGENTS.md is sacred — keep it current

---

**Last Updated:** 2026-02-20 by Scout
**Maintained By:** All agents (update when structure changes)
