# Finance Hub — Task 16: Anomaly Detection + Weekly Job

> 🦞 Marcus Rawlins | v1.0 | 2026-02-28
> Parent PRD: Section 9.3 (Anomaly Detection)
> Phase: 3 — Reporting & Tax
> Dependencies: Tasks 1-14 complete (needs transaction + categorization infrastructure)

---

## Objective

Build a weekly anomaly detection system that uses Sonnet to identify suspicious or unusual financial activity across all entities. Alerts appear on the global dashboard's AlertsPanel. A cron job runs Sunday nights. Tyler can dismiss alerts without fixing them.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

Read ALL of these before writing any code:

- `prisma/schema.prisma` — Full schema (you'll add an Alert model)
- `src/lib/db.ts` — Prisma client
- `src/lib/entities.ts` — EntityId type, REAL_ENTITIES array
- `src/lib/categorization/ai.ts` — Existing Anthropic API client (reuse)
- `src/lib/categorization/prompts.ts` — Prompt patterns
- `src/lib/reports/expense-trends.ts` — Historical spending patterns (reuse for baselines)
- `src/lib/recurring.ts` — Recurring rule logic (check for missed recurrences)
- `src/app/(dashboard)/components/AlertsPanel.tsx` — Existing alerts panel on global dashboard (integrate with this)
- `src/app/api/v1/global/alerts/route.ts` — Existing alerts API (extend or replace)

## Architecture

### New Files

```
src/
├── lib/
│   └── anomaly/
│       ├── detector.ts              # Main anomaly detection engine
│       ├── rules.ts                 # Rule-based anomaly checks (no AI)
│       ├── ai-analysis.ts           # Sonnet-powered analysis for complex patterns
│       ├── types.ts                 # Alert types and interfaces
│       └── __tests__/
│           ├── rules.test.ts        # Test rule-based detection
│           └── detector.test.ts     # Test full pipeline (mocked AI)
├── app/
│   └── api/
│       └── v1/
│           ├── anomalies/
│           │   ├── route.ts         # GET /api/v1/anomalies (list alerts)
│           │   └── [id]/
│           │       └── route.ts     # PATCH /api/v1/anomalies/:id (dismiss/acknowledge)
│           └── anomalies/
│               └── run/
│                   └── route.ts     # POST /api/v1/anomalies/run (trigger detection manually)
```

### New Prisma Model

Add to `prisma/schema.prisma`:

```prisma
model Alert {
  id          String      @id @default(uuid()) @db.Uuid
  entityId    String      @map("entity_id") @db.VarChar(50)
  type        AlertType
  severity    AlertSeverity
  title       String      @db.VarChar(500)
  description String      @db.Text
  amountCents BigInt?     @map("amount_cents")
  metadata    Json?                           // Extra context (transaction IDs, category, etc.)
  status      AlertStatus @default(ACTIVE)
  dismissedBy String?     @map("dismissed_by") @db.Uuid
  dismissedAt DateTime?   @map("dismissed_at") @db.Timestamptz
  detectedAt  DateTime    @default(now()) @map("detected_at") @db.Timestamptz
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz

  @@index([entityId, status])
  @@index([detectedAt])
  @@map("alerts")
}

enum AlertType {
  UNUSUAL_AMOUNT        // Charge significantly above category average
  MISSING_RECURRING     // Expected recurring transaction didn't appear
  DUPLICATE_CHARGE      // Same vendor, same amount, same day
  UNUSUAL_VENDOR        // New vendor with large charge
  BUDGET_EXCEEDED       // Category spending exceeds budget
  LARGE_TRANSFER        // Unusually large transfer between accounts
  AI_FLAGGED            // Sonnet identified a pattern worth reviewing
}

enum AlertSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum AlertStatus {
  ACTIVE
  DISMISSED
  RESOLVED
}
```

Run `npx prisma db push` or create a migration after adding the model.

## Detailed Requirements

### 1. Rule-Based Detection (`rules.ts`)

These run first (fast, no API cost):

**a) Unusual Amount**
- For each transaction in the detection window (last 7 days):
- Calculate the category's average transaction amount over last 90 days
- If the transaction amount > 3x the category average AND amount > $50 (5000 cents): flag it
- Severity: MEDIUM if 3-5x, HIGH if >5x

**b) Missing Recurring**
- Query all active recurring rules
- For each rule, check if the expected transaction exists within ±2 days of `nextDue`
- If missing and `nextDue` is in the past: flag it
- Severity: LOW for non-essential, MEDIUM for bills, HIGH for tax payments

**c) Duplicate Charge**
- For transactions in the detection window:
- Group by: normalized merchant name + amount + date
- If count > 1 for the same group: flag as potential duplicate
- Exclude known recurring (subscription charges are expected duplicates)
- Severity: MEDIUM

**d) Budget Exceeded**
- For each active budget:
- Check if any category has exceeded 100% of its budgeted amount
- Only flag if not already flagged this period
- Severity: MEDIUM at 100%, HIGH at 120%

### 2. AI Analysis (`ai-analysis.ts`)

After rule-based checks, send a summary to Sonnet for pattern analysis:

