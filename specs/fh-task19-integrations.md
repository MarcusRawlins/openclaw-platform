# Finance Hub — Task 19: AnselAI + R3 Studios + Mission Control Integrations

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 2.3, 2.4)
> Phase 4 Overview: `/workspace/specs/fh-phase4-overview.md`
> Depends on: Task 18 (API keys)
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Connect Finance Hub to Tyler's other three applications. Mission Control gets an iframe embed. AnselAI CRM and R3 Studios dashboards get live revenue/expense widgets powered by the Finance Hub API.

## Build Location

Primary: `/Users/marcusrawlins/.openclaw/workspace/finance-hub/`
Also touches: `/Users/marcusrawlins/.openclaw/workspace/mission_control/` and `/Users/marcusrawlins/.openclaw/workspace/anselai/`

## Part 1: Mission Control Integration

### iframe Embed

MC gets a "Finance" tile on its dashboard. Clicking opens Finance Hub in an iframe.

**In Mission Control:**
- Add a dashboard tile: "Finance Hub" with a dollar sign icon
- On click: open full-width iframe pointing to `http://192.168.68.105:3300`
- Finance Hub must set `X-Frame-Options: ALLOW-FROM http://192.168.68.105:3100` or use CSP `frame-ancestors`

**In Finance Hub:**
- Add to `next.config.ts`: configure CSP headers to allow MC origin
- Add `src/lib/iframe.ts`: postMessage handler for theme sync and navigation

### postMessage Protocol

```typescript
// Messages MC → FH
interface MCToFH {
  type: 'theme-sync' | 'navigate' | 'auth-check';
  payload: {
    theme?: 'dark' | 'light';
    path?: string;        // e.g., '/anselai/reports/profit-loss'
  };
}

// Messages FH → MC
interface FHToMC {
  type: 'auth-status' | 'navigation-change' | 'ready';
  payload: {
    authenticated?: boolean;
    currentPath?: string;
  };
}
```

**In Finance Hub root layout (`layout.tsx`):**
- Listen for postMessage events from MC origin
- On theme-sync: update CSS variables (already dark theme, but support light if MC ever adds it)
- On navigate: router.push to the requested path
- On mount: send 'ready' event back to MC

**Security:** Validate `event.origin` matches MC URL. Ignore messages from other origins.

### MC Tile Component

In Mission Control, create a Finance tile component:
```tsx
// Dashboard tile: shows quick summary, click to expand iframe
<FinanceTile>
  <div>Revenue: $12,500 this month</div>
  <div>Net: +$4,160</div>
  <button>Open Finance Hub →</button>
</FinanceTile>
```

The tile fetches summary data from Finance Hub API using MC's scoped API key.

## Part 2: AnselAI CRM Widget

### Revenue Widget Component

Create a reusable widget component for AnselAI's dashboard:

**File:** `/workspace/anselai/src/components/FinanceWidget.tsx`

```tsx
interface FinanceWidgetProps {
  entityId: string;
  apiUrl: string;    // http://192.168.68.105:3300/api/v1
  apiKey: string;    // from env var
}
```

**Widget shows:**
- Current month revenue (big number)
- Current month expenses
- Net income
- Outstanding AR (invoice aging)
- Trend arrow (vs last month)
- "View Details →" link to Finance Hub

**Data source:** `GET /api/v1/entities/anselai/summary` via Finance Hub API

**Styling:** Match AnselAI's existing design system. Dark theme, same card patterns.

### Environment Config

Add to AnselAI's `.env`:
```
FINANCE_HUB_URL=http://192.168.68.105:3300/api/v1
FINANCE_HUB_API_KEY=fhk_xxxxx
```

## Part 3: R3 Studios Widget

Same pattern as AnselAI, scoped to R3 Studios entity.

**File:** `/workspace/r3-studios/src/components/FinanceWidget.tsx` (or wherever R3's dashboard lives)

Shows R3-specific financial summary. Same widget component, different entity ID and styling to match R3's design.

## Part 4: Shared Widget Package (Optional Optimization)

If AnselAI and R3 use the same tech stack (both Next.js), consider a shared package:

```
/workspace/packages/finance-widget/
├── src/
│   ├── FinanceWidget.tsx
│   ├── types.ts
│   └── api.ts         # Finance Hub API client
├── package.json
└── tsconfig.json
```

Both apps import from this package. If tech stacks differ, duplicate the component (it's small).

## API Keys Setup

During this task, create three API keys via the Task 18 management UI:

| Key Name | Entity Access | Permissions | Used By |
|----------|--------------|-------------|---------|
| Mission Control | anselai, r3studios, family | read | MC dashboard |
| AnselAI CRM | anselai | read | AnselAI widget |
| R3 Studios | r3studios | read | R3 widget |

Store key values in each app's `.env` file.

## Testing Requirements

1. **iframe:** MC opens FH in iframe, page loads without X-Frame-Options errors
2. **postMessage:** MC sends theme-sync, FH acknowledges. MC sends navigate, FH changes route.
3. **AnselAI widget:** Renders revenue data from API, handles loading and error states
4. **R3 widget:** Same as AnselAI but scoped to R3
5. **API key scoping:** MC key can access all entities, AnselAI key cannot access R3 data
6. **Network failure:** Widget shows graceful error state when FH is unreachable

## Constraints

- **MC never proxies financial data.** It's a window (iframe), not a pipe.
- **Widgets are read-only.** No write operations from external apps.
- **API calls are server-side** where possible (don't expose API keys in client bundles).
- **Validate postMessage origins.** Never trust messages from unverified origins.
