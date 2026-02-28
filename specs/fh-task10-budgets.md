# Finance Hub — Task 10: Recurring Rules + Budget Tracking + Period Toggle

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 5.5, 6.5)
> Phase 2 Overview: `/workspace/specs/fh-phase2-overview.md`
> Tyler Decision: All data views toggle between monthly, quarterly, annual
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Three things in one task: (1) recurring transaction rules with auto-generation, (2) budget tracking with alerts, (3) a global period toggle component used across ALL views. The period toggle is a shared component that Tasks 3 and 11 will also consume.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

- `prisma/schema.prisma` — RecurringRule, Budget, BudgetLine models (Phase 1)
- `src/app/(dashboard)/[entity]/page.tsx` — entity dashboard
- `src/app/(dashboard)/[entity]/reports/` — P&L, balance sheet, cash flow, tax pages
- `src/lib/reports/` — report generation logic

## Architecture

```
src/components/
├── PeriodToggle.tsx           # NEW — shared period selector component
└── ui/
    └── ...

src/app/(dashboard)/[entity]/recurring/
├── page.tsx                   # Recurring rules list
├── new/page.tsx               # Create rule form
└── components/
    ├── RecurringRuleForm.tsx
    ├── RecurringRuleList.tsx
    └── UpcomingPreview.tsx     # Shows next N generated transactions

src/app/(dashboard)/[entity]/budget/
├── page.tsx                   # Budget overview
├── new/page.tsx               # Create budget
├── [id]/page.tsx              # Budget detail (actual vs planned)
└── components/
    ├── BudgetForm.tsx
    ├── BudgetOverview.tsx
    ├── BudgetVsActual.tsx     # Bar chart per category
    └── BudgetAlerts.tsx

src/lib/
├── recurring.ts               # Recurring rule engine (daily job)
├── budget.ts                  # Budget calculation logic
└── periods.ts                 # NEW — period utilities (date ranges, aggregation)

src/app/api/v1/
├── recurring/
│   ├── route.ts               # GET, POST
│   ├── [id]/route.ts          # GET, PATCH, DELETE
│   └── generate/route.ts      # POST — manually trigger generation
└── budgets/
    ├── route.ts               # GET, POST
    ├── [id]/route.ts          # GET, PATCH, DELETE
    └── [id]/variance/route.ts # GET — actual vs planned
```

## Part 1: Period Toggle Component

### `PeriodToggle.tsx`

A shared, reusable component placed in the dashboard header. Controls the time period for ALL data views on the current page.

```typescript
interface PeriodToggleProps {
  value: Period;
  onChange: (period: Period) => void;
}

type Period = {
  type: 'monthly' | 'quarterly' | 'annual';
  year: number;
  month?: number;    // 1-12 for monthly
  quarter?: number;  // 1-4 for quarterly
};
```

**UI:** Three-button segmented control (Monthly | Quarterly | Annual) + left/right arrows to navigate periods + current period label.

```
  ◀  [Monthly] [Quarterly] [Annual]  ▶
              January 2026
```

- Monthly: shows "January 2026", arrows step by month
- Quarterly: shows "Q1 2026", arrows step by quarter
- Annual: shows "2026", arrows step by year

**State management:** Store in URL search params (`?period=monthly&year=2026&month=1`) so it persists on refresh and can be shared.

### `periods.ts` — Period Utilities

```typescript
export function getPeriodDateRange(period: Period): { start: Date; end: Date };
export function getPeriodLabel(period: Period): string;
export function getNextPeriod(period: Period): Period;
export function getPrevPeriod(period: Period): Period;
export function aggregateByPeriod<T>(items: T[], dateKey: keyof T, period: Period): Map<string, T[]>;
```

### Integration Points

After building PeriodToggle, integrate it into these EXISTING pages:
- `[entity]/page.tsx` (dashboard) — P&L chart, recent transactions scoped to period
- `[entity]/reports/profit-loss/page.tsx` — filter by period
- `[entity]/reports/balance-sheet/page.tsx` — as of period end date
- `[entity]/reports/cash-flow/page.tsx` — filter by period
- `[entity]/reports/tax/page.tsx` — filter by period
- `[entity]/transactions/page.tsx` — default date filter matches period

**Do not break existing functionality.** Default to current month if no period param in URL.

## Part 2: Recurring Transaction Rules

### RecurringRule Model (verify in Prisma schema)

Expected fields: `id`, `entityId`, `accountId`, `categoryId`, `description`, `amountCents`, `frequency` (WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY), `nextDue`, `lastGenerated`, `autoCreate` (boolean), `isActive`, `createdAt`, `updatedAt`

### Rule Form (`RecurringRuleForm.tsx`)

Fields:
- Description (text, e.g., "Netflix Subscription")
- Amount (currency input)
- Account (dropdown: which credit card / bank account)
- Category (dropdown)
- Frequency (select: Weekly, Biweekly, Monthly, Quarterly, Yearly)
- Start date / next due date
- Auto-create toggle: ON = auto-generate transaction, OFF = just remind
- Active toggle

### Rule Engine (`src/lib/recurring.ts`)

Daily job logic:

```typescript
export async function processRecurringRules(entityId?: string): Promise<{
  generated: number;
  reminders: number;
  errors: number;
}> {
  // 1. Query all active rules where nextDue <= today
  // 2. For autoCreate = true:
  //    - Create Transaction (status: CLEARED)
  //    - Create TransactionLines (proper double-entry)
  //    - Update lastGenerated and advance nextDue
  // 3. For autoCreate = false:
  //    - Create a reminder entry (or just flag in UI)
  //    - Advance nextDue
  // 4. Log to AuditLog
}

export function advanceNextDue(current: Date, frequency: RecurringFrequency): Date {
  // Add appropriate interval based on frequency
}
```

