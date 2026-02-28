# Finance Hub — Task 12: PDF/CSV Export + Report Polish

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Section 7)
> Phase 3 Overview: `/workspace/specs/fh-phase3-overview.md`
> Depends on: Phase 1 report foundations
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Transform Phase 1's basic report pages into production-grade, CPA-ready documents with PDF/CSV export, YTD comparisons, trend analysis, and combined entity views. Tyler's CPA receives an export and asks zero follow-up questions.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

Read before writing ANY code:
- `src/app/(dashboard)/[entity]/reports/` — Phase 1 report pages (P&L, balance sheet, cash flow, tax estimate)
- `src/lib/reports/` — Report calculation logic (profit-loss.ts, balance-sheet.ts, cash-flow.ts, tax-estimate.ts)
- `src/components/reports/` — Report UI components (report-header.tsx, report-table.tsx, report-row.tsx, export-button.tsx)
- `src/app/api/v1/entities/[entityId]/` — Existing report API endpoints (pnl, balance-sheet, cash-flow, tax-estimate)

**Phase 1 built the foundation. This task adds export, polish, and advanced reporting.**

## Architecture

```
src/lib/reports/
├── profit-loss.ts           # EXISTS — extend with YTD comparison
├── balance-sheet.ts         # EXISTS — extend with combined entity view
├── cash-flow.ts             # EXISTS — no changes needed
├── tax-estimate.ts          # EXISTS — no changes needed
├── export/
│   ├── pdf.ts              # NEW — PDF generation for all reports
│   ├── csv.ts              # NEW — CSV export for all reports
│   └── templates/
│       ├── pnl-template.tsx         # React-PDF template
│       ├── balance-sheet-template.tsx
│       ├── cash-flow-template.tsx
│       └── tax-summary-template.tsx
├── revenue-by-client.ts     # NEW — client/project revenue breakdown
├── expense-trends.ts        # NEW — 12-month rolling expense analysis
├── budget-variance.ts       # NEW — uses Task 10 budget data
└── combined.ts              # NEW — cross-entity consolidated reports

src/app/(dashboard)/[entity]/reports/
├── page.tsx                 # EXISTS — add new report links
├── profit-loss/page.tsx     # EXTEND — add YTD toggle, export buttons
├── balance-sheet/page.tsx   # EXTEND — add export buttons
├── cash-flow/page.tsx       # EXTEND — add export buttons
├── tax/page.tsx             # EXTEND — add export buttons
├── revenue-by-client/
│   └── page.tsx             # NEW — revenue breakdown report
├── expense-trends/
│   └── page.tsx             # NEW — expense trend visualization
└── budget-variance/
    └── page.tsx             # NEW — budget vs actual report

src/app/(dashboard)/combined/
└── page.tsx                 # NEW — cross-entity consolidated view (requires OWNER role)

src/app/api/v1/reports/
├── export/
│   └── route.ts             # NEW — handles PDF/CSV export requests
├── revenue-by-client/
│   └── route.ts             # NEW
├── expense-trends/
│   └── route.ts             # NEW
└── budget-variance/
    └── route.ts             # NEW

src/components/reports/
├── export-button.tsx        # EXISTS — enhance with PDF/CSV options
├── ytd-comparison.tsx       # NEW — side-by-side current vs prior year
├── revenue-client-table.tsx # NEW
├── expense-trend-chart.tsx  # NEW — 12-month line chart with Recharts
└── budget-variance-table.tsx # NEW
```

## Detailed Requirements

### 1. PDF Export Infrastructure (`export/pdf.ts`)

Use **@react-pdf/renderer** for server-side PDF generation.

```typescript
interface PDFExportRequest {
  reportType: 'pnl' | 'balance-sheet' | 'cash-flow' | 'tax-summary' | 'revenue-by-client' | 'expense-trends' | 'budget-variance';
  entityId: string;
  periodStart: Date;
  periodEnd: Date;
  data: any; // Report-specific data structure
  options?: {
    includeDetails?: boolean;
    includeCharts?: boolean;
  };
}

interface PDFMetadata {
  title: string;
  author: string; // "Finance Hub"
  subject: string;
  keywords: string[];
  createdDate: Date;
}

export async function generateReportPDF(
  req: PDFExportRequest,
  metadata: PDFMetadata
): Promise<Buffer>;
```

**PDF Requirements:**
- **Confidentiality marking:** "CONFIDENTIAL" watermark on every page
- **Header:** Entity name, report type, period, generated date
- **Footer:** Page X of Y, generation timestamp, "Finance Hub"
- **Styling:** Professional dark theme optimized for printing (white background for PDF, dark text)
- **Logo placeholder:** Empty div for future entity logo insertion
- **Fonts:** Use default system fonts (Helvetica, Times) for universal compatibility

