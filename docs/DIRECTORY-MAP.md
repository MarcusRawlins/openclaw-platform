# Directory Map — Where Everything Lives

**Last Updated:** February 21, 2026  
**Maintained by:** Dewey Paul

This is the canonical reference for file locations across the entire ReeseAI system. When you need to know where something lives, check here first.

---

## 📁 Workspace (Active/Small)
**Path:** `/Users/marcusrawlins/.openclaw/workspace/`

The workspace is for active development, documentation, and frequently accessed files. Keep it lean.

### Documentation
- `docs/ARCHITECTURE.md` — System overview and design principles
- `docs/PRD.md` — Product requirements and build spec
- `docs/BUILD-BACKLOG.md` — Brunel's priority task list
- `docs/ANSELAI-ARCHITECTURE.md` — AnselAI CRM technical spec
- `docs/REFERENCE-PRD.md` — Mature OpenClaw example (inspiration)
- `docs/DIRECTORY-MAP.md` — This file (where everything lives)

### Documentation / SOPs (Standard Operating Procedures)
- `docs/sops/agent-creation.md` — How to create new agents
- `docs/sops/cron-management.md` — Scheduling and automation
- `docs/sops/database-management.md` — Database operations
- `docs/sops/git-workflow.md` — Version control procedures
- `docs/sops/mission-control.md` — Dashboard operations
- `docs/sops/security.md` — Security protocols

### Documentation / Reference
- `docs/reference/tech-stack.md` — Technologies in use
- `docs/reference/integrations.md` — Third-party integrations
- `docs/reference/zipgolf-audit.md` — ZipGolf codebase analysis

### Content (Ada's Output)
- `content/blog/` — Blog post drafts
- `content/social/` — Social media content
- `content/resources/` — Downloadable resources

### Code Reviews (Walt's Triggers)
- `reviews/` — Trigger files for Walt to review code

### Applications (Running Services)
- `anselai/` — AnselAI CRM source code (port 3200)
- `mission_control/` — Mission Control dashboard (port 3100)
- `mission_control/data/tasks.json` — Task queue for all agents
- `mission_control/data/agents.json` — Agent status and metadata

### Client Deliverables
- `clients/` — Client-facing documents, timelines, proposals

### Daily Memory
- `memory/` — Daily notes and context
- `memory/YYYY-MM-DD.md` — Daily log files
- `memory/heartbeat-state.json` — Heartbeat check tracking

---

## 💾 Memory Drive (Large/Archive)
**Path:** `/Volumes/reeseai-memory/`

The memory drive stores large files, archives, completed work, and historical data.

### Agent Data
- `agents/reviews/` — Walt's full review files
- `agents/tasks/` — Completed task archive
- `agents/[agent-id]/lesson-archive/` — Archived lessons per agent
- `agents/marcus/memory-archive/` — Marcus's archived memory items

### Photography Business (AnselAI)
- `photography/leads/` — Scout's lead research
- `photography/outreach/` — Ed's email drafts
- `photography/pipeline/` — Active pipeline data
- `photography/brand/` — Logos, fonts, brand assets
- `photography/resources/` — Courses, guides, templates
- `photography/content/` — Content ready for publication
- `photography/content/seo/` — SEO research and optimization files
- `photography/assets/wedding-images-backup/` — Original wedding photo backups

### R3 Studios Business (SaaS)
- `r3-studios/` — R3 Studios/ZipGolf business data
- `r3-studios/leads/` — Scout's SaaS lead research
- `r3-studios/outreach/` — Ed's SaaS outreach drafts
- `r3-studios/pipeline/` — SaaS pipeline tracking

### Databases
- `data/databases/reese-catalog.db` — Photography catalog database
- `data/databases/reeseai.db` — Main ReeseAI system database

### Code (Reference/Archive)
- `code/wedding-crm/` — Old AnselAI codebase (reference only)
- `code/zipgolf/` — ZipGolf source code

### Agent Assets
- `AGENT-Images/` — Agent headshots and sprite sheets

