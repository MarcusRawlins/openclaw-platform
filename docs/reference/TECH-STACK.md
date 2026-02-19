# Tech Stack Reference

> Approved technologies, versions, and patterns for the Reese Operations platform.

## Core Platform

| Technology | Version | Use |
|-----------|---------|-----|
| OpenClaw | 2026.2.17 | Agent runtime, gateway, cron, memory |
| Node.js | 25.6.1 | Server-side runtime |
| TypeScript | 5.x | All new code |
| SQLite | (system) | All persistent data (WAL mode) |

## Frontend

| Technology | Version | Use |
|-----------|---------|-----|
| Next.js | 15 | Dashboard framework (App Router) |
| React | 19 | UI components |
| Tailwind CSS | 4 | Styling |

## AI Models

| Model | Provider | Use | Cost |
|-------|----------|-----|------|
| Claude Opus 4.6 | Anthropic | Marcus (main agent) | Pay-per-token |
| Claude Haiku 4.5 | Anthropic | Sub-agents (primary) | Pay-per-token |
| Claude Sonnet 4.5 | Anthropic | Fallback | Pay-per-token |
| Devstral | Ollama (local) | Sub-agent fallback | Free |
| qwen3:4b | Ollama (local) | Heartbeats | Free |

## Infrastructure

| Component | Details |
|-----------|---------|
| Host | Mac mini (Apple Silicon) |
| OS | macOS (Darwin 25.3.0, arm64) |
| Shell | zsh |
| Gateway | Port 18789, loopback, token auth |
| Messaging | Telegram |
| Version Control | GitHub (MarcusRawlins) |
| Package Manager | npm |
| Local Models | Ollama |

## Approved Libraries

Use these before reaching for alternatives:
- **HTTP:** Built-in fetch (Node 25+)
- **Database:** better-sqlite3 or built-in SQLite
- **Crypto:** @noble/ed25519, @noble/hashes (already in Mission Control)
- **Styling:** Tailwind (no component libraries unless justified)
- **Testing:** Node built-in test runner

## Not Approved (avoid without discussion)

- Cloud databases (Postgres, MySQL, Supabase, etc.)
- Heavy ORMs (Prisma, TypeORM)
- CSS-in-JS libraries
- Docker (we're local-first)
- External hosting (unless specifically needed for a public-facing project)
