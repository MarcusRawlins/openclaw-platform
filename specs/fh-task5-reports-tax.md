# Finance Hub — Task 5: Reports + Tax Estimates

> 🦞 Marcus Rawlins | Spec v1.1 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 7, 18)
> Depends on: Task 1, Task 2, Task 3, Task 4
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+. Below threshold → back to Brunel.

---

## Objective

Build P&L, balance sheet, cash flow, and tax summary reports for each entity + consolidated. Add quarterly estimated tax calculator with payment tracking. This completes Phase 1.

## Critical Rules

1. **All calculations use BigInt cents.** Never convert to floats for math. Only format for display.
2. **Reports calculate from TransactionLines** (the double-entry journal), not from Transaction amounts. This ensures accuracy.
3. **Balance sheet must balance.** Assets = Liabilities + Equity. If it doesn't, show a WARNING banner.
4. **Tax calculations use the partnership structure** per PRD Section 18 (By The Reeses LLC = two-member, 50/50 K-1 split).

## File Structure

```
finance-hub/src/
├── app/
│   ├── (dashboard)/
│   │   └── [entity]/
│   │       └── reports/
│   │           ├── page.tsx              # Reports index / overview
│   │           ├── profit-loss/
│   │           │   └── page.tsx
│   │           ├── balance-sheet/
│   │           │   └── page.tsx
│   │           ├── cash-flow/
│   │           │   └── page.tsx
│   │           └── tax/
│   │               └── page.tsx          # Tax estimates + quarterly payments
│   └── api/
│       └── v1/
│           └── entities/
│               └── [entityId]/
│                   ├── pnl/route.ts      # P&L endpoint (per PRD Section 8)
│                   ├── balance-sheet/route.ts
│                   ├── cash-flow/route.ts
│                   └── tax-estimate/route.ts
├── components/
│   └── reports/
│       ├── report-header.tsx         # Date range, entity, comparison toggle, export
│       ├── report-table.tsx          # Hierarchical account table with indentation
│       ├── report-row.tsx            # Row with indent level, amounts, comparison
│       ├── comparison-columns.tsx    # Prior period / prior year columns
│       ├── balance-check.tsx         # Assets = L+E verification banner
│       ├── tax-summary-card.tsx      # Quarterly payment card
│       ├── tax-calendar.tsx          # Payment due dates visual
│       └── export-button.tsx         # CSV download trigger
├── lib/
│   └── reports/
│       ├── profit-loss.ts            # P&L calculation from TransactionLines
│       ├── balance-sheet.ts          # Balance sheet from account balances
│       ├── cash-flow.ts              # Cash flow (indirect method)
│       └── tax-estimate.ts           # SE tax + federal + NC state calculation
```

## Report: Profit & Loss

### Parameters
- Entity (or consolidated)
- Date range (presets: This Month, This Quarter, This Year, Last Year, Custom)
- Comparison: None, Previous Period, Previous Year

### Calculation Method

Query TransactionLines grouped by account, filtered by date range:
- **Revenue:** SUM of CREDIT lines to REVENUE-type accounts minus SUM of DEBIT lines (refunds)
- **Expenses:** SUM of DEBIT lines to EXPENSE-type accounts minus SUM of CREDIT lines (refunds)
- **Net Income:** Revenue - Expenses

### Display Structure

```
REVENUE
  4000 Service Revenue          $XX,XXX.XX    [$YY,YYY.YY]   [+$Z,ZZZ.ZZ  +XX.X%]
  4100 Product Revenue          $X,XXX.XX     [$Y,YYY.YY]    [+$ZZZ.ZZ    +XX.X%]
  4200 Interest Income          $XXX.XX
  4300 Other Income             $XXX.XX
  ─────────────────────────────────────────
  TOTAL REVENUE                 $XX,XXX.XX

OPERATING EXPENSES
  5000 Advertising & Marketing  $X,XXX.XX
  5010 Auto & Mileage           $XXX.XX
  [... all expense accounts with non-zero balances ...]
  5999 Uncategorized Expense    $XXX.XX       ← highlight in yellow if > $0
  ─────────────────────────────────────────
  TOTAL EXPENSES                $XX,XXX.XX

NET INCOME                      $XX,XXX.XX
```

