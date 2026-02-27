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
- Ada uses Sonnet for writing, local models for vision/analysis only.
- All cron jobs run on local LLM (lmstudio) except Ada's writing crons (Sonnet).
- Queue processors run 2am/2pm daily, staggered 10 min per agent.

## Project State (Distilled)

- **R3 Studios:** Custom websites + SaaS. 8 demo sites deployed on Render (auto-deploy from GitHub). ZipGolf (Birdieway): multi-tenant golf SaaS, Next.js 16, Bun, PostgreSQL + Prisma 7, Stripe Connect.
- **Mission Control:** Port 3100, GitHub: MarcusRawlins/mission-control. MC messaging needs end-to-end testing (code exists, untested).
- **AnselAI CRM:** Phase 1 backend built (DB schema, API routes, ConnectionManager, SyncScheduler, encryption). Needs Prisma 7 adapter config. Meta OAuth needs Tyler's app credentials.
- **Knowledge Base:** 269 files (206 PDFs, 63 videos). 194 extracted. Needs: local embeddings + vector search.

## Architecture

- All agents go through Marcus as gatekeeper. Agent boot = AGENTS.md + IDENTITY.md + lessons.md + shared-rules.md.
- Review pipeline: Agent → Walt → Marcus (Opus) → Tyler approves.
- Queue processor crons: Brunel 2:00, Walt 2:10, Scout 2:20, Ada 2:30, Ed 2:40, Dewey 2:50 (AM/PM).
- 9am stalled task checker catches anything stuck >24h.
- Compaction buffer: 8000 tokens.

## Operational Lessons

- Full lessons: `/agents/main/lessons.md`
- Report failures proactively via Telegram. Tyler can't see stderr or background logs.
- When Tyler says "do it," execute and report. Don't ask permission to start.
- Diagnose first, then fix. Don't guess and ship untested code.
- LM Studio needs dummy apiKey in config for subagent auth to work.
- Model path format: `lmstudio/model-id` not `openai/lmstudio`.

## Email Triage Patterns

- **High:** Meetings, partner comms, payments, tax docs, family, bills
- **Medium:** Inbound leads, guest bookings, shipping
- **Low:** Newsletters, social notifications, marketing

## Security & Privacy

- NEVER share Mission Control URL, API keys, or internal credentials externally.
- Can share: outputs, screenshots, summaries, GitHub repos.
- PII redaction applies to all outbound content. Dollar amounts are confidential.

## System Health

- Heartbeats run on local LLM (zero API cost).
- Monthly memory archive cron: 1st of month 2am.
- Gateway token: verify consistency after any config change.

## Process Lessons → see /agents/main/lessons.md
