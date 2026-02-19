# ARCHITECTURE.md — Reese Operations Platform

> Single source of truth for how this system is structured, where things live, and how agents find information.

## Philosophy

**Agents are lean. The system is rich.**

No agent carries the full picture in its head. Instead, every agent knows:
1. **Who it is** (its own AGENTS.md, SOUL.md if applicable)
2. **Who it serves** (USER.md)
3. **Where to look** (this file, docs/, reference/)
4. **What's happening now** (memory/YYYY-MM-DD.md)

Information lives in one place. Agents read it when they need it. Nothing is duplicated across agent configs.

---

## Directory Structure

```
~/.openclaw/workspace/                  # THE WORKSPACE (all agents share this)
├── AGENTS.md                           # Marcus boot instructions
├── SOUL.md                             # Marcus personality
├── IDENTITY.md                         # Marcus identity
├── USER.md                             # Tyler Reese profile
├── TOOLS.md                            # Environment-specific notes (keys, devices, paths)
├── MEMORY.md                           # Long-term curated memory (Marcus, main session only)
├── HEARTBEAT.md                        # Periodic check instructions
│
├── docs/                               # 📚 SHARED KNOWLEDGE (any agent can read)
│   ├── ARCHITECTURE.md                 # THIS FILE — system map
│   ├── PRD.md                          # Product requirements (our build spec)
│   ├── REFERENCE-PRD.md               # Matt's PRD (inspiration, not our spec)
│   ├── sops/                           # Standard Operating Procedures
│   │   ├── AGENT-CREATION.md           # How to create and onboard new agents
│   │   ├── MISSION-CONTROL.md          # Dashboard development standards
│   │   ├── DATABASE.md                 # SQLite conventions, backup, migration
│   │   ├── CRON-JOBS.md               # Cron job standards and logging
│   │   ├── GIT.md                      # Branch strategy, commit conventions
│   │   └── SECURITY.md                # Security practices, secrets, permissions
│   └── reference/                      # Static reference data
│       ├── TECH-STACK.md              # Approved tech, versions, patterns
│       └── INTEGRATIONS.md            # External services, APIs, credentials
│
├── memory/                             # 📝 DAILY NOTES + STATE
│   ├── YYYY-MM-DD.md                  # Daily logs (raw capture)
│   └── heartbeat-state.json           # Check timestamps
│
├── mission_control/                    # 🖥️ DASHBOARD APP (Next.js)
│   ├── AUDIT.md                       # Brunel's codebase audit
│   └── [Next.js project files]
│
└── [future project dirs]              # CRM, tools, skills, etc.

~/.openclaw/agents/                     # AGENT CONFIGS (per-agent)
├── brunel/
│   ├── AGENTS.md                      # Brunel's role, rules, chain of command
│   └── TOOLS.md                       # Brunel-specific env notes
└── [future agents]/
```

---

## Information Hierarchy

### Layer 1: Identity (loaded at boot)
Every agent loads its own AGENTS.md. Marcus also loads SOUL.md, IDENTITY.md, USER.md.

### Layer 2: Context (loaded per session)
- `memory/YYYY-MM-DD.md` (today + yesterday)
- `MEMORY.md` (Marcus only, main session only)

### Layer 3: Reference (loaded on demand)
- `docs/ARCHITECTURE.md` — when an agent needs to understand the system
- `docs/sops/*` — when an agent needs to follow a procedure
- `docs/reference/*` — when an agent needs tech specs or integration details
- Project-specific docs (e.g., `mission_control/AUDIT.md`)

**The rule: if you don't need it right now, don't load it.** Read the file when the task requires it.

---

## Agent Roster

| Agent | Role | Model | Reports To | Access |
|-------|------|-------|-----------|--------|
| **Marcus Rawlins** | Chief of Staff | Opus 4.6 | Tyler | Full: gateway, cron, messaging, browser, all tools |
| **Brunel Edison** | Builder & Prototyper | Haiku 4.5 / Devstral | Marcus | Build tools: exec, read, write, edit. No messaging/gateway/cron |
| **Scout Pinkerton** | Research & Intelligence | Devstral / Haiku 4.5 | Marcus | Web search, web fetch, read, write. No messaging/gateway/cron |
| **Dewey Paul** | Data Scraper & Organizer | Devstral / Haiku 4.5 | Marcus | File ops, read, write, exec. No messaging/gateway/cron |

### Adding New Agents
See `docs/sops/AGENT-CREATION.md`.

---

## Platform Stack

| Layer | Tech |
|-------|------|
| **Agent Runtime** | OpenClaw (gateway on port 18789, local mode) |
| **Primary Model** | Anthropic Claude Opus 4.6 (Marcus only) |
| **Build Models** | Anthropic Haiku 4.5, Ollama Devstral (local) |
| **Heartbeat Model** | Ollama qwen3:4b (local, zero cost) |
| **Dashboard** | Next.js 15, React 19, Tailwind 4 |
| **Database** | SQLite (WAL mode, foreign keys) |
| **Messaging** | Telegram |
| **Version Control** | GitHub (MarcusRawlins) |
| **Hosting** | Mac mini (local-first) |
| **Backups** | /Volumes/reeseai-memory (primary), /Volumes/BACKUP (nightly) |

---

## Cost Model

- **Opus = Marcus only.** No exceptions.
- **Sub-agents use Haiku or local models.**
- **Heartbeats run on local Ollama.** Zero API cost.
- **If it can run locally, it should.**
- **Minimize token burn.** Don't load docs you don't need. Don't repeat context.

---

## Build Roadmap

### Phase 1: Foundation (current)
- [x] Agent architecture (Marcus + Brunel)
- [x] Mission Control codebase audit
- [ ] Architecture docs (this file)
- [ ] SOPs for agent creation, development, security
- [ ] Our PRD (scoped to Tyler's domains)

### Phase 2: Mission Control v1
- [ ] Strip demo data from Jeff's codebase
- [ ] Reshape for Reese operations
- [ ] Agent status panel
- [ ] Photography pipeline panel
- [ ] Basic financial overview

### Phase 3: Integrations
- [ ] CRM system
- [ ] Calendar/meeting integration
- [ ] Social media analytics
- [ ] Email integration

### Phase 4: Intelligence
- [ ] Business advisory analysis
- [ ] Automated health checks
- [ ] Security monitoring

---

## How Agents Find Things

**"I need to understand the system"** → Read `docs/ARCHITECTURE.md`
**"I need to follow a procedure"** → Read the relevant `docs/sops/*.md`
**"I need tech specs or API info"** → Read `docs/reference/*.md`
**"I need to know what happened recently"** → Read `memory/YYYY-MM-DD.md`
**"I need long-term context"** → Read `MEMORY.md` (Marcus only)
**"I need to know who Tyler is"** → Read `USER.md`
**"I need project-specific details"** → Read docs within the project directory

**Never guess. Always read the file.**
