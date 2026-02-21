# Build Backlog — Brunel Edison

## Priority 0: Mission Control — Task & Review System
**CURRENT FOCUS — Pausing AnselAI until this is done**

Mission Control needs a real task management system so Tyler can see what every agent is working on, what's ready for review, and what's done.

### Task Board Requirements:
- Real tasks (not demo data), backed by JSON or SQLite
- 4 columns: QUEUED → ACTIVE → NEEDS REVIEW → DONE
- Every task has: title, description, assigned agent, status, created date, updated date, review notes
- Tasks assigned to Marcus = Marcus triages to the best agent
- Agents move tasks to NEEDS REVIEW when done
- Walt reviews NEEDS REVIEW items hourly (or on manual trigger)
- Walt moves to DONE (pass) or back to ACTIVE (needs revision with feedback)

### Blueprint View:
- Click an agent → see their current active task
- Agent status reflects their task state (working, idle, reviewing)

### Walt's Review Trigger:
- "Get to Work" button on Walt's icon in Blueprint
- Triggers immediate check of NEEDS REVIEW queue
- Also runs on hourly cron

### API needed:
- CRUD for tasks
- Assign/reassign tasks
- Change status
- Trigger Walt review

### Modules:
- [ ] MC-1: Task data model + API routes (CRUD, status changes)
- [ ] MC-2: Task board UI (4 columns, drag between columns, assign to agent)
- [ ] MC-3: Blueprint integration (show current task per agent, click to see details)
- [ ] MC-4: Walt review trigger (button + hourly cron)
- [ ] MC-5: Agent status sync (agent activity updates task status)

## Priority 1: AnselAI (Photography CRM)
**Architecture doc:** `docs/ANSELAI-ARCHITECTURE.md`
**Build location:** `/Users/marcusrawlins/.openclaw/workspace/anselai/`
**Status:** Starting Module 1A

This is Brunel's primary project. When not on urgent tasks, he should be working through these modules in order. Each module needs review and approval before moving to the next.

### Current Module: 1A — Scaffolding
### Completed: (none yet)

### Full Module List:
- [ ] 1A: Scaffolding (Next.js + Prisma + dark theme + port 3200)
- [ ] 1B: Layout shell (sidebar, nav, responsive)
- [ ] 1C: Contacts CRUD
- [ ] 1D: Projects + Pipeline Kanban
- [ ] 1E: Project detail page
- [ ] 2A: Tasks
- [ ] 2B: Calendar
- [ ] 2C: Dashboard
- [ ] 3A: Vendors & wedding party
- [ ] 3B: Family formals & timeline
- [ ] 3C: Interaction log
- [ ] 4A: Google OAuth
- [ ] 4B: Google Calendar sync
- [ ] 4C: Gmail integration
- [ ] 5A: Marcus database access
- [ ] 5B: Marcus automations
- [ ] 5C: Mission Control tab
- [ ] 6A: Client auth & portal shell
- [ ] 6B: Client project view
- [ ] 6C: Client questionnaire
- [ ] 6D: Client gallery & documents
- [ ] 6E: Client communication

## Priority 2: ZipGolf
Feature work as assigned.

## Priority 3: R3 Studios Demo Sites
Build demo sites for qualified prospects from Scout/Ed pipeline.

## Priority 4: Mission Control Improvements
Bug fixes and enhancements as needed.

## Priority 5: Internal Tooling
Scripts, automations, utilities as needed.
