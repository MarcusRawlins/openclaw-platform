# Mission Control: Full Architecture & Build Plan

**Author:** Marcus Rawlins
**Date:** 2026-02-24
**Status:** Active specification. Brunel builds. Walt reviews against this doc.

---

## What MC Is

Mission Control is the operational dashboard for the Reese team. It gives Tyler (and Marcus) a single screen to see what every agent is doing, assign work, review output, track costs, and manage the business pipeline.

**Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5
**Port:** 3100
**Data:** JSON files (current), migrating to SQLite where needed
**Gateway:** WebSocket connection to OpenClaw gateway on port 18789

---

## Current State (Honest Assessment)

**Working:**
- Dashboard renders and serves on port 3100
- Task board exists with 57 tasks, CRUD API routes work
- Agent avatars with expressions system
- TopBar with view navigation
- 5 views exist: Mission, Tasks, Documents, System, Metrics
- Gateway WebSocket client code exists
- LaunchD service keeps it running 24/7

**Broken:**
- Gateway chat/messaging: paths reference `clawd/` instead of `.openclaw/`
- Gateway sync hardcodes `/Users/admin/clawd/` paths
- Agent config references stale model names
- Chat modal connects but messages don't flow correctly
- Blueprint view has placeholder data mixed with real data

**Incomplete:**
- CRM view has mock data only
- Financial view has mock data only
- Pipeline view has mock data only
- Content views are scaffolded but not connected to real files
- Metrics view lacks real usage data
- No real cost tracking connected to gateway

---

## Architecture Principles

1. **Real data only.** No mock data in production views. If data doesn't exist yet, the view shows an empty state with a clear message.
2. **Gateway is the source of truth** for agent status, sessions, and messaging. MC reads from gateway, not local files.
3. **JSON files are fine for now.** Tasks, pipeline, and CRM can stay JSON-backed. SQLite migration is a future phase.
4. **Dark theme only.** Use CSS variables consistently: `var(--bg-primary)`, `var(--bg-card)`, `var(--bg-secondary)`, `var(--border)`, `var(--text-primary)`, `var(--text-muted)`, `var(--accent)`.
5. **No dead code.** If a feature isn't connected, remove the component. Don't ship placeholder widgets.
6. **Mobile-friendly.** Responsive layouts. Works from Tyler's phone.

---

## Phase 1: Foundation Fix (Unblock Everything)

**Goal:** Fix broken paths and connections so MC can talk to the gateway and display real agent state.