### 2. CSV Export Infrastructure (`export/csv.ts`)

```typescript
interface CSVExportRequest {
  reportType: string;
  entityId: string;
  periodStart: Date;
  periodEnd: Date;
  data: any;
}

export async function generateReportCSV(req: CSVExportRequest): Promise<string>;
```

**CSV Format:**
```csv
Entity,AnselAI
Report,Profit & Loss
Period,2026-01-01 to 2026-03-31
Generated,2026-02-28 14:32:15 EST

Category,Amount
Revenue,
  Photography Income,850000
  Portrait Sessions,125000
Total Revenue,975000

Expenses,
  Marketing,125000
  Equipment,75000
Total Expenses,200000

Net Income,775000
```

**Requirements:**
- First 4 rows: metadata (entity, report, period, generation timestamp)
- Blank row separator
- Hierarchical categories indented with spaces
- Amounts in cents (include units row: "All amounts in cents")
- UTF-8 encoding with BOM for Excel compatibility

### 3. YTD Comparison for P&L (`ytd-comparison.tsx`)

**UI Component:**
Side-by-side table showing current year vs prior year for same period.

| Category | 2026 YTD | 2025 YTD | Change | Change % |
|----------|----------|----------|--------|----------|
| Revenue | $97,500 | $82,300 | +$15,200 | +18.5% |
| Marketing | $12,500 | $15,600 | -$3,100 | -19.9% |
| Net Income | $77,500 | $58,200 | +$19,300 | +33.2% |

**Toggle:** "Current Period" vs "YTD Comparison" at top of P&L page

**Calculation Logic:**
```typescript
interface YTDComparisonData {
  currentYear: number;
  priorYear: number;
  periodStart: Date; // Jan 1 of current year
  periodEnd: Date;   // Same day prior year
  categories: {
    id: string;
    name: string;
    currentAmount: bigint;
    priorAmount: bigint;
    change: bigint;
    changePercent: number;
  }[];
}
```

Extend `src/lib/reports/profit-loss.ts` with `generateYTDComparison()` function.

### 4. Revenue by Client/Project Report (`revenue-by-client.ts`)

**Purpose:** Show revenue breakdown by client or project tag for a period.

**Data Structure:**
```typescript
interface RevenueByClient {
  entityId: string;
  period: { start: Date; end: Date };
  clients: {
    name: string; // From transaction tags or invoice counterparty
    revenue: bigint;
    transactionCount: number;
    invoiceCount: number;
    lastPaymentDate: Date;
  }[];
  totalRevenue: bigint;
}
```

**Query Logic:**
1. Find all REVENUE account transactions for period
2. Extract client name from:
   - Invoice `counterparty` if linked
   - Transaction tag matching pattern `client:*` or `wedding:*`
   - If neither, label as "Uncategorized"
3. Group by client, sum amounts
4. Sort by revenue descending

**UI:** Table with search/filter, export to CSV

### 5. Expense Trends Report (`expense-trends.ts`)

**Purpose:** 12-month rolling view of expenses by category, with trend visualization.

**Data Structure:**
```typescript
interface ExpenseTrends {
  entityId: string;
  months: string[]; // ['2025-03', '2025-04', ..., '2026-02']
  categories: {
    id: string;
    name: string;
    monthlyAmounts: bigint[]; // Aligned with months array
    average: bigint;
    trend: 'up' | 'down' | 'stable'; // Based on linear regression
  }[];
  totalByMonth: bigint[];
}
```

**Visualization:**
- Line chart (Recharts) with one line per top-5 expense categories
- X-axis: months
- Y-axis: amount in dollars (formatted)
- Legend: category names with trend indicators (↑ ↓ →)

**Trend Calculation:**
Simple 3-month moving average comparison. If last 3 months avg > prior 3 months avg by >10%, trend = 'up'.

### 6. Budget Variance Report (`budget-variance.ts`)

**Purpose:** Compare budgeted amounts to actual spending per category.

**Dependencies:** Requires Phase 2 Task 10 (Budget Management) to be complete.

**Data Structure:**
```typescript
interface BudgetVariance {
  budgetId: string;
  budgetName: string;
  periodStart: Date;
  periodEnd: Date;
  lines: {
    categoryId: string;
    categoryName: string;
    budgeted: bigint;
    actual: bigint;
    variance: bigint;
    variancePercent: number;
    status: 'under' | 'over' | 'on-track'; // ±10% is on-track
  }[];
  totalBudgeted: bigint;
  totalActual: bigint;
  totalVariance: bigint;
}
```

**Calculation:**
1. Fetch budget lines for the budget period
2. Query actual transaction amounts for same period per category
3. Calculate variance: `actual - budgeted`
4. Flag categories >100% or >80% of budget

