# Finance Hub — Phase 3: Reporting & Tax

> 🦞 Marcus Rawlins | v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 6.6-6.8, 7, 9.2-9.3)
> Prereq: Phase 2 complete

---

## Phase 3 Goal

Production-grade reporting suite. Tyler's CPA can receive export-ready tax summaries. Reconciliation keeps the books tight. NLP queries let Tyler ask questions in plain English. Anomaly detection catches problems before Tyler does.

## What Phase 1 Already Built

Reports exist but are basic. Phase 1 delivered:
- P&L, balance sheet, cash flow, tax estimate pages + APIs
- Monthly summary materialization
- Basic report rendering in dark theme

Phase 3 upgrades these to CPA-grade output with PDF/CSV export, trend analysis, YTD comparisons, and proper reconciliation workflow.

## Task Breakdown

### Task 12: PDF/CSV Export + Report Polish
- PDF generation for all reports (P&L, balance sheet, cash flow, tax summary)
- CSV export for all tabular data
- Report header: entity name, period, generated date, "CONFIDENTIAL"
- Combined (cross-entity) versions of P&L and balance sheet
- Print-friendly styles
- YTD comparison: current year vs prior year side-by-side
- Revenue by client/project report (new)
- Expense by category trend (12-month rolling chart)
- Budget variance report (uses Task 10 data)
- **Acceptance:** Tyler downloads P&L PDF, sends to CPA. CPA doesn't ask follow-up questions.

### Task 13: Reconciliation Workflow
- Per PRD Section 6.7: upload statement or enter ending balance
- Show unreconciled transactions for account/period
- Checkbox matching with running difference display
- When balanced ($0 difference), mark period as reconciled
- Reconciled transactions locked from editing (require explicit unlock with audit trail)
- Reconciliation history log
- **Acceptance:** Tyler reconciles Chase checking for January. 47 transactions matched, $0 difference, period locked.

### Task 14: Receipt & Document Attachments
- Per PRD Section 6.8: upload images/PDFs to any transaction or invoice
- Storage: `/Volumes/reeseai-memory/data/finance-hub/attachments/{entity}/{year}/{month}/`
- Max 10MB per file, supports PDF, PNG, JPG, HEIC
- Thumbnail preview in transaction detail
- Gallery view for all attachments in a period
- Drag-and-drop upload on transaction edit
- **Acceptance:** Tyler photographs a receipt, uploads it to a transaction, sees thumbnail in transaction list.

### Task 15: Natural Language Queries (Sonnet)
- Per PRD Section 9.2: chat-style input in Finance Hub UI
- NL → SQL generation with safety constraints (SELECT only, entity-scoped)
- Formatted table + natural language summary response
- Query history (last 20 queries)
- Example queries shown on empty state
- Anthropic API only (hard security boundary)
- **Acceptance:** Tyler types "What did AnselAI spend on marketing in Q1?" and gets a table + summary.

### Task 16: Anomaly Detection + Weekly Job
- Per PRD Section 9.3: weekly batch job via Sonnet
- Detects: charges above category average, missing recurring transactions, unusual vendor activity, same-day duplicate charges
- Alert list on dashboard (AlertsPanel integration from Task 11)
- Weekly cron job (runs Sunday night)
- Alert dismissal (acknowledge without fixing)
- **Acceptance:** System flags a $500 Uber charge when Tyler's average is $25. Alert appears on dashboard.

### Task 17: TOTP MFA + Security Hardening
- TOTP-based MFA (Google Authenticator, Authy compatible)
- QR code enrollment flow
- Backup codes (10 single-use codes)
- MFA required for: login, viewing sensitive reports, API key management
- Session revocation UI
- Password change flow
- **Acceptance:** Tyler enables MFA, scans QR code, can log in with TOTP. Lost phone → uses backup code.

## Build Order

Tasks 12-13-14 can run sequentially (report suite).
Task 15 is independent (NLP queries).
Task 16 is independent (anomaly detection).
Task 17 is independent (security).

Recommended: 12 → 13 → 14, then 15 and 16 can parallelize, 17 last.

## Review Pipeline

Same as Phase 1-2: Brunel → Walt (95%+) → Marcus/Opus (99%+) → back to Brunel if fails.
