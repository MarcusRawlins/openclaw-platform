# Finance Hub — Task 11: Global Dashboard + Monthly Import Cron

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 6.1, 5)
> Phase 2 Overview: `/workspace/specs/fh-phase2-overview.md`
> Depends on: Tasks 6-10 (uses period toggle, import system, budgets)
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

The capstone of Phase 2: a cross-entity global dashboard showing combined financial picture, plus the monthly import scan endpoint that the cron jobs call. Tyler sees everything in one view.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

- `src/app/(dashboard)/page.tsx` — currently redirects to first entity or shows entity selector
- `src/app/api/v1/entities/[entityId]/summary/route.ts` — per-entity summary endpoint
- `src/components/PeriodToggle.tsx` — shared period component (Task 10)
- `src/lib/periods.ts` — period utilities (Task 10)
- `src/lib/import/` — all parsers and dedup (Task 6)
- `src/app/api/v1/import/` — upload and parse endpoints (Task 6)

## Architecture

```
src/app/(dashboard)/
├── page.tsx                       # REPLACE — global dashboard
├── components/
│   ├── GlobalSummary.tsx          # Combined net worth, revenue, expenses
│   ├── EntityComparison.tsx       # Side-by-side entity cards
│   ├── RecentActivity.tsx         # Cross-entity transaction feed
│   ├── CashFlowTrend.tsx          # 12-month line chart
│   ├── AlertsPanel.tsx            # Overdue invoices, budget warnings, import status
│   └── ImportStatus.tsx           # New files ready, last import results

src/app/api/v1/
├── global/
│   ├── summary/route.ts          # Combined summary across entities
│   └── activity/route.ts         # Recent transactions across entities
└── import/
    └── scan/route.ts             # NEW — scan FINANCIALS dir and auto-import
```

## Detailed Requirements

### 1. Global Dashboard (`page.tsx`)

**Access:** OWNER role required (per PRD). The global dashboard replaces the current entity-picker landing page.

**Layout (top to bottom):**

