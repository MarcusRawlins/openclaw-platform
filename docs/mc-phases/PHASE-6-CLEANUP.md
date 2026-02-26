# Phase 6: Cleanup & Polish

**Parent spec:** `docs/MISSION-CONTROL-REBUILD.md`
**Branch:** `mc/phase-6-cleanup`
**Estimated effort:** 2-3 hours
**Dependencies:** All other phases complete

---

## Goal

Remove dead code, optimize performance, ensure production quality across all views.

---

## 6A: Remove Dead Components

### Audit every component
Check each file in `components/` against actual usage:

**Likely removals (unless connected to real data):**
- `FacebookAdsWidget.tsx` — no Facebook integration exists
- `GoogleAnalyticsWidget.tsx` — no GA integration exists
- `GoogleReviewsWidget.tsx` — no Google Reviews integration exists
- `InstagramAnalyticsWidget.tsx` — no Instagram API integration exists
- `WhiteboardPanel.tsx` — replaced by task board
- `R3DemosShowcase.tsx` — unless connected to real demo data
- `PhotographyContentHub.tsx` — if replaced by Phase 5 content view
- `R3StudiosContentHub.tsx` — if replaced by Phase 5 content view

### Audit every API route
Check each route in `app/api/` against actual usage:

**Likely removals:**
- `facebook-ads/` — no integration
- `ga-data/` — no integration
- `instagram-stats/` — no integration
- `meta-oauth/` — no Meta integration active
- `whiteboard/` — if whiteboard removed
- `r3-content/` and `r3-demos/` — if consolidated into content view
- `photography-content/` — if consolidated into content view

### Audit lib files
- Remove any lib files only used by removed components
- Check for unused exports

### Rules
- Only remove components that are truly unused
- If uncertain, check imports: `grep -r "ComponentName" --include="*.tsx" --include="*.ts"`
- Remove the import AND the file

---

## 6B: Performance

### Lazy Loading
- Views that aren't visible on initial load should use `dynamic()` import
- Task board, content view, documents view, financial view can all lazy load

### WebSocket Optimization
- Single WebSocket connection shared across all components (already done via useGateway hook)
- Reconnection with exponential backoff (verify this works)
- Don't create new connections per component

### Reduce Re-renders
- Memoize expensive computations
- Use `useMemo` and `useCallback` where polling data triggers re-renders
- Task board polling should only update state if data actually changed

### Build Size
- Run `bun run build` and check output size
- Remove unused dependencies from `package.json`

---

## 6C: Mobile Responsiveness

### Test all views at these widths:
- 375px (iPhone SE)
- 390px (iPhone 14)
- 768px (iPad)
- 1024px (iPad landscape / small laptop)

### Requirements per view:
- **Mission/Overview:** Agent cards stack vertically on mobile. Stats summarize.
- **Task Board:** Horizontal scroll for columns on mobile. Cards full-width.
- **Agent Detail:** Full-screen panel on mobile (not side panel).
- **Pipeline:** Horizontal scroll for stages on mobile.
- **Content/Documents:** List view, full-width cards.
- **System:** Stacked cards, no side-by-side on mobile.

### Navigation
- Top bar collapses to hamburger menu on mobile
- View tabs become scrollable or dropdown

---

## Review Criteria (Walt)

- [ ] `grep -r` confirms removed components have zero references
- [ ] No unused imports in any file
- [ ] `bun run build` succeeds with no warnings
- [ ] Build output size is reasonable (no bloat from unused deps)
- [ ] All views render correctly at 375px width
- [ ] All views render correctly at 768px width
- [ ] Navigation works on mobile
- [ ] WebSocket reconnects cleanly after disconnect
- [ ] No console errors in browser dev tools
- [ ] Page load time under 3 seconds on localhost
- [ ] Clean git history: no leftover debug code, console.logs, or TODOs
