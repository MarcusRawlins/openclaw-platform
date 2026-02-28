# Finance Hub — Task 22: Cash Flow Forecasting + Tax Optimization

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 9.4, 9.5)
> Phase 4 Overview: `/workspace/specs/fh-phase4-overview.md`
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Two AI-powered features: (1) 90-day cash flow forecasting per entity (Sonnet), displayed as a dashboard chart, and (2) quarterly tax optimization analysis (Opus), generating a written report with actionable recommendations.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Architecture

```
src/lib/ai/
├── forecasting.ts         # Cash flow projection logic + Sonnet integration
├── tax-optimization.ts    # Quarterly tax analysis + Opus integration
└── prompts/
    ├── forecast.ts        # Prompt templates for cash flow
    └── tax.ts             # Prompt templates for tax optimization

src/app/(dashboard)/[entity]/forecast/
└── page.tsx               # Cash flow forecast page with chart

src/app/(dashboard)/[entity]/reports/tax-optimization/
└── page.tsx               # Tax optimization report view

src/app/api/v1/
├── forecast/
│   ├── route.ts           # POST — generate forecast, GET — latest forecast
│   └── [id]/route.ts      # GET — specific forecast
└── tax-optimization/
    ├── route.ts           # POST — generate report, GET — list reports
    └── [id]/route.ts      # GET — specific report
```

## Part 1: Cash Flow Forecasting

### Data Assembly

Before calling Sonnet, assemble the projection inputs:

```typescript
interface ForecastInput {
  entityId: string;
  historicalMonths: MonthlySummary[];    // 12+ months of actual data
  recurringRules: RecurringRule[];       // expected recurring income/expenses
  outstandingInvoices: Invoice[];        // AR: expected incoming payments
  outstandingBills: Invoice[];           // AP: expected outgoing payments
  currentCashPosition: bigint;          // sum of asset accounts
  currentLiabilities: bigint;           // sum of liability accounts
}
```

### Sonnet Prompt (`prompts/forecast.ts`)

```typescript
export function buildForecastPrompt(input: ForecastInput): string {
  return `You are a financial analyst for "${input.entityName}".

Given the following financial data, project cash flow for the next 90 days (3 months).

CURRENT POSITION:
- Cash: $${formatCents(input.currentCashPosition)}
- Liabilities: $${formatCents(input.currentLiabilities)}

HISTORICAL MONTHLY DATA (last 12 months):
${input.historicalMonths.map(m => 
  `${m.year}-${m.month}: Revenue $${formatCents(m.totalCredit)} | Expenses $${formatCents(m.totalDebit)} | Net $${formatCents(m.totalCredit - m.totalDebit)}`
).join('\n')}

RECURRING OBLIGATIONS:
${input.recurringRules.map(r => 
  `- ${r.description}: $${formatCents(r.amountCents)} ${r.frequency}`
).join('\n')}

OUTSTANDING RECEIVABLES:
${input.outstandingInvoices.map(i => 
  `- ${i.clientName}: $${formatCents(i.totalCents)} due ${i.dueDate.toISOString().split('T')[0]}`
).join('\n')}

OUTSTANDING PAYABLES:
${input.outstandingBills.map(i =>
  `- ${i.clientName}: $${formatCents(i.totalCents)} due ${i.dueDate.toISOString().split('T')[0]}`
).join('\n')}

Provide a 90-day cash flow projection as JSON:
{
  "projections": [
    {
      "month": "2026-03",
      "projectedRevenueCents": 0,
      "projectedExpensesCents": 0,
      "projectedNetCents": 0,
      "endingCashCents": 0,
      "confidenceLow": 0.0,
      "confidenceHigh": 0.0
    }
  ],
  "assumptions": ["list of key assumptions"],
  "risks": ["list of risk factors"],
  "summary": "1-2 sentence plain English summary"
}

Use confidence intervals (low/high multipliers on projected values, e.g., 0.8 to 1.2).
Consider seasonal patterns from historical data.
Factor in recurring obligations and outstanding invoices/bills.`;
}
```