**UI:** Table with color-coded variance (green = under budget, yellow = 80-100%, red = over)

### 7. Combined Entity View (`src/app/(dashboard)/combined/page.tsx`)

**Purpose:** Consolidated view across all three entities (AnselAI, R3 Studios, Reese Family).

**Access Control:** Requires `UserRole.OWNER`. Display 403 for non-owners.

**Reports Available:**
- Combined P&L (all entities summed)
- Combined Balance Sheet (all entities summed)
- Per-entity comparison table (side-by-side)

**UI Layout:**
```
┌─────────────────────────────────────────┐
│ Combined Financial View                 │
│ [All Entities]                          │
├─────────────────────────────────────────┤
│ Net Worth: $X (sum of all equity)      │
│ Monthly P&L Comparison:                 │
│  AnselAI     │ R3 Studios │ Family     │
│  +$7,750     │ +$2,300    │ -$3,200    │
├─────────────────────────────────────────┤
│ [Combined P&L] [Combined Balance Sheet] │
└─────────────────────────────────────────┘
```

**Implementation:**
Query all three entity schemas in parallel, aggregate results.

### 8. Export API Endpoint

#### `POST /api/v1/reports/export`

**Body:**
```json
{
  "reportType": "pnl",
  "entityId": "anselai",
  "periodStart": "2026-01-01",
  "periodEnd": "2026-03-31",
  "format": "pdf" | "csv",
  "options": {
    "includeDetails": true,
    "includeYTDComparison": true
  }
}
```

**Response:**
- PDF: Binary stream with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="AnselAI_PnL_2026-Q1.pdf"`
- CSV: Text stream with `Content-Type: text/csv`, `Content-Disposition: attachment; filename="AnselAI_PnL_2026-Q1.csv"`

**Rate Limit:** 10 exports per hour per user (to prevent abuse).

**Audit Log:** Log every export (user, report type, entity, timestamp).

### 9. Enhanced Export Button (`components/reports/export-button.tsx`)

**UI:**
```
┌──────────────────┐
│ 📥 Export ▾      │
├──────────────────┤
│ 📄 Export PDF    │
│ 📊 Export CSV    │
└──────────────────┘
```

Dropdown menu with two options. On click:
1. Show loading spinner
2. POST to `/api/v1/reports/export`
3. Trigger browser download
4. Show success toast

### 10. Report Index Page Updates (`[entity]/reports/page.tsx`)

Add cards for new reports:

```
┌─────────────────────────────────────────┐
│ Financial Reports                       │
├─────────────────────────────────────────┤
│ Core Reports:                           │
│  • Profit & Loss                        │
│  • Balance Sheet                        │
│  • Cash Flow Statement                  │
│  • Tax Summary & Estimates              │
│                                         │
│ Analysis Reports:                       │
│  • Revenue by Client/Project     [NEW]  │
│  • Expense Trends (12 months)    [NEW]  │
│  • Budget Variance               [NEW]  │
└─────────────────────────────────────────┘
```

## New Prisma Models

None needed. Uses existing transaction, category, invoice, and budget data.

## Testing Requirements

1. **PDF Generation:** Generate P&L PDF for AnselAI Q1 2026, verify valid PDF (check magic bytes `%PDF`)
2. **CSV Export:** Export balance sheet as CSV, verify parseable by Excel/Google Sheets
3. **YTD Comparison:** P&L for Jan-Feb 2026 vs Jan-Feb 2025, verify correct amounts
4. **Revenue by Client:** 5 invoices across 3 clients, verify totals match
5. **Expense Trends:** 12 months of transaction data, verify chart renders correctly, trend indicators accurate
6. **Budget Variance:** Budget $5000 for Marketing, actual $6200, verify shows 24% over budget, red flag
7. **Combined View:** Owner role sees combined P&L with all 3 entities summed correctly
8. **Access Control:** Non-owner cannot access `/combined`, gets 403
9. **Export Rate Limit:** 11th export in an hour returns 429 Too Many Requests
10. **Audit Trail:** Verify export logged in AuditLog with user, report type, timestamp

## Constraints

- **Money is BIGINT cents.** Display formatted in UI and PDF/CSV.
- **CONFIDENTIAL marking:** All PDFs must include watermark and header marking.
- **No external dependencies** for PDF generation beyond @react-pdf/renderer.
- **Print-friendly PDFs:** White background, black text, no dark theme colors in PDF output.
- **CSV Excel compatibility:** UTF-8 with BOM, RFC 4180 compliant.
- **Access control:** Combined view is OWNER only. Enforce in middleware.
- **YTD comparison only for P&L.** Balance sheet is point-in-time, comparison doesn't make sense.

---

🦞 **Marcus Rawlins**
