# Finance Hub — Task 3: Dashboard + Transaction UI

> 🦞 Marcus Rawlins | Spec v1.1 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 6, 8)
> Depends on: Task 1, Task 2
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+. Below threshold → back to Brunel.

---

## Objective

Build the Finance Hub UI: design system, entity/global dashboards, transaction list with filtering/search, entity switcher. This is where the visual identity lands.

## Design Direction

**Base:** Mission Control's dark theme, card-based layout, sidebar navigation.
**Personality:** Robinhood-inspired. Clean typography, generous whitespace, bold numbers for key figures, green/red for positive/negative, smooth transitions, portfolio-style hero summaries.

### Design Tokens

```typescript
const colors = {
  bg: {
    primary: '#0D0D0F',      // Near-black background
    card: '#16161A',          // Card surfaces
    cardHover: '#1C1C22',     // Card hover
    input: '#1A1A1F',         // Input fields
  },
  text: {
    primary: '#F5F5F7',      // Primary (off-white)
    secondary: '#8E8E93',    // Muted
    tertiary: '#636366',     // Disabled/hint
  },
  accent: {
    green: '#30D158',        // Positive/revenue/profit
    red: '#FF453A',          // Negative/expense/loss
    blue: '#0A84FF',         // Links, interactive
    purple: '#BF5AF2',       // Highlights, badges
    yellow: '#FFD60A',       // Warnings, needs review
  },
  border: '#2C2C2E',
};

const fonts = {
  display: 'SF Pro Display, Inter, system-ui',
  body: 'SF Pro Text, Inter, system-ui',
  mono: 'SF Mono, JetBrains Mono, monospace',
};
```

### Typography Scale

- Hero numbers (balances, P&L): 36px, font-display, font-bold
- Section headers: 20px, font-display, font-semibold
- Card titles: 16px, font-body, font-medium
- Body: 14px, font-body, normal
- Small/labels: 12px, font-body, text-secondary
- All amounts: 14px, font-mono, tabular-nums

### Money Display Rules

- Always format from BigInt cents: `123456n` → `$1,234.56`
- Green for income/positive, red for expenses/negative
- Use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` as the base formatter
- Amounts in `confidential: true` contexts should have a "hide amounts" toggle (stores preference in localStorage)
- Never show raw cents values in the UI

## File Structure

```
finance-hub/src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar nav + entity context
│   │   ├── page.tsx                # Global dashboard (consolidated)
│   │   ├── [entity]/
│   │   │   ├── page.tsx            # Entity-specific dashboard
│   │   │   └── transactions/
│   │   │       └── page.tsx        # Transaction list for entity
│   │   └── transactions/
│   │       └── page.tsx            # All transactions (consolidated)
│   └── api/
│       ├── v1/
│       │   ├── entities/
│       │   │   ├── route.ts            # GET list entities
│       │   │   └── [entityId]/
│       │   │       ├── summary/route.ts # GET entity summary (PRD Section 8)
│       │   │       └── transactions/
│       │   │           └── route.ts     # GET/POST transactions
│       │   └── transactions/
│       │       └── [id]/route.ts        # GET single, PUT update
│       └── dashboard/
│           └── route.ts                # GET dashboard summary data
├── components/
│   ├── ui/
│   │   ├── card.tsx
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── table.tsx
│   │   ├── pagination.tsx
│   │   ├── skeleton.tsx            # Loading states
│   │   ├── amount.tsx              # Formatted BigInt cents → $X,XXX.XX with color
│   │   └── date-range-picker.tsx
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── entity-switcher.tsx
│   ├── dashboard/
│   │   ├── hero-summary.tsx        # Big numbers: net worth, income, expenses
│   │   ├── account-cards.tsx       # Card per account type with balances
│   │   ├── recent-transactions.tsx # Last 20 transactions
│   │   └── monthly-chart.tsx       # Income vs expenses bar chart (Recharts)
│   └── transactions/
│       ├── transaction-table.tsx
│       ├── transaction-filters.tsx
│       ├── transaction-row.tsx
│       └── transaction-status.tsx  # PENDING/CLEARED/RECONCILED/VOID badges
├── lib/
│   ├── format.ts                   # BigInt cents → display string utilities
│   └── entities.ts                 # Entity context provider + hook
└── hooks/
    ├── use-entity.ts
    └── use-transactions.ts
```

## Entity Switcher

Top of sidebar. Dropdown with:
- **AnselAI** (By The Reeses) — BUSINESS badge
- **R3 Studios** — BUSINESS badge
- **Reese Family** — PERSONAL badge
- **Consolidated** (all entities combined)

Switching changes all data. Store in URL: `/anselai/transactions`, `/consolidated`, etc.

## Dashboard Pages

### Per-Entity Dashboard (`/[entity]`)

Per PRD Section 6.1:
- **Current month P&L** — revenue vs expenses bar chart
- **Cash position** — sum of all ASSET accounts minus LIABILITIES
- **Recent transactions** — last 20, compact list
- **Outstanding invoices** — AR aging (placeholder until invoices are built, show "No invoices yet")
- **Budget vs actual** — placeholder ("Budgets coming soon")
- **Upcoming recurring** — placeholder ("Recurring rules coming soon")

### Global Dashboard (`/` or `/consolidated`)

Per PRD Section 6.1:
- **Combined net worth** across all entities
- **Per-entity P&L comparison** — side-by-side cards
- **Cash flow trend** — 12-month line chart (Recharts)
- **Alerts** — placeholder ("Alerts coming soon")

### Hero Summary (Robinhood-style)

Large numbers at top of every dashboard:

```
Net Worth / Cash Position    Income (MTD)         Expenses (MTD)
$XX,XXX.XX                   $X,XXX.XX            $X,XXX.XX
  ▲ 12.3% vs last month       ▲ vs last month       ▼ vs last month
