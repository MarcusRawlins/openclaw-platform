# TOOLS.md - Local Notes

Environment-specific values only (IDs, paths, where secrets live). Skills define how tools work.

## Secrets & Config

- Canonical .env: `~/.openclaw/.env`
- Platform config: `~/.openclaw/config.json`
- Social credentials, API keys, Google Cloud: all in `~/.openclaw/.env`

## Attribution

When leaving permanent text (comments, commit messages, task notes), prefix with your emoji and name (e.g., "🦞 Marcus:") unless ghostwriting.

## Messaging (Telegram)

- Currently DM-based. Tyler's chat ID: 8172900205
- No topic threads configured yet.

## Voice Memos

- Inbound: Gateway auto-transcribes voice memos to text.
- Outbound: Use `tts` tool to reply as a voice note.
- Rule: Only reply with voice when explicitly asked. Default to text.

## Email

- Photography: hello@bythereeses.com
- Rehive/R3: hello@getrehive.com
- Personal: see MEMORY.md (private)
- Access: macOS Mail app via himalaya CLI. Credentials in `~/.openclaw/.env`

## Services

| Service | Port | URL |
|---------|------|-----|
| Mission Control | 3100 | http://192.168.68.105:3100 |
| AnselAI CRM | 3200 | not yet running |
| Gateway | 18789 | localhost |
| LM Studio | 1234 | http://127.0.0.1:1234/v1 |

## Storage

- **Primary:** /Volumes/reeseai-memory (2TB SSD)
- **Backup:** /Volumes/BACKUP/reeseai-backup/

## Paths

- Agent configs: `~/.openclaw/agents/`
- Skills: `~/.openclaw/skills/` (installed) + `/workspace/skills/` (custom-built)
- Specs: `/workspace/specs/`
- Knowledge base: `/Volumes/reeseai-memory/data/knowledge-base/`
- Databases: `/Volumes/reeseai-memory/data/databases/`
- Agent reviews: `/Volumes/reeseai-memory/agents/reviews/`
- Task archive: `/Volumes/reeseai-memory/agents/tasks/`
- Photography: `/Volumes/reeseai-memory/photography/`
- Logs: `/workspace/memory/` (daily notes)

## Directory Map

**Workspace (`/workspace/`):**
- `docs/` — architecture, brand voice, build backlog, PRD, SOPs, reference
- `content/` — blog drafts, social content (Ada's output)
- `anselai/` — AnselAI CRM source
- `mission_control/` — Mission Control dashboard source
- `clients/` — client-facing documents
- `memory/` — daily notes (YYYY-MM-DD.md)
- `reviews/` — Walt review triggers
- `skills/` — custom-built skills

**Memory Drive (`/Volumes/reeseai-memory/`):**
- `agents/` — reviews, tasks, lessons, memory archives
- `photography/` — leads, outreach, pipeline, brand assets
- `data/` — databases, knowledge base
- `code/` — zipgolf, utility scripts
- `AGENT-Images/` — agent headshots and sprite sheets