Comparison columns shown when comparison mode is active. Dollar and percentage change.

### Consolidated P&L

When entity = "consolidated":
- Show per-entity columns: AnselAI | R3 Studios | Family | Combined
- Allow toggling which entities are included

### API: GET /api/v1/entities/:entityId/pnl

Per PRD Section 8. Query: `from`, `to`, `compareTo` (previous_period | previous_year | none)

Response:
```json
{
  "entity": "anselai",
  "period": { "from": "2026-01-01", "to": "2026-12-31" },
  "comparison": { "from": "2025-01-01", "to": "2025-12-31" },
  "sections": [
    {
      "name": "Revenue",
      "accounts": [
        {
          "code": "4000",
          "name": "Service Revenue",
          "amountCents": 5000000000,
          "comparisonCents": 3500000000,
          "changeCents": 1500000000,
          "changePercent": 42.86
        }
      ],
      "totalCents": 5000000000,
      "comparisonTotalCents": 3500000000
    },
    {
      "name": "Operating Expenses",
      "accounts": [...],
      "totalCents": 2500000000,
      "comparisonTotalCents": 2000000000
    }
  ],
  "netIncomeCents": 2500000000,
  "comparisonNetIncomeCents": 1500000000,
  "amounts_in": "cents",
  "confidential": true
}
```

## Report: Balance Sheet

### Calculation Method

For each account, calculate balance as of the `asOf` date:
- **ASSET accounts:** Opening balance + SUM(DEBIT lines) - SUM(CREDIT lines)
- **LIABILITY accounts:** Opening balance + SUM(CREDIT lines) - SUM(DEBIT lines)
- **EQUITY accounts:** Opening balance + SUM(CREDIT lines) - SUM(DEBIT lines)
- **Retained Earnings:** Calculated as cumulative Net Income (all-time revenue - all-time expenses)

### Display Structure

```
ASSETS
  Current Assets
    1000 Cash & Checking         $XX,XXX.XX
    1010 Savings                 $XX,XXX.XX
    1100 Accounts Receivable     $X,XXX.XX
    1200 Prepaid Expenses        $XXX.XX
    ───────────────────────────────
    Total Current Assets         $XX,XXX.XX

  Fixed Assets
    1500 Equipment               $X,XXX.XX
    1510 Accum. Depreciation     ($XXX.XX)
    ───────────────────────────────
    Total Fixed Assets           $X,XXX.XX

  TOTAL ASSETS                   $XX,XXX.XX

LIABILITIES
  Current Liabilities
    2000 Accounts Payable        $X,XXX.XX
    2100 CC - Amex Gold          $X,XXX.XX
    2101 CC - Amex Reserve       $X,XXX.XX
    [... other cards ...]
    ───────────────────────────────
    Total Liabilities            $X,XXX.XX

EQUITY
    3000 Owner's Equity          $XX,XXX.XX
    3100 Owner's Draw            ($X,XXX.XX)
    3200 Retained Earnings       $XX,XXX.XX   ← calculated
    ───────────────────────────────
    Total Equity                 $XX,XXX.XX

TOTAL LIABILITIES + EQUITY       $XX,XXX.XX
```

**Balance Check:** If `TOTAL ASSETS ≠ TOTAL LIABILITIES + EQUITY`, show a prominent WARNING banner with the difference amount. This indicates a data integrity issue.

### API: GET /api/v1/entities/:entityId/balance-sheet

Query: `asOf` (date, default: today)

## Report: Cash Flow (Indirect Method)

### Display Structure

