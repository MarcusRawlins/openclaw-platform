# MEMORY.md - Long Term Memory
**Keep this under 100 lines.** Archive to /Volumes/reeseai-memory/agents/marcus/memory-archive/YYYY-MM.md
**No duplication.** Tyler's info → USER.md. Marcus's identity → SOUL.md. Tool config → TOOLS.md.

## Personal Contact Info (DM-only)

- Personal email: jtyler.reese@gmail.com
- This section exists here instead of USER.md so it only loads in private chats, never in group contexts.

## User Preferences

- Writing: Use voice skills for all drafts. Tyler wants zero AI-sounding output.
- Tone in DMs: Friend-first, assistant-second. Informal, funny, direct.
- Content format: Tight summaries, not walls of text. Lead with the point.
- Cross-posting: Don't duplicate the same notification to multiple channels. One destination per event.

## Project State (Distilled)

- **R3 Studios:** Custom websites + SaaS for service businesses. Demo portfolio on GitHub (MarcusRawlins). ZipGolf (Birdieway): multi-tenant golf SaaS, Next.js 16, Bun, PostgreSQL + Prisma 7, Stripe Connect.
- **Mission Control:** Port 3100, "Reese Operations". 8 views. Chat/messaging with gateway BROKEN since 2026-02-19. 81 tasks queued (see `mission_control/data/tasks.json`).
- **AnselAI CRM:** Named after Ansel Adams. Not yet running. Architecture: `docs/ANSELAI-ARCHITECTURE.md`. 5 build phases planned.
- **Knowledge Base:** 269 files (206 PDFs, 63 videos). 194 extracted. Synthesis at 87%. Needs: local embeddings + vector search, skill enhancement with extracted knowledge.

## Architecture

- All agents go through Marcus as gatekeeper. Agent boot = AGENTS.md + IDENTITY.md + lessons.md + shared-rules.md.
- Review pipeline: Agent → Walt → Marcus (Opus) → Tyler approves.
- Walt appends to agent lessons.md on non-PASS reviews. Max 20 lessons, oldest archived.
- Compaction buffer: 8000 tokens.

## Operational Lessons

- Full lessons: `/agents/main/lessons.md`
- Duplicate delivery prevention: content already posted is delivered. Answer follow-ups, don't re-send.
- Report failures proactively via Telegram. Tyler can't see stderr or background logs.
- When Tyler says "do it," execute and report. Don't ask permission to start.
- Diagnose first, then fix. Don't guess and ship untested code.

## Email Triage Patterns

- **High:** Meetings, partner comms, payments, tax docs, family, bills
- **Medium:** Inbound leads, guest bookings, shipping
- **Low:** Newsletters, social notifications, marketing

## Security & Privacy

- NEVER share Mission Control URL, API keys, or internal credentials externally.
- Can share: outputs, screenshots, summaries, GitHub repos.
- PII redaction applies to all outbound content. Dollar amounts are confidential.
- Data classification tiers enforced per shared-rules.md.

## Analysis Patterns

- When Tyler asks about data in conversation, pull it locally and include in the reply. Don't re-post to messaging.
- When discussing config changes, just make the fix. Skip alternative approaches unless asked.

## System Health

- Heartbeats run on local LLM (zero API cost).
- Gateway token: verify consistency after any config change.
- Check for stale lock files if any ingestion hangs. Delete if owning PID is dead.

## Queued Work

- Key items: Telegram topics, local embeddings, email scoring, nightly councils, morning briefing cron, skill enhancement
- Matt Berman ideas: see `memory/matt-berman-analysis.md`

## Process Lessons → see /agents/main/lessons.md
