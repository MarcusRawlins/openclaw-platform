# SOP: Mission Control Development

> Standards for building and modifying the Mission Control dashboard.

## Codebase

- **Location:** `mission_control/`
- **Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5
- **Port:** 3100
- **Data:** Local JSON files + WebSocket to OpenClaw gateway on port 18789
- **Service:** Managed by LaunchD (see MISSION-CONTROL-SERVICE.md)

## Architecture Spec

**The canonical spec is:** `docs/MISSION-CONTROL-REBUILD.md`

All build work follows that document. Phase specs are in `docs/mc-phases/`. Do not create competing specs. If something needs to change, update the canonical spec.

## Development Rules

1. Feature branches only. Never push to main. Branch naming: `mc/phase-X-description`
2. `bun run build` must succeed before submitting for review
3. Use existing CSS variables: `var(--bg-primary)`, `var(--bg-card)`, `var(--bg-secondary)`, `var(--border)`, `var(--text-primary)`, `var(--text-muted)`, `var(--accent)`
4. No hardcoded colors. No inline styles for colors.
5. No new dependencies without Marcus's approval
6. Test in browser before submitting. Click the UI. Verify API routes with curl.
7. No mock data in production views. Empty states are fine.
8. Commit after each sub-task, not one giant commit per phase.

## Gateway Integration

- Gateway URL: `ws://{hostname}:18789`
- Gateway token: stored in settings (not hardcoded)
- All agent paths use `~/.openclaw/` (never `clawd/`)
- Workspace: `/Users/marcusrawlins/.openclaw/workspace`
- Agent configs: `/Users/marcusrawlins/.openclaw/agents/`