**Prompt inputs:**
- Transaction summary for the last 7 days (aggregated by category, not individual transactions)
- Category spending trends (3-month rolling averages)
- Any rule-based alerts already generated (so Sonnet doesn't duplicate)
- Entity context (business type, typical patterns)

**Sonnet should identify:**
- Spending velocity changes (sudden increase in a category)
- Unusual vendor patterns (new vendors, vendors appearing in wrong entity)
- Timing anomalies (charges at unusual times or frequencies)
- Cross-entity patterns (same vendor appearing in multiple entities when it shouldn't)

**Sonnet returns structured JSON:**
```json
{
  "findings": [
    {
      "type": "AI_FLAGGED",
      "severity": "MEDIUM",
      "title": "Marketing spend increased 45% week-over-week",
      "description": "AnselAI marketing expenses went from $420 to $610 this week...",
      "relatedTransactionIds": ["uuid1", "uuid2"],
      "confidence": 0.78
    }
  ]
}
```

Only create alerts for findings with confidence >= 0.7.

### 3. Detection Engine (`detector.ts`)

Orchestrates the full pipeline:

```typescript
interface DetectionResult {
  entityId: string
  alertsCreated: number
  ruleBasedAlerts: number
  aiAlerts: number
  executionTimeMs: number
}

async function runAnomalyDetection(options?: {
  entityId?: string      // Optional: run for specific entity only
  windowDays?: number    // Default: 7
  dryRun?: boolean       // If true, return alerts without saving
}): Promise<DetectionResult[]>
```

Pipeline:
1. Deduplicate: don't create alerts for issues already flagged (check existing ACTIVE alerts)
2. Run rule-based checks for each entity
3. Aggregate results, send to Sonnet for AI analysis
4. Save new alerts to database
5. Return summary

### 4. API Endpoints

**GET /api/v1/anomalies**

Query params:
- `entityId` — filter by entity (optional, defaults to all)
- `status` — ACTIVE | DISMISSED | RESOLVED (default: ACTIVE)
- `severity` — LOW | MEDIUM | HIGH | CRITICAL (optional)
- `limit` — max 50, default 20
- `offset` — pagination

Response:
```typescript
interface AnomaliesResponse {
  alerts: Alert[]
  total: number
  hasMore: boolean
  confidential: true
}
```

**PATCH /api/v1/anomalies/:id**

Body:
```typescript
interface AlertUpdate {
  status: 'DISMISSED' | 'RESOLVED'
}
```

**POST /api/v1/anomalies/run**

Manually trigger anomaly detection. Body:
```typescript
interface RunRequest {
  entityId?: string    // Optional: specific entity
  dryRun?: boolean     // Default: false
}
```

Response: `DetectionResult[]`

### 5. AlertsPanel Integration

Update the existing `AlertsPanel.tsx` on the global dashboard:
- Fetch from `GET /api/v1/anomalies?status=ACTIVE&limit=10`
- Display alerts with severity color coding (LOW=blue, MEDIUM=yellow, HIGH=orange, CRITICAL=red)
- Each alert shows: icon by type, title, entity badge, severity badge, detected timestamp
- Dismiss button on each alert (calls PATCH endpoint)
- "View All" link to a dedicated alerts page (if time permits, otherwise just expand the panel)
- Badge count in sidebar navigation showing number of active alerts

### 6. Cron Job Setup

The weekly cron is NOT built into the app. It will be set up externally via OpenClaw cron after Task 16 is complete. The app only provides the `POST /api/v1/anomalies/run` endpoint.

Document in a comment at the top of `detector.ts`:
```typescript
// Weekly anomaly detection. Triggered externally via:
// POST http://192.168.68.105:3300/api/v1/anomalies/run
// Intended schedule: Sunday 11pm ET
```

## Testing Requirements

1. **Unusual amount detection**: Create transactions at 4x category average, verify alert generated with correct severity
2. **Missing recurring**: Create a recurring rule with past-due nextDue, verify MISSING_RECURRING alert
3. **Duplicate detection**: Create two identical transactions (same vendor, amount, date), verify DUPLICATE_CHARGE alert
4. **Budget exceeded**: Create budget with spending at 110%, verify BUDGET_EXCEEDED alert
5. **Deduplication**: Run detection twice, verify no duplicate alerts created
6. **Dismiss flow**: Create alert, dismiss via PATCH, verify status changes
7. **Entity scoping**: Verify alerts are correctly scoped to entities
8. **Dry run**: Verify dryRun returns alerts without saving to DB
9. **AI analysis mock**: Mock Sonnet response, verify AI_FLAGGED alerts created only for confidence >= 0.7
10. **Low confidence filtering**: Mock Sonnet returning findings with confidence 0.5, verify they're NOT created as alerts

## Constraints

- Money is BIGINT cents. Always.
- Anthropic API only for AI analysis. No local LLM.
- Sonnet (not Opus) for anomaly detection.
- Rule-based checks run first (free), AI analysis second (costs money).
- Never expose dollar amounts in alert titles visible in group contexts.
- `bun test` and `bun run build` must pass.
- Git commit: `🦫 Brunel: Task 16 — Anomaly Detection + Weekly Job`

## Review

Walt must score 95%+. Marcus (Opus) must score 99%+.
