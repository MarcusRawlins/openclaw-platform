# MEMORY.md - Long Term Memory
**Keep this under 100 lines.** Archive to /Volumes/reeseai-memory/agents/marcus/memory-archive/YYYY-MM.md
**No duplication.** Tyler's info → USER.md. Marcus's identity → SOUL.md. Tool config → TOOLS.md.

## R3 Studios
- Company: R3 Studios. Custom websites + custom SaaS for small service businesses.
- Demo portfolio on GitHub (MarcusRawlins): auto-repair, wedding-crm, summit-hvac, restaurant, landscaping, hvac, realtor, plumbing, bistro, razed-leaderboard
- ZipGolf (Birdieway): multi-tenant SaaS for golf courses. Next.js 16, Bun, PostgreSQL + Prisma 7, Stripe Connect.

## Architecture
- Build on OpenClaw platform. All agents go through Marcus as gatekeeper.
- Agents are lean: they know WHERE to find info, not carry it all in boot files.
- Agent boot = AGENTS.md (~50 lines) + lessons.md (~20 lines max). No MEMORY.md per agent.
- Shared docs in `docs/` accessible to all agents. Reference docs in `docs/reference/`.
- Tyler's Telegram chat ID: 8172900205

## Team (see agents/ dirs for full configs)
- **Brunel** — Builder. Devstral + Haiku fallback.
- **Scout** — Research. qwen3-vl:8b + Haiku fallback.
- **Dewey** — Data org. qwen3-vl:8b + Haiku fallback.
- **Ada** — Content. qwen3-vl:8b + Haiku fallback.
- **Ed** — Outreach. qwen3-vl:8b + Haiku fallback.
- **Walt** — Quality reviewer. GPT-4 Turbo + Sonnet fallback.
- Naming convention: both names from historical figures in agent's domain.

## Review Pipeline
- Agent → Walt (review) → Marcus (notified) → Tyler (approves)
- Learning system: Walt appends to agent lessons.md on non-PASS reviews. Max 20 lessons, oldest archived.
- Full reviews saved to /Volumes/reeseai-memory/agents/reviews/

## Mission Control
- Runs on port 3100. Built from jwtidwell/mission_control, rebranded "Reese Operations".
- 8 views: Operations, Blueprint, Pipeline, Financials, Clients, Content, System, Documents
- Chat/messaging with gateway: BROKEN as of 2026-02-19. Needs diagnosis.

## AnselAI (Photography CRM)
- Named after Ansel Adams. Next.js + PostgreSQL + Prisma. Port 3200.
- Build location: /workspace/anselai/. Architecture: docs/ANSELAI-ARCHITECTURE.md
- 5 build phases: Foundation → Wedding Features → Google Integration → Marcus Integration → MC Integration

## Security
- NEVER share Mission Control URL, API keys, or internal credentials externally.
- Can share: outputs, screenshots, summaries, GitHub repos.

## Operational State
- Sonnet is Marcus's default. Opus for elevation.
- Heartbeats run on local Ollama (qwen3:4b), zero API cost.
- Compaction buffer: 8000 tokens (bumped from 4000 on 2026-02-24).
- AnselAI: not yet running (no backend built).

## Knowledge Base (NEW 2026-02-24)
- Location: `/Volumes/reeseai-memory/data/knowledge-base/`
- Inventory: `inventory.json` (269 files: 206 PDFs, 63 videos)
- PDF extractions: 194 `.extracted.md` files alongside source PDFs
- Video transcripts: 16 new + 10 existing (~112K words of marketing strategy)
- Scout's synthesis: `knowledge-synthesis-report.md` (87%, approved with revisions)
- Walt's review: `knowledge-synthesis-review.md`
- Matt Berman analysis: `workspace/memory/matt-berman-analysis.md`
- **Needs:** Local embeddings + vector search to make it queryable
- **Needs:** Skill enhancement (bake extracted knowledge into blog-voice, caption-voice, email-voice, etc.)

## LM Studio (replaced Ollama 2026-02-24)
- Server: http://127.0.0.1:1234/v1
- Heartbeats: lmstudio/qwen/qwen3-4b-2507
- Brunel: lmstudio/mistralai/devstral-small-2-2512
- Scout/Dewey/Ed/Ada: lmstudio/gemma-3-12b-it
- Marcus: Claude Sonnet 4.5 (Opus for elevation)
- Walt: GPT-4 Turbo

## Social Accounts & APIs
- Twitter/X, Instagram, TikTok: credentials in ~/.openclaw/.env
- Search: Tavily (TAVILY_API_KEY), SerpAPI (SERPAPI_KEY), Brave (in gateway, disabled)
- Google Cloud: client ID + secret + analytics property
- YouTube: need to confirm/create account

## 81 Tasks in MC (as of 2026-02-24)
- Task board at: `/workspace/mission_control/data/tasks.json`
- Key queued work: Telegram topics, local embeddings, email scoring, free skills (lead-scout, trend-watch, social-monitor), nightly councils, morning briefing cron, skill enhancement with extracted knowledge
- Matt Berman ideas to implement: see `memory/matt-berman-analysis.md`

## Skills: 80 installed (up from 62)
- New: mistral-ocr, video analyzers, voice transcriber, linkedin-dm/followup, twitter-search, youtube-search, web-search-aisa, reddit-outreach, brand-analyzer, + more

## Process Lessons → see /agents/main/lessons.md
