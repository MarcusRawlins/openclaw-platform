# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Email
- Marcus email: marcus@marcusrawlins.com
- Access: macOS Mail app
- Credentials: stored in `~/.openclaw/.env` (MARCUS_EMAIL, MARCUS_PASSWORD)

## Storage Drives
- **Primary memory:** /Volumes/reeseai-memory (2TB SSD)
  - /OLD/ contains previous ReeseAI system (agents, photography, r3-studios, datasets)
- **Backup:** /Volumes/BACKUP
  - /reeseai-backup/ subdirectory

## R3 Studios / ZipGolf
- ZipGolf (Birdieway) source: /Volumes/reeseai-memory/OLD/photography/r3-studios/ZipGolf/
- Multi-tenant SaaS for golf courses (digital passes, gift cards, lesson bookings)
- Stack: Next.js 16, Bun, PostgreSQL + Prisma 7, Stripe Connect, Tailwind 4

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## Directory Map — Where to Find Things

**Workspace (active/small):**
- `docs/ANSELAI-ARCHITECTURE.md` — AnselAI CRM spec
- `docs/BUILD-BACKLOG.md` — Brunel's priority list
- `docs/ARCHITECTURE.md` — system overview
- `docs/PRD.md` — our build spec
- `docs/sops/` — procedures (agent creation, cron, git, security, standing orders)
- `docs/reference/` — tech stack, integrations, ZipGolf audit
- `docs/REFERENCE-PRD.md` — mature OpenClaw example (inspiration)
- `content/` — blog drafts, social content, resources (Ada's output)
- `reviews/` — trigger files for Walt
- `anselai/` — AnselAI CRM source code (port 3200)
- `mission_control/` — Mission Control dashboard source (port 3100)
- `clients/` — client-facing documents (timelines, etc.)
- `memory/` — daily notes, heartbeat state

**Memory Drive (/Volumes/reeseai-memory/):**
- `agents/reviews/` — Walt's full review files
- `agents/tasks/` — completed task archive
- `agents/[id]/lesson-archive/` — archived lessons per agent
- `agents/marcus/memory-archive/` — my archived memory items
- `photography/leads/` — Scout's lead research
- `photography/outreach/` — Ed's email drafts
- `photography/pipeline/` — active pipeline data
- `photography/brand/` — logos, fonts, brand assets
- `photography/resources/` — courses, guides, templates
- `data/databases/` — reese-catalog.db, reeseai.db
- `code/wedding-crm/` — old AnselAI codebase (reference only)
- `code/zipgolf/` — ZipGolf source
- `AGENT-Images/` — agent headshots and sprite sheets

**Agent configs (/Users/marcusrawlins/.openclaw/agents/):**
- `[id]/AGENTS.md` — agent identity + instructions
- `[id]/lessons.md` — active lessons (max 20)

Add whatever helps you do your job. This is your cheat sheet.
