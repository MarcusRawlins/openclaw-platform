# MEMORY.md - Long Term Memory

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
- Opus model is Marcus-only. All sub-agents on cheaper/local models.
- Minimize token burn. Local-first when possible.
- Optimize infrastructure from the start.
- Heartbeats run on local Ollama (qwen3:4b), zero API cost.
- Backups to /Volumes/reeseai-memory (primary) and /Volumes/BACKUP (nightly).

## Team
- **Brunel Edison** (agent id: brunel) — Builder & Rapid Prototyper. Haiku + Devstral. Builds dashboards, tools, scripts. Reports to Marcus. No direct Tyler communication.
- **Scout Pinkerton** (agent id: scout) — Research & Intelligence. Devstral + Haiku fallback. Web research, competitor analysis, vendor lookups, market intelligence. Reports to Marcus.
- **Dewey Paul** (agent id: dewey) — Data Scraper & Organizer. Devstral + Haiku fallback. Catalogs, deduplicates, organizes data on external drives. Builds catalog databases. Reports to Marcus.

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
- `docs/sops/` — AGENT-CREATION, MISSION-CONTROL, DATABASE, CRON-JOBS, GIT, SECURITY
- `docs/reference/` — TECH-STACK, INTEGRATIONS
- `docs/REFERENCE-PRD.md` — mature OpenClaw deployment example (26 features, full CRM, councils, analytics)
