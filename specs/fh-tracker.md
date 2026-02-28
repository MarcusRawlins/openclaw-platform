# Finance Hub — Master Build Tracker

> 🦞 Marcus Rawlins | Living document, updated after every task completion
> PRD: `/workspace/specs/finance-hub-prd.md`
> Review guide: `/workspace/specs/fh-review-guide.md`

## Review Pipeline

Brunel (Devstral) → Walt (95%+) → Marcus/Opus (99%+) → back to Brunel if fails

## Phase 1: Foundation ✅ COMPLETE

| Task | Description | Spec | Walt | Marcus | Status |
|------|-------------|------|------|--------|--------|
| 1 | Scaffolding + DB | fh-task1-scaffolding.md | 98.5% | 99% | ✅ Done |
| 2 | Import Pipeline (CSV) | fh-task2-import-pipeline.md | 96.1% | 99% | ✅ Done |
| 3 | Dashboard + Transaction UI | fh-task3-dashboard-ui.md | 96% | 99% | ✅ Done |
| 4 | Merchant Learning + Categorization | fh-task4-merchant-learning.md | 96% | 99% | ✅ Done |
| 5 | Reports + Tax Estimates | fh-task5-reports-tax.md | 98% | 99% | ✅ Done |

## Phase 2: Import & Intelligence 🔨 IN PROGRESS

| Task | Description | Spec | Walt | Marcus | Status |
|------|-------------|------|------|--------|--------|
| 6 | OFX/QFX Parser + Bank CSV Presets + Dedup | fh-task6-import-parsers.md | — | — | 🔨 Marcus building |
| 7 | Import Review Queue | fh-task7-review-queue.md | — | — | 📝 Spec ready |
| 8 | AI Auto-Categorization (Sonnet) | fh-task8-ai-categorization.md | — | — | 📝 Spec ready |
| 9 | Invoice Management | fh-task9-invoices.md | — | — | 📝 Spec ready |
| 10 | Recurring Rules + Budget + Period Toggle | fh-task10-budgets.md | — | — | 📝 Spec ready |
| 11 | Global Dashboard + Monthly Import Cron | fh-task11-global-dashboard.md | — | — | 📝 Spec ready |
| 12 | Receipt & Document Attachments | fh-task12-attachments.md | — | — | ⏳ Needs spec |

## Phase 3: Reporting & Tax 📝 SCOPED

| Task | Description | Spec | Walt | Marcus | Status |
|------|-------------|------|------|--------|--------|
| 13 | PDF/CSV Export + Report Polish | fh-task13-report-export.md | — | — | ⏳ Overview written |
| 14 | Reconciliation Workflow | fh-task14-reconciliation.md | — | — | ⏳ Overview written |
| 15 | Natural Language Queries (Sonnet) | fh-task15-nlp-queries.md | — | — | ⏳ Overview written |
| 16 | Anomaly Detection + Weekly Job | fh-task16-anomaly-detection.md | — | — | ⏳ Overview written |
| 17 | TOTP MFA + Security Hardening | fh-task17-mfa.md | — | — | ⏳ Overview written |

Phase overview: `/workspace/specs/fh-phase3-overview.md`

## Phase 4: API & Integration (not yet scoped)

| Task | Description | Spec | Walt | Marcus | Status |
|------|-------------|------|------|--------|--------|
| 18 | REST API + API Key Management | fh-task18-rest-api.md | — | — | 📝 Spec ready |
| 19 | AnselAI + R3 + MC Integrations | fh-task19-integrations.md | — | — | 📝 Spec ready |
| 20 | Stripe API Integration | fh-task20-stripe.md | — | — | 📝 Spec ready |
| 21 | Square/PayPal API Integration | fh-task21-square-paypal.md | — | — | 📝 Spec ready |
| 22 | Cash Flow Forecasting + Tax Optimization | fh-task22-forecasting-tax.md | — | — | 📝 Spec ready |
| 23 | QuickBooks Export + SQLite Migration | fh-task23-export-migration.md | — | — | 📝 Spec ready |

Phase overview: `/workspace/specs/fh-phase4-overview.md`

## Post-Build: Infrastructure Maintenance

| Task | Description | Status |
|------|-------------|--------|
| M-1 | Fix local LLM cron failures (Qwen3 4B context too small for agent prompts) | ⏳ After FH complete |
| M-2 | Clean up node_modules from workspace git repo (.gitignore fix) | ⏳ After FH complete |
| M-3 | Subagent announce fallback chain applied (Opus→Sonnet→Haiku→DeepSeek R1) | ✅ Immediate fix done |
| M-4 | OpenClaw feature request: raw passthrough announce mode (bypass LLM for subagent completions) | ⏳ After FH complete |

## Tyler Decisions Log

- **Period toggle:** Monthly / quarterly / annual across ALL views (shared component)
- **Invoices:** Generic branding now, entity-specific later (architecture supports it)
- **Import flow:** Cron-based. 10th reminder, 11th auto-import from `/Volumes/reeseai-memory/FINANCIALS/`
- **This topic (thread 127):** Exclusively Finance Hub

## Cron Jobs

| Name | Schedule | ID |
|------|----------|----|
| Remind Tyler to upload statements | 10th monthly 10am ET | 01996b45-b21f-4484-b0e4-9cb1152487f2 |
| Auto-import new files | 11th monthly 8am ET | 1a306922-dc07-4ecf-b335-5dcb3c19f6ff |

## Recovery Instructions

If Marcus restarts mid-build:
1. Read this file first
2. Check `subagents list` for any active Brunel/Walt sessions
3. Pick up where the tracker shows — write next spec or review completed work
4. Keep the pipeline full: Brunel should always have work queued
