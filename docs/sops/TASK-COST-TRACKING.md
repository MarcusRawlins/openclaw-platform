# Task Cost Tracking

## Overview

Task Cost Tracking measures real token usage and calculates actual monetary cost for every task completion in Mission Control.

**Status:** Implemented and integrated  
**Location:** `/lib/cost-calculator.ts`, `/lib/task-cost-integration.ts`, `/app/api/task-cost/route.ts`, `/components/TaskCostDisplay.tsx`

---

## How It Works

### 1. Cost Calculator (`lib/cost-calculator.ts`)

Provides cost calculation utilities:

```typescript
// Calculate cost for a single session
calculateSessionCost(usage: SessionUsage): number

// Aggregate costs for multiple sessions (used for multi-agent tasks)
aggregateTaskCost(sessions: SessionUsage[]): TaskCost
```

**Supported Models & Pricing (USD per 1M tokens):**

| Model | Input | Output | Cache Read | Cache Write |
|-------|-------|--------|------------|-------------|
| Claude Sonnet 4.5 | $3.00 | $15.00 | $0.30 | $3.75 |
| Claude Haiku 4.5 | $0.25 | $1.25 | $0.025 | $0.3125 |
| Claude Opus 4.6 | $15.00 | $75.00 | $1.50 | $18.75 |
| GPT-4 Turbo | $10.00 | $30.00 | - | - |
| Ollama (local) | Free | Free | Free | Free |

### 2. API Endpoint (`app/api/task-cost/route.ts`)

**POST /api/task-cost**

Calculate and store cost for a task:

```bash
curl -X POST http://localhost:3100/api/task-cost \
  -H 'Content-Type: application/json' \
  -d '{
    "taskId": "abc-123",
    "sessions": [
      {
        "agent": "brunel",
        "model": "anthropic/claude-sonnet-4-5",
        "inputTokens": 5000,
        "outputTokens": 3000,
        "cacheReadTokens": 0,
        "cacheWriteTokens": 0
      }
    ]
  }'
```

**Response:**

```json
{
  "taskId": "abc-123",
  "actualCost": 0.045,
  "tokensUsed": {
    "input": 5000,
    "output": 3000,
    "cacheRead": 0,
    "cacheWrite": 0
  },
  "modelBreakdown": [
    {
      "model": "anthropic/claude-sonnet-4-5",
      "agent": "brunel",
      "input": 5000,
      "output": 3000,
      "cacheRead": 0,
      "cacheWrite": 0,
      "cost": 0.045
    }
  ]
}
```

**GET /api/task-cost?taskId=abc-123**

Fetch previously calculated cost for a task.

### 3. Integration (`lib/task-cost-integration.ts`)

Provides helpers for using the cost tracking system:

```typescript
// Record cost for a task completion
await recordTaskCost(taskId, sessions)

// Fetch cost data for a task
await getTaskCost(taskId)

// Format cost for display
formatCost(0.045)  // → "$0.0450"
formatTokens(1500000)  // → "1.5M"
```

### 4. Display Component (`components/TaskCostDisplay.tsx`)

React component for displaying cost in task UI:

```tsx
<TaskCostDisplay 
  taskId="abc-123"
  compact={true}           // Show inline summary only
  showBreakdown={false}    // Show per-model breakdown
/>
```

Output (compact):
```
💰 $0.0450 • 8.0K tokens
```

Output (full):
```
Total Cost: $0.0450
Input tokens: 5.0K
Output tokens: 3.0K

By Model:
claude-sonnet-4-5 (brunel): $0.0450
```

---

## Integration Points

### When to Record Costs

Cost tracking is automatically triggered when:

1. A task moves from `active` → `needs_review`
2. A task moves from `active` → `done`
3. Task completion API is called

### Example: Integrate into Task Update Handler

```typescript
// When task is marked complete
const sessions = await fetchTaskSessions(taskId, task.createdAt, task.updatedAt);
const costData = await recordTaskCost(taskId, sessions);

// Update task record
task.actualCost = costData.actualCost;
task.tokensUsed = costData.tokensUsed;
task.modelBreakdown = costData.modelBreakdown;
```

---

## Data Model