### API Endpoints

#### `GET /api/v1/recurring?entityId=X`
Returns all recurring rules for entity, sorted by next due date.

#### `POST /api/v1/recurring`
Create new rule. Body: full rule object.

#### `PATCH /api/v1/recurring/[id]`
Update rule. Can pause (isActive=false) or modify any field.

#### `DELETE /api/v1/recurring/[id]`
Soft delete or hard delete (rules aren't financial records, hard delete is fine).

#### `POST /api/v1/recurring/generate`
Manually trigger rule processing. Body: `{ entityId?: string }` (null = all entities).
Returns generation results.

### Upcoming Preview (`UpcomingPreview.tsx`)

Show next 7 days of upcoming recurring transactions:
```
┌─────────────────────────────────────────┐
│  Upcoming (Next 7 Days)                 │
│  Feb 28  Netflix         -$15.99   auto │
│  Mar 01  Adobe Creative  -$54.99   auto │
│  Mar 02  Rent            -$1,800  review│
└─────────────────────────────────────────┘
```

"auto" = will be auto-created. "review" = reminder only.

## Part 3: Budget Tracking

### Budget Model (verify in Prisma schema)

Expected: `id`, `entityId`, `name`, `periodType` (MONTHLY, QUARTERLY, ANNUAL), `year`, `month` (nullable), `quarter` (nullable), `totalPlannedCents`, `rollover` (boolean), `isActive`, `createdAt`, `updatedAt`

BudgetLine: `id`, `budgetId`, `categoryId`, `plannedCents`, `notes`

### Budget Form (`BudgetForm.tsx`)

Fields:
- Name (e.g., "March 2026 Budget" or "Q1 2026")
- Period type (Monthly / Quarterly / Annual) — syncs with PeriodToggle
- Year + month/quarter selector
- Category-level budget lines:
  - For each expense category, input planned amount
  - Pre-populate from previous period's actuals (if exists)
  - "Copy from last period" button
- Rollover toggle (unused budget carries forward)
- Total planned (auto-summed from lines)

### Budget vs Actual (`BudgetVsActual.tsx`)

Horizontal bar chart per category:
```
Software     ████████████░░░░  $420 / $500 (84%) ⚠️
Marketing    ██████░░░░░░░░░░  $200 / $500 (40%)
Travel       ████████████████  $600 / $500 (120%) 🔴
Meals        ███░░░░░░░░░░░░░  $75 / $300 (25%)
```

- Gray bar = planned
- Colored bar = actual (green < 80%, amber 80-100%, red > 100%)
- Alert icons at 80% and 100% thresholds

**Actual calculation:** Sum all CLEARED transactions for the category within the budget period.

### Budget Alerts (`BudgetAlerts.tsx`)

Cards shown on the entity dashboard:
```
⚠️ Software & Subscriptions: 84% spent ($420 of $500)
🔴 Travel: Over budget by $100 ($600 of $500)
```

Only show alerts for categories at >80% of budget.

### API Endpoints

#### `GET /api/v1/budgets?entityId=X&year=2026&periodType=MONTHLY`
Returns budgets with their lines.

#### `POST /api/v1/budgets`
Create budget with lines.

#### `PATCH /api/v1/budgets/[id]`
Update budget or lines.

#### `DELETE /api/v1/budgets/[id]`
Delete budget (hard delete is fine, budgets are planning tools not financial records).

#### `GET /api/v1/budgets/[id]/variance`
Returns actual vs planned for each budget line:
```json
{
  "lines": [
    {
      "categoryId": "...",
      "categoryName": "Software",
      "plannedCents": 50000,
      "actualCents": 42000,
      "varianceCents": -8000,
      "percentUsed": 84,
      "alert": "warning"
    }
  ],
  "totalPlanned": 300000,
  "totalActual": 245000
}
```

### Sidebar Navigation

Add to entity sidebar:
```
📊 Dashboard
💳 Transactions
📥 Import
✅ Review
📄 Invoices
🔄 Recurring      ← This task
💰 Budget          ← This task
📈 Reports
🏷️ Categorize
```

## Testing Requirements

1. **Period toggle:** Verify date range calculation for all three period types
2. **Period in URL:** Set period, refresh page, verify it persists
3. **Recurring rules:** Create rule, trigger generation, verify transaction created with proper double-entry
4. **Frequency advancement:** Monthly rule due Jan 31 → next due Feb 28 (not Mar 3)
5. **Auto vs remind:** Auto-create generates transaction, remind does not
6. **Budget variance:** Create budget $500 for Software, add $420 in transactions, verify 84% calculation
7. **Budget alerts:** Verify alerts fire at 80% and 100%
8. **Rollover:** $100 unused in January, March budget should show $600 planned (if rollover enabled)
9. **Integration:** Existing report pages still work with period toggle added

## Constraints

- **Money is BIGINT cents.**
- **Period toggle is THE shared component.** Every view that shows financial data uses it. Don't build page-specific period selectors.
- **Don't break Phase 1 pages.** The period toggle is additive. Existing pages default to current month if no period param.
- **Recurring rule transactions must have proper TransactionLines.** Double-entry is non-negotiable.
