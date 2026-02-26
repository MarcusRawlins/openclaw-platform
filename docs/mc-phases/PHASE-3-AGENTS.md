# Phase 3: Agent Management

**Parent spec:** `docs/MISSION-CONTROL-REBUILD.md`
**Branch:** `mc/phase-3-agents`
**Estimated effort:** 3-4 hours
**Dependencies:** Phase 1 complete

---

## Goal

Manage agents directly from MC. See status, read lessons, toggle crons, assign work, view history.

---

## 3A: Agent Dashboard Cards

**Location:** Mission view and/or dedicated agents section

Each agent card shows:
- Avatar (with expression state)
- Name and role
- Model (from gateway config)
- Status: working / idle / reviewing / offline
- Current active task (title, or "No active task")
- Last activity timestamp
- Lesson count (number of lessons in their lessons.md)

Click agent card → opens agent detail panel.

---

## 3B: Agent Detail Panel

Slide-out panel or modal with tabs:

### Overview Tab
- Full agent config: name, model, role description
- Current status with timestamp
- Task summary: X active, Y queued, Z completed (from task board data)

### Lessons Tab
- Read and display contents of `/agents/[id]/lessons.md`
- Read-only view (edits happen through the learning system, not UI)
- Show lesson count and last modified date

### Reviews Tab
- List of Walt's reviews for this agent
- Read from `/Volumes/reeseai-memory/agents/reviews/` filtered by agent name
- Most recent first
- Click review → read full review content

### Task History Tab
- All tasks ever assigned to this agent (from task board data)
- Grouped by status: active first, then recent completed
- Click task → opens task detail

---

## 3C: Agent Actions

### Assign Task
- Button in agent detail: "Assign Task"
- Opens create task form pre-filled with this agent
- Or dropdown to assign existing queued task

### Spawn Agent
- Button: "Run Now"
- Opens prompt field: "What should [agent] do?"
- Sends via gateway sessions_spawn
- Shows spinner while running, result when complete

### Toggle Crons
- List this agent's cron jobs (read from gateway API)
- Each job shows: name, schedule, enabled/disabled, last run, next run
- Toggle switch to enable/disable each job
- Uses gateway cron API to update

### Trigger Walt Review
- Button: "Request Review"
- Triggers Walt to review this agent's needs_review tasks
- Shows confirmation when triggered

---

## 3C: Cron Management View

Accessible from System view or Agent detail.

### Cron Job List
- All cron jobs from gateway
- Columns: name, agent, schedule, enabled, last run, last status, next run
- Sort by next run time
- Filter by agent

### Cron Actions
- Enable/disable toggle per job
- "Run Now" button (triggers immediate run)
- View run history (last 10 runs with status and duration)

### Data Source
- All cron data comes from gateway API (cron list, cron runs)
- No local cron data files

---

## Review Criteria (Walt)

- [ ] Agent cards show real data from gateway (status, model, current task)
- [ ] Agent detail panel opens with all 4 tabs working
- [ ] Lessons tab displays actual content from agent's lessons.md
- [ ] Reviews tab lists real reviews from the drive
- [ ] Task history shows real tasks from task board
- [ ] "Assign Task" creates a real task assigned to the agent
- [ ] "Run Now" spawns agent via gateway and shows result
- [ ] Cron toggle enables/disables actual gateway cron jobs
- [ ] Cron list reflects real gateway cron state
- [ ] No mock data anywhere
- [ ] `bun run build` succeeds
- [ ] Mobile: agent cards and detail panel work on phone