```

Green/red arrows + percentage for month-over-month change.

### Account Balance Cards

Grid of cards:
- Cash & Banking (sum of ASSET/checking + savings accounts)
- Credit Cards (sum of LIABILITY/credit_card, show as amount owed)
- Accounts Receivable
- Revenue YTD
- Expenses YTD

Each card: title, big mono number with color, entity badge if consolidated.

### Monthly Chart

Recharts `BarChart`: income vs expenses by month for last 12 months. Stacked or grouped bars. Green for income, red for expenses.

Also a `LineChart` for the global dashboard showing cash flow trend.

## Transaction List Page

### URL Structure
- `/[entity]/transactions` — entity-specific
- `/transactions` — consolidated (all entities)

### Filters Bar

- **Date range:** date picker (from/to), quick presets (This Month, Last Month, This Quarter, This Year, Last Year, All Time)
- **Source:** multi-select (All, Amex Gold, Amex Reserve, Amex Delta, Amex Bonvoy, Venture, HoneyBook, Manual)
- **Category:** dropdown with search
- **Status:** All / Pending / Cleared / Reconciled / Void
- **Type:** All / Income / Expense
- **Search:** text search on description, reference, notes

### Table Columns

| Column | Width | Notes |
|--------|-------|-------|
| Date | 100px | YYYY-MM-DD, font-mono |
| Description | flex | Cleaned description. Show merchant name if available. |
| Category | 150px | Badge. "Uncategorized" in yellow if no category. |
| Source | 100px | Short label + optional icon |
| Amount | 120px | Right-aligned, mono, green income / red expense. BigInt cents → formatted. |
| Status | 80px | Colored badge: PENDING (yellow), CLEARED (green), RECONCILED (blue), VOID (gray) |
| Entity | 80px | Only shown in consolidated view |

### Pagination

- 50 rows per page default
- Page numbers + prev/next at bottom
- "Showing X-Y of Z transactions" label
- Total sum of visible transactions at bottom of Amount column

### Transaction Detail

Clicking a row expands or opens a detail panel showing:
- All transaction fields
- TransactionLines (debit/credit entries with account names)
- Import source and hash
- Created/updated timestamps
- Edit button (for category, description, notes, status)

### API Endpoints

**GET /api/v1/entities/:entityId/summary** (per PRD Section 8)

Response matches PRD exactly:
```json
{
  "entity": "anselai",
  "period": "2026-02",
  "revenue": 85000000,
  "expenses": 31250000,
  "net_income": 53750000,
  "cash_position": 245000000,
  "outstanding_ar": 35000000,
  "currency": "USD",
  "amounts_in": "cents",
  "confidential": true
}
```

**GET /api/v1/entities/:entityId/transactions**

Query params per PRD: `from`, `to`, `account`, `category`, `status`, `search`, `page`, `limit`

Response:
```json
{
  "transactions": [...],
  "total": 1234,
  "page": 1,
  "limit": 50,
  "totalPages": 25,
  "amounts_in": "cents",
  "confidential": true
}
```

**GET /api/v1/transactions/:id** — Single transaction with lines

**PUT /api/v1/transactions/:id** — Update category, description, notes, status. Audit logged.

**GET /api/dashboard** — Dashboard summary (internal, not the v1 API)

Response:
```json
{
  "summary": {
    "netWorth": 1234567800,
    "incomeMTD": 500000000,
    "expensesMTD": 234567800,
    "incomeChange": 12.3,
    "expenseChange": -5.2
  },
  "accountBalances": [
    { "type": "cash", "label": "Cash & Banking", "balance": 1500000000 },
    { "type": "credit_card", "label": "Credit Cards", "balance": -265433200 }
  ],
  "recentTransactions": [...],
  "monthlyData": [
    { "month": "2026-01", "income": 800000000, "expenses": 500000000 }
  ],
  "amounts_in": "cents",
  "confidential": true
}
```

## Response Headers

All financial data endpoints must include:
- `X-Confidentiality: RESTRICTED`
- Standard CORS headers per Task 1 config

## Responsive Design

- Desktop first (Tailscale-only internal tool)
- Sidebar collapses on smaller viewports
- Tables horizontally scroll if needed
- Mobile is not a priority but shouldn't be broken

## Acceptance Criteria

1. Dark theme implements design tokens exactly
2. Entity switcher works, URL updates, all data changes
3. Global dashboard shows consolidated net worth and per-entity comparison
4. Entity dashboard shows P&L, cash position, recent transactions
5. Monthly chart renders with real imported data (Recharts)
6. Transaction list paginates (50/page), filters, and searches correctly
7. All amounts display as formatted currency from BigInt cents (never raw cents)
8. Transaction status badges with correct colors
9. Amount column: green for income, red for expense
10. "Uncategorized" transactions shown with yellow badge
11. Loading skeletons display while fetching
12. Transaction detail shows TransactionLines (double-entry view)
13. PUT /api/v1/transactions/:id updates correctly and audit logs the change
14. Entity summary endpoint matches PRD response shape exactly
15. `X-Confidentiality: RESTRICTED` header on all financial endpoints
16. `amounts_in: "cents"` and `confidential: true` in all financial JSON responses
17. Smooth, polished UI. No layout shifts, no janky transitions.
18. No TypeScript errors, no console errors

## What NOT To Build

- No categorization editing queue (Task 4 builds the review inbox)
- No reports pages (Task 5)
- No import UI (imports stay CLI)
- No invoice CRUD (Phase 2)
- No budget CRUD (Phase 2)
- No reconciliation (Phase 2)
- No natural language queries (Phase 2)
