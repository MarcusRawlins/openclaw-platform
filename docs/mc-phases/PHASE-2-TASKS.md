# Phase 2: Task System

**Parent spec:** `docs/MISSION-CONTROL-REBUILD.md`
**Branch:** `mc/phase-2-tasks`
**Estimated effort:** 4-6 hours
**Dependencies:** Phase 1 complete

---

## Goal

Make the task board the operational center. Tyler assigns work, agents process it, Walt reviews it, everything is visible.

---

## 2A: Task Board UI

**Component:** `components/TaskBoard.tsx` (exists, needs polish)

### Columns
- QUEUED → ACTIVE → NEEDS_REVIEW → DONE
- Each column shows count badge
- Tasks ordered by priority within column, then by date

### Task Card
- Title (truncated to 1 line)
- Assigned agent (avatar + name)
- Priority indicator (🔴 high, 🟡 medium, ⚪ low)
- Age (e.g., "2h ago", "3d ago")
- Click → opens detail panel

### Task Detail Panel
- Full title and description
- Assigned agent (with reassign dropdown)
- Status (with manual override dropdown)
- Priority (editable)
- Created date, updated date, completed date
- Status history (timeline of state changes with timestamps)
- Review notes (Walt's feedback, with grade)
- Module/category tag (optional)

### Create Task
- Button in top bar or per-column
- Form: title (required), description, assign to agent (dropdown of all agents), priority (default: medium)
- Creates task in QUEUED status

### Drag and Drop
- Drag task cards between columns
- Triggers status update via API
- Visual feedback during drag

### Filters
- By agent (dropdown, multi-select)
- By status (tab/toggle for each column)
- By priority
- Search by title

### Sort
- By date (newest/oldest)
- By priority
- By agent name

---

## 2B: Task API

**Existing routes (verify and harden):**

### `GET /api/tasks`
- Returns all tasks
- Query params: `?status=queued&assignedTo=brunel&priority=high`
- Response: `{ tasks: [...] }`

### `POST /api/tasks`
- Body: `{ title, description, assignedTo, priority, module }`
- Auto-sets: `id` (uuid), `status: "queued"`, `createdAt`, `updatedAt`
- Initializes `statusHistory: [{ status: "queued", at: timestamp }]`

### `PATCH /api/tasks/[id]`
- Update any field: title, description, assignedTo, priority, module
- Auto-updates `updatedAt`

### `PATCH /api/tasks/[id]/status`
- Body: `{ status, notes? }`
- Valid transitions: queued→active, active→needs_review, needs_review→done, needs_review→active, any→queued (reassign)
- Appends to `statusHistory` array
- If status is "done", sets `completedAt`

### `POST /api/tasks/review`
- Body: `{ taskId, grade, notes }`
- Grade: "PASS", "PASS_WITH_NOTES", "NEEDS_REVISION"
- If PASS: status → done
- If NEEDS_REVISION: status → active, notes saved as `reviewNotes`
- Appends review to `statusHistory`

### `POST /api/tasks/trigger-review`
- Triggers Walt review (writes trigger file or spawns Walt directly)

### Data Format (task object)
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "assignedTo": "agent-id | null",
  "status": "queued | active | needs_review | done",
  "priority": "high | medium | low",
  "module": "string | null",
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp",
  "completedAt": "ISO timestamp | null",
  "reviewGrade": "PASS | PASS_WITH_NOTES | NEEDS_REVISION | null",
  "reviewNotes": "string | null",
  "statusHistory": [{ "status": "string", "at": "ISO timestamp", "notes": "string?" }]
}
```

---

## 2C: Agent-Task Integration

### Blueprint View Updates
- Each agent card shows their current active task title (if any)
- Task count badge: number of tasks assigned to agent
- Status reflects task state: has active task = "working", has needs_review = "reviewing", all done = "idle"

### Cron Integration
- When agent crons run and pick up a task, the task status should update
- Cron task prompts should include: "Update task status via API when starting and completing work"
- This is a prompt change, not a code change

### Real-time Updates
- Task board should poll `/api/tasks` every 30 seconds (or use WebSocket if available)
- Agent status updates should reflect task changes

---

## Review Criteria (Walt)

- [ ] Can create a task from the UI with title, description, agent, priority
- [ ] Task appears in QUEUED column
- [ ] Can drag task between columns, status updates correctly
- [ ] Task detail panel shows all fields including status history
- [ ] Filter by agent works
- [ ] Filter by priority works
- [ ] Search by title works
- [ ] Sort by date and priority work
- [ ] API routes all work (test each with curl)
- [ ] Review endpoint correctly moves tasks to done or back to active
- [ ] No mock tasks — board shows only real data
- [ ] Blueprint view shows agent's current active task
- [ ] `bun run build` succeeds
- [ ] Mobile: task board is usable on phone-width viewport