### Old System Archive
- `OLD/` — Previous ReeseAI system (agents, photography, r3-studios, datasets)
- `OLD/photography/r3-studios/ZipGolf/` — Original ZipGolf development

---

## 🔧 Agent Configurations
**Path:** `/Users/marcusrawlins/.openclaw/agents/`

Agent-specific configuration and active lessons.

### Per-Agent Structure
- `[agent-id]/AGENTS.md` — Agent identity + instructions
- `[agent-id]/lessons.md` — Active lessons (max 20, from Walt's reviews)

### Known Agent IDs
- `marcus/` — Marcus (main agent)
- `brunel/` — Brunel (builder/engineer)
- `scout/` — Scout (lead researcher)
- `ed/` — Ed (outreach specialist)
- `ada/` — Ada Lovelace (content creator)
- `dewey/` — Dewey Paul (data organizer)
- `walt/` — Walt Whitman (code reviewer)

---

## 💿 Backup Drive
**Path:** `/Volumes/BACKUP/`

Nightly backups from the memory drive.

- `reeseai-backup/` — Mirror of `/Volumes/reeseai-memory/`

---

## 🌐 Local Services

### Mission Control
- **URL:** http://localhost:3100
- **Remote (via Tailscale):** [Pending Tailscale setup]
- **Source:** `/Users/marcusrawlins/.openclaw/workspace/mission_control/`
- **Purpose:** Task management, agent monitoring, business dashboard

### AnselAI CRM
- **URL:** http://localhost:3200
- **Source:** `/Users/marcusrawlins/.openclaw/workspace/anselai/`
- **Purpose:** Photography business CRM

---

## 📝 File Naming Conventions

### Daily Memory Files
- Format: `YYYY-MM-DD.md`
- Location: `workspace/memory/`
- Example: `2026-02-21.md`

### Agent Lesson Archives
- Format: `lessons-YYYY-MM-DD.md`
- Location: `/Volumes/reeseai-memory/agents/[agent-id]/lesson-archive/`

### Task Archives
- Format: `task-[taskId]-YYYY-MM-DD.md`
- Location: `/Volumes/reeseai-memory/agents/tasks/`

### Review Files
- Format: `review-[taskId]-YYYY-MM-DD.md`
- Location: `/Volumes/reeseai-memory/agents/reviews/`

### Wedding Image Backups
- Format: `YYYY-MM-DD/[wedding-name]/`
- Location: `/Volumes/reeseai-memory/photography/assets/wedding-images-backup/`

---

## 🔍 Quick Lookup

**Need to find...**

- **Agent instructions?** → `/Users/marcusrawlins/.openclaw/agents/[agent-id]/AGENTS.md`
- **Task data?** → `workspace/mission_control/data/tasks.json`
- **Recent memory?** → `workspace/memory/YYYY-MM-DD.md`
- **Long-term memory (Marcus)?** → `workspace/MEMORY.md` (main session only!)
- **Photography leads?** → `/Volumes/reeseai-memory/photography/leads/`
- **Outreach drafts?** → `/Volumes/reeseai-memory/photography/outreach/`
- **Blog drafts?** → `workspace/content/blog/`
- **Completed reviews?** → `/Volumes/reeseai-memory/agents/reviews/`
- **Database files?** → `/Volumes/reeseai-memory/data/databases/`
- **ZipGolf source?** → `/Volumes/reeseai-memory/OLD/photography/r3-studios/ZipGolf/`
- **Brand assets?** → `/Volumes/reeseai-memory/photography/brand/`

---

## 🚨 Important Notes

1. **MEMORY.md is private** — Only load in Marcus's main session. Never in shared contexts.
2. **Workspace = active** — Keep it small. Move completed/large files to memory drive.
3. **Memory drive = archive** — For completed work, large files, historical data.
4. **Backup drive = safety net** — Nightly automated backups. Don't write directly to it.
5. **Update this file** — When you create new directories or move files, update this map.

---

**Maintained by:** Dewey Paul, Data Organizer  
**Report issues to:** Marcus (main session)
