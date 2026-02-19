# Integrations Reference

> External services, APIs, and how they connect to the platform.

## Active Integrations

### Telegram
- **Channel:** Primary communication with Tyler
- **Chat ID:** 8172900205
- **Features:** DM, reactions, stickers, send messages
- **Config:** `~/.openclaw/openclaw.json` (channels.telegram)

### GitHub
- **Account:** MarcusRawlins
- **CLI:** `gh` (authenticated)
- **Use:** Version control, code hosting

### Ollama
- **URL:** http://localhost:11434
- **Models:** qwen3:4b (heartbeats), devstral (code)
- **Use:** Local model inference, zero API cost

## Planned Integrations

### Google Workspace (via `gog` CLI)
- Gmail, Calendar, Drive, Contacts
- **Status:** Not yet configured
- **Use:** Email scanning, calendar sync, document storage

### CRM
- **Status:** Not yet built
- **Planned:** SQLite-based personal CRM
- **Use:** Client relationships, photography pipeline

### Social Media Analytics
- **Status:** Not yet configured
- **Planned:** Instagram, possibly YouTube
- **Use:** Photography brand performance tracking

### Financial Tracking
- **Status:** Not yet built
- **Planned:** CSV import, P&L generation
- **Use:** Photography + SaaS revenue tracking

## Credential Storage

All API keys and tokens live in `~/.openclaw/.env` (canonical location).
See `docs/sops/SECURITY.md` for handling rules.

## Adding New Integrations

1. Document the integration here (what, why, how)
2. Add credentials to `~/.openclaw/.env`
3. Update `docs/reference/TECH-STACK.md` if it adds new tech
4. Update `docs/ARCHITECTURE.md` if it changes system structure
5. Create a skill or tool in the workspace if it needs one