### Updated Task Schema

```typescript
interface Task {
  id: string;
  title: string;
  status: "queued" | "active" | "needs_review" | "done";
  createdAt: string;
  completedAt?: string;
  
  // NEW: Cost tracking fields
  actualCost?: number;              // USD
  tokensUsed?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  modelBreakdown?: Array<{
    model: string;
    agent: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
  }>;
}
```

---

## Display in Mission Control

### Task Cards

Add cost badge to task cards:

```tsx
{task.actualCost !== undefined && (
  <TaskCostDisplay taskId={task.id} compact={true} />
)}
```

### Metrics Dashboard

Show cost metrics in agent performance dashboard:

```tsx
<MetricCard
  title="Cost per Task (avg)"
  value={formatCost(totalCost / completedTasks)}
/>

<MetricCard
  title="Total Tokens Used (24h)"
  value={formatTokens(totalTokens)}
/>
```

---

## Testing

### Unit Tests

```bash
# Test cost calculation
npm test -- cost-calculator.test.ts

# Test API endpoint
npm test -- api/task-cost.test.ts
```

### Manual Testing

1. Create a task and complete it
2. Call POST /api/task-cost with sample session data
3. Verify cost is calculated correctly
4. Check that task in tasks.json has `actualCost`, `tokensUsed`, `modelBreakdown`
5. Render TaskCostDisplay component and verify UI

### Acceptance Criteria

- [ ] All paid models calculate cost correctly
- [ ] Free models (Ollama) show $0 cost with token counts
- [ ] Multi-agent tasks aggregate costs by model and agent
- [ ] Cost persists to tasks.json
- [ ] UI displays costs accurately
- [ ] Build passes with no TypeScript errors

---

## Future Enhancements

1. **Cost Budgets:** Set per-task budgets and alert when exceeded
2. **Trends:** Track cost trends over time per agent
3. **Optimizations:** Recommend model changes to reduce costs
4. **Export:** Generate cost reports by date range, agent, task type
5. **Real-time Updates:** Stream costs as task runs (if Gateway supports)

---

## Troubleshooting

### Cost shows $0.00 for all tasks

**Cause:** No session data provided, or all sessions use free models  
**Fix:** Verify sessions are being captured from Gateway API

### Cost calculation seems wrong

**Cause:** Model pricing not updated, or token counts incorrect  
**Fix:** Check MODEL_PRICING table matches current API rates, verify token counts from session data

### Task doesn't have cost data

**Cause:** recordTaskCost() not called when task completed  
**Fix:** Ensure task completion handler calls recordTaskCost()

---

## Files

- `/lib/cost-calculator.ts` - Cost calculation utilities
- `/lib/task-cost-integration.ts` - Integration helpers
- `/app/api/task-cost/route.ts` - API endpoint
- `/components/TaskCostDisplay.tsx` - Display component
- `/docs/sops/TASK-COST-TRACKING.md` - This file

---

## API Reference

### MODEL_PRICING

```typescript
export const MODEL_PRICING: Record<string, {
  input: number;     // $/1M input tokens
  output: number;    // $/1M output tokens
  cacheRead: number; // $/1M cache read tokens
  cacheWrite: number;// $/1M cache write tokens
}>
```

### calculateSessionCost(usage)

```typescript
function calculateSessionCost(usage: SessionUsage): number
```

Calculate cost for a single session (one agent, one model).

**Parameters:**
- `usage.model` - Model identifier (e.g., "anthropic/claude-sonnet-4-5")
- `usage.inputTokens` - Number of input tokens used
- `usage.outputTokens` - Number of output tokens used
- `usage.cacheReadTokens` - Number of cached tokens read
- `usage.cacheWriteTokens` - Number of tokens written to cache

**Returns:** Cost in USD (number)

### aggregateTaskCost(sessions)

```typescript
function aggregateTaskCost(sessions: Array<SessionUsage & { agent: string }>): TaskCost
```

Aggregate costs from multiple sessions (for multi-agent tasks).

**Parameters:**
- `sessions` - Array of session usages with agent IDs

**Returns:** `TaskCost` object with `actualCost`, `tokensUsed`, `modelBreakdown`