### 1A: Fix Gateway Paths
- `lib/gateway-sync.ts`: Replace all `clawd/` references with `.openclaw/` paths
  - `AGENTS_WORKSPACE_ROOT` → `/Users/marcusrawlins/.openclaw/agents`
  - `WHITEBOARD_PATH` → remove (we don't use a whiteboard file)
  - `workspace` paths → `/Users/marcusrawlins/.openclaw/workspace`
- `lib/system-prompt.ts`: Update any hardcoded paths
- `lib/agents-config.ts`: Verify agent IDs match gateway config (main, brunel, scout, dewey, ed, ada, walt)

### 1B: Fix Gateway Chat
- `components/ChatModal.tsx`: Verify WebSocket message flow
- `lib/gateway-client.ts`: Test connect → send message → receive response
- `components/InlineChatPanel.tsx`: Same fixes
- **Test:** Open MC, click Marcus avatar, send "hello", get a response. If this works, chat is fixed.

### 1C: Fix Agent Status Display
- `lib/use-gateway.ts`: Ensure real-time agent status comes from gateway sessions
- `components/MissionControl.tsx`: Agent status should reflect: idle, working (has active session), reviewing
- `components/BlueprintView.tsx`: Remove any mock/placeholder data. Show real agent state.

**Walt's Review Criteria for Phase 1:**
- [ ] No `clawd/` references anywhere in codebase
- [ ] Chat works: can send a message to Marcus and get a response
- [ ] Agent status is real-time from gateway, not mock data
- [ ] `bun run build` succeeds with no errors
- [ ] No TypeScript errors

---

## Phase 2: Task System (Core Workflow)

**Goal:** Make the task board the operational center. Tyler can assign work, agents process it, Walt reviews it.

### 2A: Task Board Polish
- 4 columns: QUEUED → ACTIVE → NEEDS_REVIEW → DONE
- Drag-and-drop between columns
- Click task → full detail panel (title, description, assigned agent, status history, review notes, timestamps)
- Create task form: title, description, assign to agent, priority
- Filter by: agent, status, priority
- Sort by: date, priority, agent

### 2B: Task API Hardening
- `POST /api/tasks` — create task
- `GET /api/tasks` — list all (with filters)
- `PATCH /api/tasks/[id]` — update any field
- `PATCH /api/tasks/[id]/status` — change status (with timestamp logging)
- `POST /api/tasks/review` — Walt's review endpoint (grade, notes, lesson updates)
- `POST /api/tasks/trigger-review` — manual Walt trigger
- All mutations log timestamps in a `statusHistory` array on the task object

### 2C: Agent-Task Integration
- When an agent starts a task (cron or spawn), MC task status updates to ACTIVE
- When an agent completes, status updates to NEEDS_REVIEW
- When Walt reviews, status updates to DONE or back to ACTIVE with notes
- Blueprint view shows each agent's current active task

**Walt's Review Criteria for Phase 2:**
- [ ] Can create a task, assign to agent, and see it in QUEUED
- [ ] Can drag task to different columns
- [ ] Task detail panel shows all fields and history
- [ ] API routes all work (test each endpoint)
- [ ] Filter and sort work
- [ ] No mock tasks in the board — only real data

---

## Phase 3: Agent Management (Control Panel)

**Goal:** Manage agents directly from MC without touching config files.

### 3A: Agent Dashboard
- Each agent card shows: name, model, status, current task, last activity, lesson count
- Click agent → detail panel: full config, lessons, recent reviews, task history
- Agent lessons viewer: read from `/agents/[id]/lessons.md`

### 3B: Agent Actions
- Toggle agent on/off (enable/disable cron jobs)
- Assign task to agent
- Spawn agent for one-off work
- View agent's session history (recent messages)
- Trigger Walt review of agent's work

### 3C: Cron Job Management
- View all cron jobs with status (enabled/disabled, last run, next run)
- Enable/disable crons from MC
- View cron run history
- These read from gateway API, not local files

**Walt's Review Criteria for Phase 3:**
- [ ] All agent data is real (from gateway + agent files)
- [ ] Can toggle agent crons on/off
- [ ] Can assign task to any agent
- [ ] Agent detail panel shows real lessons, reviews, task history
- [ ] Cron management reflects actual gateway state

---

## Phase 4: Business Views (Revenue Tracking)

**Goal:** Connect real business data to MC so Tyler can see pipeline, financials, and client status.

### 4A: Pipeline View
- Lead sources: Scout's leads from `/Volumes/reeseai-memory/photography/leads/`
- Stages: Lead → Contacted → Responded → Meeting → Proposal → Booked → Completed
- Move leads between stages
- Each lead shows: business name, contact, source, status, last touched, notes
- Separate pipelines for: Photography (By The Reeses) and SaaS (R3 Studios)

### 4B: Financial View
- Revenue tracking (manual entry for now, AnselAI integration later)
- Cost tracking: API costs from gateway usage data
- Monthly/quarterly views
- Target tracking: $10k/mo R3, $250k/yr photography
- Simple charts (no complex dashboards)

### 4C: Client/CRM View
- Photography clients from AnselAI data (when available)
- R3 Studios prospects from Scout's leads
- Contact history from Ed's outreach
- Basic contact management

**Walt's Review Criteria for Phase 4:**
- [ ] Pipeline reads real lead data from drive
- [ ] Financial view shows real API costs from gateway
- [ ] No mock data anywhere
- [ ] Empty states are clear and informative
- [ ] Revenue targets displayed accurately

---

## Phase 5: Content & Documents (Visibility)

**Goal:** See all content the team is producing without digging through file systems.

### 5A: Content View
- Blog posts: list from `/Volumes/reeseai-memory/photography/content/blog/`
- Social content: list from content directories
- Outreach emails: list from Ed's output directory
- Click to preview content
- Status: draft, reviewed, published

### 5B: Documents View
- Key documents: BRAND-VOICE.md, ARCHITECTURE.md, PRD.md, etc.
- Agent lessons files
- SOPs
- Click to read, basic navigation

### 5C: System View
- Gateway status and uptime
- Ollama model status
- Disk usage on memory drive
- Recent errors/alerts
- Service health (MC, gateway, Ollama)

**Walt's Review Criteria for Phase 5:**
- [ ] Content view reads real files and displays them
- [ ] Documents are browsable and readable
- [ ] System view shows real service status
- [ ] No placeholder data

---

## Phase 6: Cleanup & Polish

**Goal:** Remove all dead code, optimize performance, ensure everything is production-quality.

### 6A: Remove Dead Components
- Remove any widgets not connected to real data (FacebookAdsWidget, GoogleAnalyticsWidget, GoogleReviewsWidget, InstagramAnalyticsWidget, etc. — unless connected)
- Remove unused API routes
- Remove unused lib files

### 6B: Performance
- Lazy load heavy views
- Optimize WebSocket reconnection
- Reduce unnecessary re-renders

### 6C: Mobile Responsiveness
- Test all views on mobile viewport
- Ensure task board is usable on phone
- Agent management works on tablet

**Walt's Review Criteria for Phase 6:**
- [ ] No unused components in codebase
- [ ] No unused API routes
- [ ] Clean build with no warnings
- [ ] Mobile responsive on all views
- [ ] Performance: dashboard loads in under 3 seconds

---

## Build Rules for Brunel

1. **One phase at a time.** Complete Phase 1 before starting Phase 2.
2. **Build it, don't plan it.** If your commit doesn't include working code, it's not done.
3. **Test before submitting.** Run `bun run build`. Click through the UI. Verify API routes with curl.
4. **Feature branches.** Never push to main. Branch per phase: `mc/phase-1-foundation`, `mc/phase-2-tasks`, etc.
5. **Commit after each sub-task.** Don't do the whole phase in one giant commit.
6. **Ask Marcus if unclear.** Don't guess at requirements. Send a question via sessions_send.
7. **Read your lessons.** `/agents/brunel/lessons.md` exists for a reason.
8. **Use existing CSS variables.** Don't hardcode colors.
9. **No new dependencies** without asking Marcus first.

---

## Review Rules for Walt

1. **Review against this spec.** If the spec says "no mock data," and you find mock data, it fails.
2. **Test the actual UI.** Don't just read code. Open MC in a browser and click things.
3. **Check the build.** `bun run build` must succeed.
4. **Check mobile.** Resize the browser window.
5. **Grade per phase.** Each phase gets a grade. 95% to pass.
6. **Specific feedback.** Quote the code or UI element. Give the fix.
7. **Update Brunel's lessons** when patterns emerge.

---

## Priority & Timeline

| Phase | Description | Estimated Effort | Dependencies |
|-------|------------|-----------------|--------------|
| 1 | Foundation Fix | 2-3 hours | None |
| 2 | Task System | 4-6 hours | Phase 1 |
| 3 | Agent Management | 3-4 hours | Phase 1 |
| 4 | Business Views | 4-6 hours | Phase 2 |
| 5 | Content & Documents | 3-4 hours | Phase 1 |
| 6 | Cleanup & Polish | 2-3 hours | All phases |

Phases 2 and 3 can run in parallel after Phase 1.
Phases 4 and 5 can run in parallel after Phase 2.
Phase 6 is always last.

---

## Success Criteria

MC is "fully operational" when Tyler can:
1. Open the dashboard and see real agent status
2. Chat with Marcus from MC
3. Create tasks and assign them to agents
4. Watch tasks flow through QUEUED → ACTIVE → REVIEW → DONE
5. See Scout's leads in a pipeline view
6. See Ed's outreach drafts
7. See Ada's content output
8. Track API costs
9. Manage agent crons
10. Do all of this from his phone

That's the finish line.