```
OPERATING ACTIVITIES
  Net Income                                 $XX,XXX.XX
  Adjustments:
    Change in Accounts Receivable            ($X,XXX.XX)
    Change in Accounts Payable               $X,XXX.XX
    Change in Prepaid Expenses               ($XXX.XX)
    ──────────────────────────────────────────
  Net Cash from Operations                   $XX,XXX.XX

INVESTING ACTIVITIES
  Equipment Purchases                        ($X,XXX.XX)
  ──────────────────────────────────────────
  Net Cash from Investing                    ($X,XXX.XX)

FINANCING ACTIVITIES
  Owner's Draw                               ($X,XXX.XX)
  Owner's Contributions                      $X,XXX.XX
  ──────────────────────────────────────────
  Net Cash from Financing                    ($X,XXX.XX)

NET CHANGE IN CASH                           $XX,XXX.XX
Beginning Cash Balance                       $XX,XXX.XX
Ending Cash Balance                          $XX,XXX.XX
```

### API: GET /api/v1/entities/:entityId/cash-flow

Query: `from`, `to`

## Tax Estimation (PRD Section 18)

### Partnership Tax Requirements

By The Reeses LLC = two-member (Tyler + Alex), taxed as partnership:
- **Form 1065** partnership return
- **Schedule K-1** per member (50/50 split unless specified)
- **Self-employment tax** on net SE income

### Tax Calculator

```typescript
interface TaxEstimate {
  year: number;
  incomeByEntity: {
    anselai: { revenueCents: bigint; expensesCents: bigint; netIncomeCents: bigint };
    r3studios: { revenueCents: bigint; expensesCents: bigint; netIncomeCents: bigint };
  };
  totalSEIncomeCents: bigint;        // anselai + r3studios net income
  annualizedIncomeCents: bigint;     // Project YTD to full year
  taxes: {
    selfEmploymentCents: bigint;     // 15.3% on 92.35% of SE income (SS cap applies)
    federalIncomeCents: bigint;      // Based on projected bracket (MFJ)
    stateNCCents: bigint;            // 4.5% flat on taxable income
    totalCents: bigint;
    quarterlyPaymentCents: bigint;   // total / 4
  };
  quarters: Array<{
    quarter: string;                 // "Q1", "Q2", "Q3", "Q4"
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    amountCents: bigint;
    paidCents: bigint;               // Manual entry (stored in a simple settings table or JSON)
    status: 'paid' | 'upcoming' | 'overdue' | 'future';
  }>;
  k1Split: {
    tyler: { percent: number; seTaxCents: bigint };
    alex: { percent: number; seTaxCents: bigint };
  };
  amounts_in: 'cents';
  confidential: true;
}
```

### Tax Brackets (2026 / use 2025 if 2026 unavailable)

Hardcode as constants. Use Married Filing Jointly brackets:

```typescript
const FEDERAL_BRACKETS_MFJ_2025 = [
  { min: 0, max: 23850, rate: 0.10 },
  { min: 23850, max: 96950, rate: 0.12 },
  { min: 96950, max: 206700, rate: 0.22 },
  { min: 206700, max: 394600, rate: 0.24 },
  { min: 394600, max: 501050, rate: 0.32 },
  { min: 501050, max: 751600, rate: 0.35 },
  { min: 751600, max: Infinity, rate: 0.37 },
];

const NC_STATE_RATE = 0.045;  // 4.5% flat

const SE_TAX_RATE = 0.153;   // 15.3% (12.4% SS + 2.9% Medicare)
const SE_INCOME_FACTOR = 0.9235;  // 92.35% of net SE income
const SS_WAGE_BASE_2025 = 176100; // Social Security wage cap
```

### Annualization

If current date is April 15 and YTD income is $30,000:
- Days elapsed = 105
- Annualized = $30,000 × (365 / 105) = $104,286

### Quarterly Payment Dates (2026)

| Quarter | Period | Due Date |
|---------|--------|----------|
| Q1 | Jan 1 - Mar 31 | April 15, 2026 |
| Q2 | Apr 1 - May 31 | June 15, 2026 |
| Q3 | Jun 1 - Aug 31 | September 15, 2026 |
| Q4 | Sep 1 - Dec 31 | January 15, 2027 |

