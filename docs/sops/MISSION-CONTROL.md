# SOP: Mission Control Development

> Standards for building and modifying the Mission Control dashboard.

## Codebase

- **Location:** `mission_control/`
- **Origin:** Forked from jwtidwell/mission_control
- **Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5
- **Port:** 3100
- **Data:** Local JSON files + WebSocket to OpenClaw gateway

## Architecture Decisions

- **Build from Jeff's codebase.** Don't rewrite from scratch.
- **Keep the architecture, reshape the content.** The scaffolding scales for growth.
- **Features we're keeping:** Blueprint view, agent expressions, templates, whiteboard, cron management, gateway integration, auth, CRUD patterns
- **Only stripping:** Demo data and agent-specific content we'll replace

## Development Process

1. **Branch:** Always work on a feature branch
2. **Scope:** One panel/feature per branch
3. **Test locally:** `npm run dev` on port 3100
4. **Review:** Brunel builds, Marcus reviews, Tyler approves
5. **Merge:** Only after review passes

## Panel Architecture

Mission Control is organized into panels. Each panel is:
- A self-contained React component
- Responsible for its own data fetching
- Consistent with the existing modal/card patterns

### Planned Panels

| Panel | Domain | Data Source |
|-------|--------|------------|
| Agent Status | AI operations | Gateway WebSocket |
| Photography Pipeline | Wedding business | TBD (CRM/calendar) |
| Financial Overview | Revenue tracking | TBD (financials DB) |
| Client CRM | Relationships | TBD (CRM DB) |
| Content Analytics | Social performance | TBD (social tracker) |
| Cron Health | System reliability | Gateway cron API |

## Code Standards

- **TypeScript** for all new code
- **Components:** One component per file, named exports
- **Styles:** Tailwind classes, no inline CSS (except CSS variables from the existing codebase)
- **State:** React hooks, minimize prop drilling
- **API routes:** Thin proxy layer, business logic in `lib/`

## Anti-Patterns

- ❌ Adding external dependencies without checking if Tailwind/existing libs cover it
- ❌ Building custom components when the existing modal/card system works
- ❌ Hardcoding data that should come from the gateway or a database
- ❌ Large monolithic components (decompose at ~200 lines)
