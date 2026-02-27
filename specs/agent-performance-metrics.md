# Agent Performance Metrics Dashboard - Spec

## Overview
Add agent-level performance tracking to Mission Control. Track quality, velocity, and reliability per agent.

## Data Source
All data comes from tasks.json. No new data collection infrastructure needed.

## Metrics Per Agent

### Quality
- **Pass rate:** tasks with reviewGrade=pass / total reviewed
- **Revision rate:** tasks that went through needs_revision / total
- **Average revisions per task:** count of status changes to needs_revision

### Velocity
- **Tasks completed (30d):** count of tasks with completedAt in last 30 days
- **Average completion time:** completedAt - createdAt for completed tasks
- **Queue depth:** current queued + active tasks

### Reliability
- **Block rate:** tasks marked blocked / total assigned
- **Timeout rate:** tasks that exceeded timeout / total

## UI Components

### Agent Performance Table
Display in Mission Control Metrics view. Columns:
- Agent name + emoji
- Tasks completed (30d)
- Pass rate (%)
- Avg completion time
- Current queue depth

### Agent Detail Modal
Click agent row to see:
- Task history (last 20 tasks with status, grade, time)
- Quality trend chart (pass rate over time)
- Common revision reasons

## API Endpoint
`GET /api/metrics/agents` - Returns agent performance data calculated from tasks.json

## Assignment
Brunel builds. Walt reviews. Marcus approves.