```
┌─────────────────────────────────────────────────────┐
│  ◀  [Monthly] [Quarterly] [Annual]  ▶               │
│              January 2026                            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Net Worth │  │ Revenue  │  │ Expenses │           │
│  │ $47,230   │  │ $12,500  │  │ $8,340   │           │
│  │ ▲ 12.3%   │  │ ▲ 8.5%   │  │ ▼ 3.2%   │           │
│  └──────────┘  └──────────┘  └──────────┘           │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │  Cash Flow Trend (12 months)                │     │
│  │  [═══line chart═══════════════════════]      │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌─── AnselAI ───┐ ┌── R3 Studios ──┐ ┌─ Family ─┐  │
│  │ Rev: $8,500   │ │ Rev: $4,000    │ │ Inc: $0   │  │
│  │ Exp: $3,200   │ │ Exp: $2,140    │ │ Exp: $3k  │  │
│  │ Net: $5,300   │ │ Net: $1,860    │ │ Net: -$3k │  │
│  └───────────────┘ └────────────────┘ └──────────┘  │
│                                                      │
│  ┌── Alerts ─────────────────────────────────────┐   │
│  │ 🔴 2 overdue invoices ($3,200 outstanding)    │   │
│  │ ⚠️ Software budget at 84%                     │   │
│  │ 📥 3 new files ready for import               │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  ┌── Recent Activity ────────────────────────────┐   │
│  │ Today   ANS  Netflix           -$15.99  Auto  │   │
│  │ Today   R3   Render            -$25.00  Soft  │   │
│  │ Feb 26  ANS  Wedding Deposit   +$2,500  Rev   │   │
│  │ Feb 26  FAM  Grocery Outlet    -$142.30 Food  │   │
│  │ ...                                            │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 2. Global Summary (`GlobalSummary.tsx`)

Three big number cards:

**Net Worth:** Sum of all asset accounts minus all liability accounts across all entities.
**Revenue:** Sum of all revenue category transactions for the current period.
**Expenses:** Sum of all expense category transactions for the current period.

Each card shows period-over-period change as percentage (compare to previous period of same type).

### 3. Entity Comparison (`EntityComparison.tsx`)

Side-by-side cards for each entity. Each shows:
- Revenue (period)
- Expenses (period)
- Net income (revenue - expenses)
- Clickable — navigates to entity dashboard

Highlight the best-performing entity with a subtle accent border.

### 4. Cash Flow Trend (`CashFlowTrend.tsx`)

Recharts line chart showing 12 months of cash flow:
- X axis: months
- Y axis: dollars
- Lines: one per entity (color coded) + combined total (white/bold)
- Tooltip: hover shows exact values
- Respects period toggle for the anchor point (if quarterly view, show 8 quarters instead)

### 5. Recent Activity (`RecentActivity.tsx`)

Last 20 transactions across ALL entities:
- Entity badge (colored abbreviation: ANS, R3, FAM)
- Date, description, amount, category abbreviation
- Clickable — navigates to transaction in entity context
- Auto-refreshes every 60 seconds (or on window focus)

### 6. Alerts Panel (`AlertsPanel.tsx`)

Aggregates alerts from across all entities:
- Overdue invoices (count + total amount)
- Budget categories over 80%
- Pending review transactions (count)
- New files detected in FINANCIALS folder
- Failed recurring rule generations

Each alert links to the relevant page.

### 7. Import Status (`ImportStatus.tsx`)

Shows:
- Last import date and results
- Number of files in `/Volumes/reeseai-memory/FINANCIALS/` not yet imported
- "Import Now" button (triggers scan endpoint)

### 8. Monthly Import Scan Endpoint

#### `POST /api/v1/import/scan`

This is what the monthly cron job (11th of month) calls.

Logic:
1. Scan `/Volumes/reeseai-memory/FINANCIALS/` for files
2. Track already-imported files (by filename + SHA-256 hash) in ImportSession table
3. For each new file:
   a. Auto-detect format (Task 6's detect.ts)
   b. Parse using appropriate parser
   c. Run dedup against existing transactions
   d. Save as PENDING transactions
   e. Create ImportSession record
4. Trigger AI categorization on new PENDING transactions (Task 8's batch endpoint)
5. Return summary

```typescript
interface ScanResult {
  filesFound: number;
  filesNew: number;
  filesSkipped: number;     // already imported
  filesErrored: number;
  transactionsImported: number;
  duplicatesFlagged: number;
  categorized: number;
  errors: { file: string; error: string }[];
}
```

**File tracking:** Add a `fileHash` column to ImportSession (or create a new FileImportLog table) to track which files have been processed. Use SHA-256 of file contents.

#### `GET /api/v1/import/scan/status`

Returns current state of FINANCIALS directory:
```json
{
  "directory": "/Volumes/reeseai-memory/FINANCIALS/",
  "totalFiles": 23,
  "importedFiles": 20,
  "newFiles": 3,
  "newFileNames": ["amex-gold-feb-2026.csv", "chase-feb-2026.csv", "bank-6837-feb.pdf"],
  "lastScanAt": "2026-02-11T08:00:00Z"
}
```

### 9. API Endpoints

#### `GET /api/v1/global/summary?period=monthly&year=2026&month=1`
Returns combined financial summary across all entities.

```json
{
  "netWorth": { "currentCents": 4723000, "previousCents": 4210000, "changePercent": 12.3 },
  "revenue": { "currentCents": 1250000, "previousCents": 1152000, "changePercent": 8.5 },
  "expenses": { "currentCents": 834000, "previousCents": 861600, "changePercent": -3.2 },
  "entities": [
    { "id": "...", "name": "AnselAI", "revenueCents": 850000, "expenseCents": 320000, "netCents": 530000 },
    { "id": "...", "name": "R3 Studios", "revenueCents": 400000, "expenseCents": 214000, "netCents": 186000 },
    { "id": "...", "name": "Reese Family", "revenueCents": 0, "expenseCents": 300000, "netCents": -300000 }
  ]
}
```

#### `GET /api/v1/global/activity?limit=20`
Returns recent transactions across all entities with entity metadata.

#### `GET /api/v1/global/cashflow?months=12`
Returns monthly cash flow data for the chart.

#### `GET /api/v1/global/alerts`
Returns aggregated alerts from all entities.

### 10. Sidebar Navigation (Global Level)

The top-level sidebar (when not in an entity context):
```
🏠 Overview        ← This task (global dashboard)
─────────────
📊 AnselAI          → entity dashboard
📊 R3 Studios       → entity dashboard
📊 Reese Family     → entity dashboard
─────────────
⚙️ Settings
```

## Testing Requirements

1. **Global summary:** With data in all 3 entities, verify combined totals are correct
2. **Period toggle integration:** Switch to quarterly, verify all cards update
3. **Entity comparison:** Verify each entity's numbers match their individual dashboards
4. **Cash flow chart:** 12 months of data renders correctly
5. **Import scan:** Place test files in a temp directory, run scan, verify detection and import
6. **File tracking:** Run scan twice on same files, verify no re-import
7. **Alerts aggregation:** Create overdue invoice + over-budget category, verify both appear
8. **Empty state:** No data yet, dashboard shows helpful empty states (not errors)

## Constraints

- **Money is BIGINT cents.**
- **OWNER role only** for global dashboard access.
- **Period toggle from Task 10.** Do not build a separate one.
- **File scan path is configurable** via env var `FINANCIALS_DIR` (default: `/Volumes/reeseai-memory/FINANCIALS/`).
- **PDF files:** For Phase 2, just log them as "needs OCR processing" (PDF import via Mistral is Phase 2 Import in PRD Section 19). Don't try to parse PDFs in this task. Only CSV and OFX/QFX.
