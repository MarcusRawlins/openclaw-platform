# Finance Hub — Phase 2: Import & Intelligence

> 🦞 Marcus Rawlins | v1.0 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Phase 2, Sections 5, 6, 9)
> Prereq: Phase 1 complete (all 5 tasks passing 99%+)

---

## Phase 2 Goal

Tyler can bulk-import bank statements (CSV now, PDF later), AI categorizes them, he reviews unknowns in a clean inbox, and the system learns his preferences. Invoicing and budgets come online.

## Task Breakdown

### Task 6: OFX/QFX Parser + Bank CSV Presets
- OFX/QFX parser (use `ofx-js` or write lightweight parser)
- Bank-specific CSV presets: Chase, Wells Fargo, generic
- Column-mapping UI for unknown CSV formats (drag-drop or dropdown mapping)
- File drop zone in UI (upload or point to `/Volumes/reeseai-memory/FINANCIALS/`)
- Dedup hash generation: `SHA-256(entity_id + date + amount + description_normalized + account_id)`
- Dedup heuristics: same amount ±1 day, same reference number
- **Acceptance:** Can import an OFX file and a Chase CSV, dedup catches obvious duplicates

### Task 7: Import Review Queue
- All imports land as PENDING status
- Review inbox UI: list view with filters (entity, date range, status, flagged duplicates)
- Bulk approve/reject/edit
- Individual transaction edit before approval (category, description, account)
- Duplicate linking (mark as duplicate, link to existing)
- Keyboard shortcuts for power review (j/k navigate, a approve, d duplicate, e edit)
- Count badges in sidebar
- **Acceptance:** Tyler can review 50+ pending transactions in under 2 minutes

### Task 8: AI Auto-Categorization (Sonnet)
- On import, run pending transactions through Sonnet for category suggestions
- Batch API calls (group 20-50 transactions per prompt to reduce cost)
- Confidence scoring: high (>90%) auto-approve if merchant rule exists, medium (70-90%) suggest, low (<70%) flag for review
- Integrate with existing MerchantRule system from Phase 1
- Learning loop: when Tyler approves/changes a category, update or create MerchantRule
- Category suggestion shown in review queue with confidence badge
- **Acceptance:** 80%+ of recurring merchants auto-categorized correctly after 1 month of usage

### Task 9: Invoice Management
- Create/edit/delete invoices (soft delete)
- Invoice form: client name, line items, tax, due date, notes
- Invoice statuses: DRAFT, SENT, PAID, OVERDUE, VOID
- Auto-link invoice payments to transactions (match by amount + date range)
- Invoice list view with status filters
- PDF generation (clean, branded template)
- Mark as paid (manual or auto-match)
- Overdue detection (daily job flags SENT invoices past due date)
- **Acceptance:** Tyler can create an invoice, it generates a PDF, and payment auto-matches when the Amex CSV comes in

### Task 10: Recurring Rules + Budget Tracking + Period Toggle
- Recurring transaction rules UI (create, edit, pause, delete)
- Frequency: weekly, biweekly, monthly, quarterly, yearly
- Auto-create or remind mode
- Daily background job to generate due transactions
- Budget creation per entity: monthly budget with category-level line items
- Budget vs actual view (bar chart per category, over/under indicators)
- Budget alerts: flag when >80% spent, highlight when over
- **Global period toggle component:** shared UI control (monthly / quarterly / annual) used across ALL views (dashboards, reports, budgets, P&L, transaction summaries). This is a shared component, not per-page.
- All data queries accept period parameter and aggregate accordingly
- **Acceptance:** Netflix subscription auto-generates monthly; budget shows Tyler he's 90% through his software budget; switching to quarterly view aggregates 3 months correctly

### Task 11: Global Dashboard + Monthly Import Cron
- Cross-entity dashboard: combined net worth, total revenue, total expenses
- Entity comparison cards (side by side P&L summaries)
- Recent activity feed (last 20 transactions across all entities)
- Period toggle integration (uses shared component from Task 10)
- **Monthly import cron (two-step):**
  - 10th of month: Marcus sends Tyler a Telegram reminder to upload previous month's statements to `/Volumes/reeseai-memory/FINANCIALS/`
  - 11th of month: auto-import job scans `/Volumes/reeseai-memory/FINANCIALS/` for new CSV and PDF files, parses, deduplicates, queues for review
- Import API endpoint: `POST /api/v1/import/scan` — triggers the scan programmatically (for cron or manual use)
- Import status in dashboard: "X files imported, Y transactions pending review"
- **Acceptance:** On the 11th, cron picks up 3 new Amex CSVs Tyler uploaded, imports them, dashboard shows "47 transactions pending review"

## Build Order

Tasks 6 → 7 → 8 → 9 → 10 → 11

Tasks 6-7-8 are the critical path (import pipeline). 9 and 10 are independent features. 11 ties it all together.

Brunel can potentially parallelize 9 and 10 after 8 is done, but sequential is safer for review quality.

## Review Pipeline

Same as Phase 1: Brunel → Walt (95%+) → Marcus/Opus (99%+) → back to Brunel if fails.

## Tyler's Decisions (Resolved 2026-02-27)

1. **File watcher → Cron + auto-import flow:**
   - 10th of each month: cron reminder to Tyler to upload all docs from previous month to `/Volumes/reeseai-memory/FINANCIALS/`
   - 11th of each month: auto-import cron runs, processes all new CSV and PDF files, queues for review
2. **Budget/reporting periods:** Toggle between monthly, quarterly, and annual views. Applies to ALL data views (dashboards, reports, budgets, P&L, etc.)
3. **Invoice branding:** Generic for now, but architecture must support per-entity branding (logo, colors, footer). Build the template with entity-aware slots so it's a config change later, not a rebuild.