### Forecast Storage

```prisma
model CashFlowForecast {
  id              String   @id @default(uuid()) @db.Uuid
  entityId        String   @map("entity_id") @db.Uuid
  projections     Json                         // array of monthly projections
  assumptions     Json                         // string array
  risks           Json                         // string array
  summary         String
  inputTokens     Int      @map("input_tokens")
  outputTokens    Int      @map("output_tokens")
  createdAt       DateTime @default(now()) @map("created_at")

  entity          Entity   @relation(fields: [entityId], references: [id])

  @@map("cash_flow_forecasts")
  @@schema("shared")
}
```

### Forecast Chart (`forecast/page.tsx`)

Recharts line chart:
- X axis: months (3 months historical + 3 months projected)
- Y axis: dollars
- Solid line: historical actual
- Dashed line: projected
- Shaded area: confidence interval (low to high)
- Hover tooltip: exact values

Below chart:
- Assumptions list
- Risk factors
- Summary text
- "Regenerate Forecast" button
- Last generated timestamp

### Dashboard Widget

Add a compact forecast widget to the entity dashboard:
- Shows next month projected net cash flow
- Trend indicator (up/down vs current)
- "View Full Forecast →" link

## Part 2: Tax Optimization

### Quarterly Schedule

Runs automatically in January, April, July, October (after quarterly close):
- Q1 analysis in April (covers Jan-Mar)
- Q2 analysis in July (covers Apr-Jun)
- Q3 analysis in October (covers Jul-Sep)
- Q4 analysis in January (covers Oct-Dec)

Also runnable on-demand from the UI.

### Data Assembly

```typescript
interface TaxOptimizationInput {
  entityId: string;
  entityType: 'BUSINESS' | 'PERSONAL';
  quarter: string;                          // e.g., "2026-Q1"
  ytdRevenueCents: bigint;
  ytdExpensesCents: bigint;
  categorizedExpenses: {
    categoryName: string;
    taxCategory: string;
    totalCents: bigint;
    isTaxDeductible: boolean;
  }[];
  priorYearTaxData?: {                     // if available
    effectiveRate: number;
    totalDeductions: bigint;
  };
  estimatedPaymentsMade: bigint;            // quarterly payments already made
  entityStructure: string;                   // LLC, S-Corp, sole prop, etc.
}
```

### Opus Prompt (`prompts/tax.ts`)

```typescript
export function buildTaxOptimizationPrompt(input: TaxOptimizationInput): string {
  return `You are a tax strategist analyzing ${input.quarter} for "${input.entityName}" (${input.entityStructure}).

IMPORTANT: This is analysis only, not tax advice. Recommend consulting a CPA for implementation.

YTD FINANCIALS:
- Revenue: $${formatCents(input.ytdRevenueCents)}
- Expenses: $${formatCents(input.ytdExpensesCents)}
- Net Income: $${formatCents(input.ytdRevenueCents - input.ytdExpensesCents)}

CATEGORIZED DEDUCTIONS:
${input.categorizedExpenses.filter(e => e.isTaxDeductible).map(e =>
  `- ${e.categoryName} (${e.taxCategory}): $${formatCents(e.totalCents)}`
).join('\n')}

ESTIMATED PAYMENTS MADE YTD: $${formatCents(input.estimatedPaymentsMade)}

${input.priorYearTaxData ? `PRIOR YEAR:
- Effective tax rate: ${input.priorYearTaxData.effectiveRate}%
- Total deductions: $${formatCents(input.priorYearTaxData.totalDeductions)}` : ''}

Analyze and respond as JSON:
{
  "quarterlyEstimate": {
    "estimatedTaxCents": 0,
    "effectiveRate": 0.0,
    "selfEmploymentTaxCents": 0,
    "recommendedPaymentCents": 0
  },
  "missedDeductions": [
    {
      "category": "category name",
      "description": "what to look for",
      "estimatedSavingsCents": 0
    }
  ],
  "recategorizationSuggestions": [
    {
      "currentCategory": "...",
      "suggestedCategory": "...",
      "transactionCount": 0,
      "estimatedSavingsCents": 0,
      "reasoning": "..."
    }
  ],
  "auditRisks": [
    {
      "category": "...",
      "risk": "description",
      "severity": "low|medium|high"
    }
  ],
  "summary": "2-3 paragraph executive summary with key recommendations"
}

