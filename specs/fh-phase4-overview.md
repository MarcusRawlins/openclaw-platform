# Finance Hub — Phase 4: API & Integration

> 🦞 Marcus Rawlins | v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 8, 9.4, 9.5, 10, 15)
> Prereq: Phases 1-3 complete

---

## Phase 4 Goal

Finance Hub becomes the financial backbone for all Tyler's systems. AnselAI, R3 Studios, and Mission Control pull live financial data via API. External payment processors (Stripe, Square, PayPal) feed transactions in automatically. Cash flow forecasting and quarterly tax optimization run on schedule. QuickBooks export makes CPA handoffs painless.

## Task Breakdown

### Task 18: REST API + API Key Management
- Full REST API per PRD Section 8 (entity summary, transactions, P&L, budgets, invoices)
- API key CRUD with entity-level scoping (one key can only access permitted entities)
- Key prefix `fhk_` for log identification
- Rate limiting (100 req/min default, configurable per key)
- API key management UI (create, revoke, view usage, set entity permissions)
- Response format standardization (all amounts in cents, `confidential: true` flag)
- Error response format per PRD Section 8
- OpenAPI/Swagger spec auto-generation
- **Acceptance:** AnselAI can call `GET /api/v1/entities/anselai/summary` with a scoped key and get back accurate financial data. Key with R3 scope gets 403 on AnselAI endpoints.

### Task 19: AnselAI + R3 Studios + Mission Control Integrations
- AnselAI CRM: revenue summary widget component (calls Finance Hub API)
- R3 Studios: dashboard revenue widget
- Mission Control: Finance tile → iframe embed at `http://192.168.68.105:3300`
- iframe postMessage protocol: theme sync, navigation deep-links, auth state
- MC never proxies or caches financial data (window, not pipe)
- Each integration gets its own scoped API key (created in Task 18)
- Widget components: current month revenue, expenses, net income, outstanding AR
- **Acceptance:** MC dashboard shows Finance tile, clicking opens FH in iframe. AnselAI dashboard shows live revenue from FH API.

### Task 20: Stripe API Integration
- Connect to Stripe API (R3 Studios account primarily)
- Sync balance transactions (payouts, charges, refunds, fees)
- Map Stripe transaction types to Finance Hub categories
- Incremental sync (track last sync timestamp, only pull new transactions)
- Webhook endpoint for real-time transaction events
- Stripe Connect support (if R3 has sub-accounts)
- Auto-categorization of Stripe fees vs revenue
- Dedup against manually imported transactions
- **Acceptance:** R3 Studios' Stripe charges appear in Finance Hub automatically. Stripe processing fees correctly categorized.

### Task 21: Square + PayPal API Integration
- Square: sync payments for AnselAI (photography POS)
- PayPal: sync transactions for both entities
- Same pattern as Stripe: incremental sync, webhooks, auto-categorize, dedup
- Square OAuth flow for authorization
- PayPal Transaction Search API or webhooks
- Unified integration settings UI (connect/disconnect, sync status, last sync)
- **Acceptance:** AnselAI Square payments sync. PayPal transactions for both entities import correctly.

### Task 22: Cash Flow Forecasting + Tax Optimization
- Cash flow forecasting (PRD Section 9.5):
  - Sonnet-powered, 90-day projection per entity
  - Input: 12+ months history, recurring rules, outstanding invoices
  - Output: line chart with projected vs actual, confidence intervals
  - Dashboard widget with projection overlay
- Tax optimization (PRD Section 9.4):
  - Opus-powered quarterly job (Jan, Apr, Jul, Oct)
  - Review deductions, suggest recategorization for tax benefit
  - Estimate quarterly payment amounts
  - Flag audit risks (high deduction ratios)
  - Written summary stored as a report
  - Quarterly cron job
- **Acceptance:** Dashboard shows 90-day cash projection. Quarterly tax report suggests $200 in missed deductions.

### Task 23: QuickBooks Export + SQLite Migration
- QuickBooks IIF export for CPA handoff
- QuickBooks Online CSV import format
- Export UI: select entity, period, format → download
- Migration script from Brunel's SQLite prototype (PRD Section 15)
- Map prototype tables → Finance Hub schema
- Dedup migrated data against already-imported transactions
- One-time migration, idempotent (can run multiple times safely)
- **Acceptance:** Tyler exports Q1 for CPA in QuickBooks format. Prototype data migrated without duplicates.

## Build Order

18 → 19 (needs API keys from 18) → 20 → 21 → 22 → 23

Tasks 20, 21 are similar patterns (payment processor sync). 22 is independent AI work. 23 is cleanup/migration.

## Review Pipeline

Same as all phases: Brunel → Walt (95%+) → Marcus/Opus (99%+) → back to Brunel if fails.

## Tyler Decisions Needed

1. **Stripe account:** Do we have API keys? Which entity?
2. **Square account:** Is AnselAI using Square for POS?
3. **PayPal:** Which entities use PayPal?
4. **CPA format preference:** QuickBooks Desktop (IIF) or Online (CSV)?
5. **SQLite prototype:** Where is it? Still on disk?
