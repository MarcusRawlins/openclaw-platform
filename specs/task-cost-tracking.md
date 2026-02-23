# Task Cost Tracking - Implementation Spec

**Assigned to:** Brunel  
**Priority:** HIGH  
**Estimated effort:** 2-3 hours  
**Dependencies:** None (uses existing Gateway API)

---

## Objective

Track actual token usage and cost for every task completion. Display real cost data in Mission Control, not estimates.

---

## Data Model Changes

### tasks.json additions:

```typescript
interface Task {
  // ... existing fields ...
  
  // NEW FIELDS:
  actualCost?: number;              // Total USD cost for task completion
  tokensUsed?: {
    input: number;                  // Total input tokens
    output: number;                 // Total output tokens
    cacheRead: number;              // Cached tokens read
    cacheWrite: number;             // Cached tokens written
  };
  modelBreakdown?: Array<{
    model: string;                  // e.g. "anthropic/claude-sonnet-4-5"
    agent: string;                  // e.g. "brunel"
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;                   // USD cost for this model
  }>;
  timeSpent?: number;               // Total seconds spent (updatedAt - createdAt when status=active)
}
```

---

## Model Pricing (USD per 1M tokens)

```typescript
const MODEL_PRICING = {
  // Anthropic
  "anthropic/claude-opus-4-6": {
    input: 15.00,
    output: 75.00,
    cacheRead: 1.50,
    cacheWrite: 18.75
  },
  "anthropic/claude-sonnet-4-5": {
    input: 3.00,
    output: 15.00,
    cacheRead: 0.30,
    cacheWrite: 3.75
  },
  "anthropic/claude-haiku-4-5": {
    input: 0.25,
    output: 1.25,
    cacheRead: 0.025,
    cacheWrite: 0.3125
  },
  
  // OpenAI
  "openai/gpt-4-turbo-2024-04-09": {
    input: 10.00,
    output: 30.00,
    cacheRead: 0,
    cacheWrite: 0
  },
  
  // Local models (free but track usage)
  "ollama/devstral": {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0
  },
  "ollama/qwen3:4b": {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0
  },
  "ollama/qwen3-vl:8b": {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0
  }
};
```

---

## Implementation Steps

### Step 1: Create Cost Calculator Utility

**File:** `/lib/cost-calculator.ts`

```typescript
export interface SessionUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function calculateCost(usage: SessionUsage): number {
  const pricing = MODEL_PRICING[usage.model];
  if (!pricing) return 0;
  
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.cacheRead;
  const cacheWriteCost = (usage.cacheWriteTokens / 1_000_000) * pricing.cacheWrite;
  
  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

export function aggregateTaskCost(sessions: SessionUsage[]): TaskCost {
  // Aggregate by model, calculate total
  // Return { actualCost, tokensUsed, modelBreakdown }
}
```

### Step 2: Create API Endpoint

**File:** `/app/api/task-cost/route.ts`

Endpoint: `POST /api/task-cost`

**Request:**
```json
{
  "taskId": "abc-123",
  "sessions": [
    {
      "sessionKey": "agent:brunel:subagent:xyz",
      "model": "ollama/devstral",
      "inputTokens": 5000,
      "outputTokens": 3000,
      "cacheReadTokens": 0,
      "cacheWriteTokens": 0
    }
  ]
}
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
      "agent": "marcus",
      "input": 2000,
      "output": 1500,
      "cacheRead": 10000,
      "cacheWrite": 0,
      "cost": 0.045
    }
  ]
}
```

**Implementation:**
1. Receive task completion notification
2. Query Gateway `sessions.list` for sessions related to task (by time window or sessionKey pattern)
3. Aggregate usage data
4. Calculate cost using MODEL_PRICING
5. Update tasks.json with cost data
6. Return cost breakdown

### Step 3: Integrate into Task Completion Flow

When a task moves from `active` → `needs_review` or `done`:

1. Call Gateway API to get session usage for the time period
2. Filter sessions by agent + time window (task.createdAt to task.updatedAt)
3. POST to `/api/task-cost` with session data
4. Update task with cost data
5. Save tasks.json

### Step 4: Display in Mission Control

**Add to TaskCard component:**

```tsx
{task.actualCost !== undefined && (
  <div className="text-xs text-muted-foreground">
    💰 ${task.actualCost.toFixed(4)} • 
    {(task.tokensUsed.input + task.tokensUsed.output).toLocaleString()} tokens
  </div>
)}
```

**Add to Agent Metrics Dashboard:**

```tsx
<MetricCard
  title="Cost per Task (Avg)"
  value={`$${(totalCost / completedTasks).toFixed(4)}`}
  trend={costTrend}
/>

<MetricCard
  title="Total Tokens (24h)"
  value={(totalTokens / 1_000_000).toFixed(2) + "M"}
/>
```

---

## Testing Checklist

- [ ] Cost calculator handles all models correctly
- [ ] Free models (Ollama) show $0 cost but track tokens
- [ ] Session filtering captures all relevant activity
- [ ] Multiple agents on same task aggregate correctly
- [ ] Cost data persists to tasks.json
- [ ] UI displays cost accurately
- [ ] Metrics dashboard shows aggregated costs

---

## Acceptance Criteria

1. Every completed task has `actualCost`, `tokensUsed`, `modelBreakdown` populated
2. Free models show $0 cost but non-zero token counts
3. Cost data is visible in task cards and metrics dashboard
4. Total cost calculations match Gateway session usage API
5. No TypeScript errors, build passes
6. Works for both paid and free models

---

## Notes

- Use Gateway `/api/sessions/usage` endpoint as source of truth
- Cache results to avoid repeated API calls
- Consider adding cost budgets per task in future iteration
- Track time spent separately (not just tokens)
