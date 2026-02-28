# Finance Hub — Review Guide (Walt + Marcus)

> This document defines exactly how to review each Finance Hub task.
> Walt reviews first (95% threshold). Marcus reviews second (99% threshold).

---

## Review Pipeline

```
Brunel completes task
  → sets status: "needs_review" in tasks.json
  → Walt is auto-triggered

Walt reviews
  → Score < 95%: NEEDS_REVISION → back to Brunel with specific fixes
  → Score >= 95%: PASS → Marcus reviews on Opus

Marcus reviews
  → Score < 99%: NEEDS_REVISION → back to Brunel with specific fixes
  → Score >= 99%: PASS → task is done
```

## Universal Checks (Every Task)

### Architecture Compliance
- [ ] Money stored as BigInt cents (never floats, never Decimal in storage)
- [ ] Double-entry: every Transaction has balanced TransactionLines (SUM debits = SUM credits)
- [ ] UUIDs for primary keys (not CUID, not auto-increment for domain models)
- [ ] snake_case DB columns via `@map()`, camelCase in Prisma/TypeScript
- [ ] Soft deletes (deletedAt) — no hard deletes of financial data
- [ ] Audit log captures all mutations (append-only, no updates/deletes on audit_log)
- [ ] `X-Confidentiality: RESTRICTED` header on all financial data endpoints
- [ ] `amounts_in: "cents"` and `confidential: true` in all financial JSON responses
- [ ] Tailscale/localhost IP check middleware active
- [ ] CORS limited to MC, AnselAI, self origins only
- [ ] 4-hour session lifetime (not 24h)
- [ ] No financial data passes through local LLM models

### Code Quality
- [ ] No TypeScript errors (`bun run type-check` or equivalent)
- [ ] No console errors in browser
- [ ] No hardcoded values that should be in config/env
- [ ] Error handling: never crashes, graceful degradation
- [ ] Prisma schema matches PRD Section 14 exactly

### Security
- [ ] Passwords bcrypt hashed (minimum 12 char on registration)
- [ ] JWT in httpOnly, Secure, SameSite=Strict cookie
- [ ] Encryption helpers use AES-256-GCM with env key
- [ ] No secrets in code or committed env files
- [ ] Rate limiting on API endpoints (100/min per API key, 300/min per user)

## Task-Specific Review Checklists

### Task 1: Scaffolding
- [ ] All 4 PostgreSQL schemas created (shared, anselai, r3studios, family)
- [ ] Prisma schema matches PRD Section 14 model-for-model
- [ ] MerchantRule in shared schema (per PRD Section 17)
- [ ] Seed creates: entities, admin user, chart of accounts (all 3 entity schemas), categories with tax mappings
- [ ] Credit card liability accounts: 2100-2104 (one per card)
- [ ] Schema replication strategy implemented (identical tables in all 3 entity schemas)
- [ ] NextAuth.js v5 with CredentialsProvider working
- [ ] Health endpoint pings database
- [ ] `.env.local.example` documents all vars

### Task 2: Import Pipeline
- [ ] All 5 card parsers handle real CSV files (not just test data)
- [ ] Amex parser handles both Format A (Gold) and Format B (Delta/Reserve with Receipt column)
- [ ] Amounts converted to BigInt cents correctly ($1,234.56 → 123456n)
- [ ] SHA-256 dedup hash matches PRD formula
- [ ] Double-import test: import same file twice, second run = 0 new
- [ ] TransactionLines created for every import (balanced)
- [ ] Correct account mapping: each card → its liability account (2100-2104)
- [ ] HoneyBook → AR (1100) debit, Revenue (4000) credit
- [ ] Expenses → Uncategorized (5999) debit, card liability credit
- [ ] Import status = PENDING
- [ ] --dry-run works without DB writes
- [ ] Audit log captures imports

### Task 3: Dashboard + Transaction UI
- [ ] Design tokens match spec exactly (colors, fonts, typography)
- [ ] Entity switcher works with URL routing
- [ ] Dashboard summary numbers calculated correctly from real data
- [ ] Monthly chart renders with Recharts
- [ ] Transaction table: pagination (50/page), all filters work, search works
- [ ] Transaction status badges with correct colors
- [ ] Amount formatting: BigInt cents → $X,XXX.XX, green/red coloring
- [ ] "Uncategorized" yellow badge on uncategorized transactions
- [ ] Transaction detail shows TransactionLines
- [ ] Entity summary API matches PRD Section 8 response shape exactly
- [ ] Loading skeletons present
- [ ] No layout shifts or visual jank

### Task 4: Merchant Learning
- [ ] MerchantRule CRUD works against shared schema
- [ ] Categorizing creates/updates rules with confidence 1.0, createdBy "tyler"
- [ ] "Apply to all from merchant" auto-categorizes matching transactions
- [ ] Import pipeline calls categorization engine after insert
- [ ] Auto-categorization for known merchants (>0.9 confidence)
- [ ] AI keyword suggestions for unknown merchants (0.7 confidence)
- [ ] Business allocation slider (0-100%) stores on rule
- [ ] Sidebar badge shows uncategorized count
- [ ] TransactionLines remap when category changes (uncategorized → correct account)
- [ ] Bulk categorize works
- [ ] usageCount increments on rule application

### Task 5: Reports + Tax
- [ ] P&L calculates from TransactionLines (not Transaction amounts)
- [ ] P&L comparison mode works (prior period + prior year)
- [ ] Balance sheet balances: Assets = Liabilities + Equity
- [ ] Retained Earnings calculated as cumulative net income
- [ ] Cash flow indirect method correct
- [ ] Consolidated view aggregates with per-entity columns
- [ ] SE tax: 15.3% on 92.35% of net SE income, SS cap applied
- [ ] Federal brackets: MFJ 2025 rates applied correctly
- [ ] NC state: 4.5% flat rate
- [ ] K-1 split: 50/50 Tyler/Alex
- [ ] Quarterly due dates correct for 2026
- [ ] CSV export works for each report
- [ ] Uncategorized Expense highlighted yellow on P&L if > $0
- [ ] MonthlySummary refreshed on data changes

## Scoring Rubric

| Category | Weight | Description |
|----------|--------|-------------|
| Spec Compliance | 40% | Does it implement everything in the spec? |
| Architecture | 20% | BigInt cents, double-entry, schema isolation, audit trail |
| Code Quality | 15% | Types, error handling, no console errors, clean code |
| Security | 15% | Auth, encryption, IP check, CORS, confidentiality headers |
| UX/Design | 10% | Matches design tokens, polished, responsive, no jank |

**95% (Walt pass threshold):** All spec requirements met, architecture compliant, minor polish issues OK.
**99% (Marcus pass threshold):** Everything above plus: pixel-perfect design compliance, edge cases handled, production-ready quality.