Consider:
- Self-employment tax (15.3%) for business entities
- Home office deduction if applicable
- Vehicle/mileage deductions
- Section 179 equipment deductions
- QBI deduction (20%) for qualified business income
- NC state tax obligations
- Partnership K-1 split implications (By The Reeses LLC is a partnership)`;
}
```

### Report Storage

```prisma
model TaxOptimizationReport {
  id                   String   @id @default(uuid()) @db.Uuid
  entityId             String   @map("entity_id") @db.Uuid
  quarter              String                      // "2026-Q1"
  quarterlyEstimate    Json     @map("quarterly_estimate")
  missedDeductions     Json     @map("missed_deductions")
  recategorizationSuggestions Json @map("recategorization_suggestions")
  auditRisks           Json     @map("audit_risks")
  summary              String
  inputTokens          Int      @map("input_tokens")
  outputTokens         Int      @map("output_tokens")
  createdAt            DateTime @default(now()) @map("created_at")

  entity               Entity   @relation(fields: [entityId], references: [id])

  @@map("tax_optimization_reports")
  @@schema("shared")
}
```

### Report UI (`reports/tax-optimization/page.tsx`)

Sections:
1. **Quarterly Estimate Card:** Estimated tax, SE tax, recommended payment, effective rate
2. **Missed Deductions:** Table with category, description, estimated savings. Sortable by savings.
3. **Recategorization Suggestions:** What to move, estimated savings, one-click "Apply" (updates categories)
4. **Audit Risks:** Risk cards with severity badges (green/amber/red)
5. **Summary:** Executive summary text
6. **Actions:** "Generate New Report", "Download PDF", "Share with CPA"

### Quarterly Cron Jobs

Set up 4 cron jobs (or one that checks the month):
```
# Run on 5th of Jan/Apr/Jul/Oct at 9am ET
0 9 5 1,4,7,10 * — Tax optimization for all business entities
```

Also auto-generate cash flow forecast monthly:
```
# 1st of each month at 8am ET
0 8 1 * * — Cash flow forecast for all entities
```

## Sidebar Navigation

Add to entity sidebar:
```
📊 Dashboard
💳 Transactions
📥 Import
✅ Review
📄 Invoices
🔄 Recurring
💰 Budget
📈 Reports
  ├── P&L
  ├── Balance Sheet
  ├── Cash Flow
  ├── Tax Summary
  └── Tax Optimization  ← This task
📉 Forecast             ← This task
🏷️ Categorize
```

## Testing Requirements

1. **Forecast data assembly:** Verify correct historical data aggregation
2. **Forecast chart:** Renders with historical + projected, confidence bands visible
3. **Forecast regeneration:** New forecast replaces old, history kept
4. **Tax optimization data assembly:** YTD calculations correct
5. **Tax report rendering:** All sections display, missed deductions sortable
6. **Recategorization apply:** Click "Apply" on suggestion, verify categories updated
7. **Cron scheduling:** Verify quarterly trigger fires in correct months
8. **Cost tracking:** Token usage logged per report

Mock Anthropic API in tests. Do not make real API calls.

## Constraints

- **Money is BIGINT cents.** Format only in prompts and UI.
- **Sonnet for forecasting** (cost-effective, fast). **Opus for tax optimization** (complex reasoning).
- **Anthropic API only.** Hard security boundary for financial data.
- **No PII in prompts.** Strip client names from invoice data before sending.
- **Disclaimer on all tax reports:** "This analysis is for informational purposes only. Consult a qualified CPA before making tax decisions."
- **Reports are immutable once generated.** Don't edit past reports. Generate new ones.
