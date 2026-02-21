# MEMORY.md - Long Term Memory
**Keep this under 120 lines.** Archive older/less relevant items to /Volumes/reeseai-memory/agents/marcus/memory-archive/YYYY-MM.md

## Tyler Reese
- Wedding photographer + SaaS co-founder
- LDS faith, influences brand tone and business decisions
- Wants a thinking partner, not a yes-machine
- Values: integration, sustainability, depth, alignment, long game
- Photography revenue targets: $250k (2026), $500k (2027)
- SaaS revenue targets: $10k/mo by April 2026, $25k/mo by EOY 2026

## R3 Studios (SaaS Business)
- Company: R3 Studios
- Focus: Custom websites + custom SaaS for small service businesses
- Demo portfolio on GitHub (MarcusRawlins): auto-repair, wedding-crm, summit-hvac, restaurant, landscaping, hvac, realtor, plumbing, bistro, razed-leaderboard
- ZipGolf (Birdieway): multi-tenant SaaS for golf courses. Located at /Volumes/reeseai-memory/OLD/photography/r3-studios/ZipGolf/. Next.js 16, Bun, PostgreSQL + Prisma 7, Stripe Connect.
- Revenue targets: $10k/mo by April 2026, $25k/mo by EOY 2026

## Operating Principles
- Sonnet is Marcus's default model. Opus available for elevation when needed (architecture, complex strategy).
- Minimize token burn. Local-first when possible.
- Optimize infrastructure from the start.
- Heartbeats run on local Ollama (qwen3:4b), zero API cost.
- Backups to /Volumes/reeseai-memory (primary) and /Volumes/BACKUP (nightly).

## Team
- **Brunel Edison** (agent id: brunel) — Builder & Rapid Prototyper. Haiku + Devstral. Builds dashboards, tools, scripts. Reports to Marcus. No direct Tyler communication.
- **Scout Pinkerton** (agent id: scout) — Research & Intelligence. Devstral + Haiku fallback. Web research, competitor analysis, vendor lookups, market intelligence. Reports to Marcus.
- **Dewey Paul** (agent id: dewey) — Data Scraper & Organizer. Devstral + Haiku fallback. Catalogs, deduplicates, organizes data on external drives. Builds catalog databases. Reports to Marcus.
- **Ada Hypatia** (agent id: ada) — Content & Resource Creator. Creates wedding planning guides, photographer education content, social media copy, blog drafts. Named after Ada Lovelace + Hypatia of Alexandria. Reports to Marcus.
- **Ed Adler** (agent id: ed) — Outreach & Messaging Agent. Crafts personalized cold outreach for R3 Studios prospects. Email sequences, value props, pitch summaries. Named after Edward Bernays + Alfred Adler. Reports to Marcus.
- **Walt Deming** (agent id: walt) — Quality Reviewer. Claude Sonnet 4.5. Reviews all agent output (code, content, outreach, research). Catches bugs, missed requirements, style issues. Reports to Marcus. Named after Walter Shewhart + W. Edwards Deming.

## Agent Naming Convention
Both first and last names come from historical figures in the agent's domain. Nickname (used as agent ID) is a short version of the first name. Example: Scout Pinkerton (Allan Pinkerton, founder of modern detective work).

## Architecture Decisions
- Build on OpenClaw platform, not separate ReeseAI system
- Mission Control dashboard: build FROM jwtidwell/mission_control codebase (keep architecture, reshape content)
- Keep: Blueprint view, agent expressions, templates, whiteboard, cron management. Strip: demo data only.
- All agents go through Marcus as gatekeeper
- Agents are lean: they know WHERE to find info, not carry it all in boot files
- Shared docs in `docs/` (ARCHITECTURE.md, sops/, reference/) accessible to all agents
- Matt's full PRD saved at `docs/REFERENCE-PRD.md` as inspiration/roadmap reference
- Tyler's Telegram chat ID: 8172900205