### Tax Page UI

- **Hero card:** Current quarter estimated payment amount, due date, days until due
- **Calendar view:** All 4 quarters with paid/unpaid/overdue status
- **Income breakdown:** Per-entity net SE income table
- **Tax breakdown:** SE tax + federal + NC state, shown as a stacked visualization
- **K-1 split:** Tyler and Alex's respective shares
- **Payment tracking:** Manual input for payments already made (store in a `tax_payments` table or localStorage for Phase 1)
- **Safe harbor note:** "Pay 110% of prior year tax to avoid underpayment penalty" with calculation

### API: GET /api/v1/entities/:entityId/tax-estimate?year=2026

Returns TaxEstimate shape above. Only meaningful for business entities. Returns error for "family".

For consolidated view, combine anselai + r3studios.

## CSV Export

Every report has an export button. Implementation:

```typescript
// For each report, add a ?export=csv query param
// When present, return Content-Type: text/csv with Content-Disposition: attachment
```

CSV should mirror the display structure with proper column headers.

## Sidebar Navigation (Final)

```
Dashboard
Transactions
Categorize    (23)
Reports ▸
  ├── Profit & Loss
  ├── Balance Sheet
  ├── Cash Flow
  └── Tax Estimates
Settings        ← placeholder (Phase 2: account management, API keys, preferences)
```

## MonthlySummary Materialization

The MonthlySummary table (defined in Task 1's schema) should be populated/refreshed:
- After any import batch
- After any transaction update (category change, status change)
- Reports can use MonthlySummary for fast dashboard loading, but detailed reports should calculate from TransactionLines for accuracy

```typescript
async function refreshMonthlySummaries(entityId: string, year: number, month: number): Promise<void>
```

## Acceptance Criteria

1. P&L report shows correct revenue/expense totals calculated from TransactionLines
2. P&L comparison mode shows prior period with dollar and percentage changes
3. Balance sheet balances (Assets = Liabilities + Equity). Warning banner if not.
4. Balance sheet correctly calculates Retained Earnings from cumulative income
5. Cash flow statement calculates operating/investing/financing sections correctly
6. Consolidated view aggregates all entities with per-entity columns
7. Tax estimate calculates SE tax at 15.3% on 92.35% of net SE income
8. Tax estimate applies correct federal MFJ brackets
9. Tax estimate applies NC 4.5% flat rate
10. Quarterly payment calendar shows correct due dates and paid/unpaid status
11. K-1 split shows 50/50 Tyler/Alex breakdown
12. CSV export downloads for each report
13. All amounts stored/calculated as BigInt cents, displayed as formatted currency
14. Uncategorized Expense line highlighted in yellow on P&L if > $0
15. MonthlySummary table refreshed on data changes
16. `X-Confidentiality: RESTRICTED` on all report endpoints
17. Reports are visually polished with Robinhood design system
18. No TypeScript errors, no console errors

## What NOT To Build

- No bank PDF import (Phase 2)
- No mileage/depreciation (Phase 2)
- No home office deduction (Phase 2)
- No 1099 tracking (Phase 2)
- No meals & entertainment auto-split (Phase 2)
- No CPA export format (Phase 2)
- No natural language queries (Phase 2)
- No anomaly detection (Phase 2)
- No Mission Control widget (separate task)
- No quarterly payment reminder cron (Marcus will set this up separately)

## Phase 1 Complete

When this task passes Walt (95%) and Marcus (99%), Finance Hub Phase 1 is done. Brunel should STOP. Do not start Phase 2 features. Future work will be scoped separately.

## References

Brunel MUST read before starting:
- PRD Section 7: Reporting (report catalog, materialized summaries)
- PRD Section 18: Tax Infrastructure (partnership requirements, feature matrix)
- PRD Section 12: Confidentiality Rules (never leak dollar amounts)
- PRD Section 3: Data Model → money handling (BigInt cents)
