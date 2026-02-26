# TOOLS.md - Local Notes

Environment-specific config. Skills define _how_ tools work. This file is _your_ specifics.

## Email
- Photography: hello@bythereeses.com
- Personal: jtyler.reese@gmail.com
- Rehive: hello@getrehive.com
- Access: macOS Mail app. Credentials in `~/.openclaw/.env`

## Storage
- **Primary:** /Volumes/reeseai-memory (2TB SSD)
- **Backup:** /Volumes/BACKUP/reeseai-backup/

## Services
- Mission Control: port 3100 (http://192.168.68.105:3100)
- AnselAI CRM: port 3200 (not yet running)
- Gateway: port 18789
- LM Studio: port 1234 (http://127.0.0.1:1234/v1) — replaced Ollama 2026-02-24

## Social Media Accounts
- Twitter/X: credentials in ~/.openclaw/.env (TWITTER_EMAIL, TWITTER_PASSWORD)
- Instagram: credentials in ~/.openclaw/.env (INSTAGRAM_EMAIL, INSTAGRAM_PASSWORD)
- TikTok: credentials in ~/.openclaw/.env (TIKTOK_EMAIL, TIKTOK_PASSWORD)
- YouTube: TBD (confirm/create account)

## Search APIs
- Tavily: TAVILY_API_KEY in ~/.openclaw/.env
- SerpAPI: SERPAPI_KEY in ~/.openclaw/.env
- Brave Search: in gateway config (currently disabled)
- Google Cloud: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_ANALYTICS_PROPERTY_ID

## Knowledge Base
- Location: /Volumes/reeseai-memory/data/knowledge-base/
- Inventory: inventory.json (269 files indexed)
- Key report: knowledge-synthesis-report.md
- Needs: local embeddings for semantic search

## Directory Map

**Workspace:**
- `docs/` — ARCHITECTURE, BRAND-VOICE, BUILD-BACKLOG, PRD, REFERENCE-PRD, ANSELAI-ARCHITECTURE, DIRECTORY-MAP
- `docs/sops/` — AGENT-CREATION, AGENT-LEARNING-PROCESS, AGENT-STANDING-ORDERS, BACKUP-SYSTEM, CRON-JOBS, DATABASE, GIT, MISSION-CONTROL, MISSION-CONTROL-SERVICE, SECURITY, TASK-COST-TRACKING, TASK-WORKFLOW
- `docs/reference/` — TECH-STACK, INTEGRATIONS, ZIPGOLF-AUDIT, AGENT-METRICS, AUTOMATION-DECISION-TREE, TAILSCALE, + skill/schema refs
- `content/` — blog drafts, social content, resources (Ada's output)
- `anselai/` — AnselAI CRM source
- `mission_control/` — Mission Control dashboard source
- `clients/` — client-facing documents
- `memory/` — daily notes (YYYY-MM-DD.md, keep recent 2-3 days, archive older)
- `reviews/` — Walt review triggers

**Memory Drive (/Volumes/reeseai-memory/):**
- `agents/reviews/` — Walt's full review files
- `agents/tasks/` — completed task archive
- `agents/[id]/lesson-archive/` — archived lessons per agent
- `agents/marcus/memory-archive/` — archived memory, old docs, completion artifacts
- `photography/` — leads, outreach, pipeline, brand assets, resources
- `data/databases/` — reese-catalog.db, reeseai.db
- `code/` — zipgolf source, old wedding-crm, utility scripts
- `AGENT-Images/` — agent headshots and sprite sheets

**Agent configs (/Users/marcusrawlins/.openclaw/agents/):**
- `main/lessons.md` — Marcus's lessons (NEW as of 2026-02-24)
- `[id]/AGENTS.md` — agent identity + instructions
- `[id]/lessons.md` — active lessons (max 20)