## Docs Structure
- `docs/ARCHITECTURE.md` — system map, directory structure, info hierarchy, agent roster, roadmap
- `docs/PRD.md` — our build spec (photography pipeline, CRM, financials, content, system health)
- `docs/sops/` — AGENT-CREATION, MISSION-CONTROL, DATABASE, CRON-JOBS, GIT, SECURITY
- `docs/reference/` — TECH-STACK, INTEGRATIONS, ZIPGOLF-AUDIT
- `docs/REFERENCE-PRD.md` — mature OpenClaw deployment example (26 features, full CRM, councils, analytics)

## Mission Control Dashboard
- Built from jwtidwell/mission_control, rebranded "Reese Operations"
- 8 views: Operations, Blueprint, Pipeline, Financials, Clients, Content, System, Documents
- Runs on port 3100, LAN accessible at http://192.168.68.147:3100
- Agent headshots: AI-generated 3x3 sprite sheets per agent (expressions system)
- Documents panel: upload → Dewey processes → indexed in reese-catalog.db
- Chat/messaging with gateway: STILL BROKEN as of 2026-02-19. Need proper diagnosis.
- Gateway bind: changed to "lan" mode for network access

## Drive Structure (/Volumes/reeseai-memory/)
- 23 GB organized: code/, photography/, data/, agents/, docs/, backups/
- reese-catalog.db: 17 tables, ~67,800 records (contacts, emails, calendar, docs, media, YouTube)
- data/databases/ is home for all SQLite databases
- Backup at /Volumes/BACKUP/reeseai-backup/

## AnselAI (Photography CRM)
- Named after Ansel Adams. Standalone Next.js app for wedding photography client management.
- Previous build at /Volumes/reeseai-memory/code/wedding-crm/ — 66 files, all UI, no backend (mock data only)
- Decision: PostgreSQL + Prisma (not Appwrite), dark theme (Mission Control style, not luxury light)
- New build location: /Users/marcusrawlins/.openclaw/workspace/anselai/
- Port 3200, accessible via Mission Control tab
- Architecture doc: docs/ANSELAI-ARCHITECTURE.md
- Google Calendar + Gmail integration via OAuth
- Marcus integration: direct Prisma queries for natural language CRM access
- 5 build phases: Foundation → Wedding Features → Google Integration → Marcus Integration → Mission Control Integration
- Brunel builds it, phase by phase with review gates

## Review Pipeline
- All agent work flows through Walt before reaching Marcus or Tyler
- Chain: Agent → Walt (review) → Marcus (notified) → Tyler (approves)
- NEEDS REVISION goes back to the agent with specific feedback
- Marcus reviews Walt periodically to keep standards calibrated
- Walt's reviews saved to /workspace/reviews/
- **Learning system:** Each agent has /agents/[id]/lessons.md. Walt appends lessons on every non-PASS review. Agents read lessons.md on boot. Lessons compound over time.
- **Max 20 lessons per agent.** Oldest pruned when full. Keeps boot context small.
- Walt's own calibration notes in /agents/walt/lessons.md, updated by Marcus.
- Task flow: QUEUED → ACTIVE → NEEDS REVIEW → DONE (or back to ACTIVE with feedback)

## Storage Strategy
- **Active/small data:** workspace (/Users/marcusrawlins/.openclaw/workspace/) — agent configs, current tasks.json, source code
- **Heavy/archival data:** reeseai-memory drive (/Volumes/reeseai-memory/)
  - Full reviews: /Volumes/reeseai-memory/agents/reviews/
  - Completed task archive: /Volumes/reeseai-memory/agents/tasks/
  - Leads, outreach, content output: /Volumes/reeseai-memory/photography/
  - Databases: /Volumes/reeseai-memory/data/databases/
- **Agent boot = lean:** AGENTS.md (~50 lines) + lessons.md (~20 lines max). No MEMORY.md, no daily files.
- **Completed tasks** get archived from workspace to drive weekly

## Process Lessons
- DIAGNOSE FIRST, then fix. Don't guess and ship untested code repeatedly.
- Test end-to-end before telling Tyler to try something.
- Don't have Brunel rewrite code without understanding the protocol first.
