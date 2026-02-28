# Finance Hub — Product Requirements Document

> 🦞 Marcus Rawlins, Chief of Staff | v1.0 | 2026-02-27
> Status: **DRAFT — Awaiting Tyler Review**

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Data Model](#3-data-model)
4. [Security](#4-security)
5. [Import Pipelines](#5-import-pipelines)
6. [Core Features](#6-core-features)
7. [Reporting](#7-reporting)
8. [API Design](#8-api-design)
9. [AI Integration](#9-ai-integration)
10. [Development Phases](#10-development-phases)
11. [Tech Stack](#11-tech-stack)
12. [Confidentiality Rules](#12-confidentiality-rules)
13. [Open Questions for Tyler](#13-open-questions-for-tyler)
14. [Prisma Schema Draft](#14-prisma-schema-draft)
15. [Migration from Prototype](#15-migration-from-prototype)

---

## 1. Overview

### Problem

Financial data is scattered across bank accounts, payment processors, spreadsheets, and Brunel's SQLite prototype. There's no single source of truth for the three entities Tyler operates: AnselAI (photography), R3 Studios (SaaS/dev), and Reese Family (personal). Tax time is painful. Cross-entity visibility is nonexistent.

### Solution

**Finance Hub** — a standalone web application that serves as the centralized financial system for all three entities. It provides double-entry bookkeeping, dashboards, reporting, invoicing, tax estimation, and an API layer so AnselAI and R3 Studios can pull their own financial data into their respective dashboards.

### Entities

| Entity | Type | Revenue Sources | Key Expenses |
|--------|------|----------------|--------------|
| **AnselAI (By The Reeses)** | LLC / Photography | Wedding bookings, portrait sessions | Gear, travel, software, marketing |
| **R3 Studios** | LLC / SaaS & Dev | Client projects, SaaS subscriptions | Hosting, tools, contractors |
| **Reese Family** | Personal | W-2/1099 income, investments | Household, insurance, taxes, savings |

### Success Criteria

- Tyler can see a consolidated financial picture in < 5 seconds
- Each entity's P&L is accurate to the penny
- Quarterly tax estimates are generated automatically
- AnselAI CRM can display its own revenue/expense summary via API
- Zero financial data leaks to group chats or local LLMs

---

## 2. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────┐
│              Mission Control (:3100)             │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐ │
│  │ AnselAI   │  │ R3 Studios│  │ Finance Hub │ │
│  │ Widget    │  │ Widget    │  │ (iframe)    │ │
│  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘ │
└────────┼──────────────┼────────────────┼────────┘
         │              │                │
         ▼              ▼                ▼
┌────────────────────────────────────────────────┐
│           Finance Hub App (:3300)               │
│  Next.js 15 + App Router + Bun                 │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ UI Layer │ │ API Layer│ │ Import Engine  │ │
│  └──────────┘ └────┬─────┘ └────────────────┘ │
│                     │                           │
│              ┌──────▼──────┐                    │
│              │ Prisma ORM  │                    │
│              └──────┬──────┘                    │
└─────────────────────┼──────────────────────────┘
                      │
              ┌───────▼───────┐
              │  PostgreSQL   │
              │  finance_hub  │
              │ ┌───────────┐ │
              │ │ anselai   │ │
              │ │ r3studios │ │
              │ │ family    │ │
              │ │ shared    │ │
              │ └───────────┘ │
              └───────────────┘
```

### Key Decisions

| Decision | Choice | Justification |
|----------|--------|---------------|
| Standalone app | Yes | Financial data requires isolated auth, audit, and deployment lifecycle. Coupling to MC or AnselAI creates security risk. |
| Port | 3300 | Follows convention: MC=3100, AnselAI=3200, Finance Hub=3300 |
| Database | Separate PostgreSQL database `finance_hub` | Legal separation of entity data. SQLite cannot handle concurrent API access or schema-level isolation. |
| MC Integration | iframe with postMessage | Finance Hub controls its own auth. MC embeds it but never touches financial data directly. Link fallback for mobile. |
| Separate schemas | One schema per entity + shared schema | Enables potential future legal separation (e.g., if entities need separate books for an audit). Shared schema holds cross-entity config. |

### Integration with Mission Control

Mission Control gets a "Finance" tile on the dashboard. Clicking it opens Finance Hub in an iframe at `http://192.168.68.105:3300`. The iframe communicates via `postMessage` for:
- Theme sync (dark/light mode)
- Navigation deep-links (e.g., open AnselAI P&L directly)
- Auth state indication (logged in / session expired)

MC never proxies or caches financial data. It's a window, not a pipe.

### Integration with AnselAI / R3 Studios

Both apps consume Finance Hub's REST API (Section 8) using scoped API keys. AnselAI's CRM dashboard can show a revenue summary widget by calling `GET /api/entities/anselai/summary`. R3 Studios does the same. Neither app can access the other's data or the family entity.

---

## 3. Data Model

### Design Principles

- **Double-entry bookkeeping**: Every transaction has balanced debits and credits. This is non-negotiable for accurate financial reporting.
- **Multi-entity isolation**: Data is schema-separated. Cross-entity queries go through the shared schema's views.
- **Immutable audit trail**: Transactions are soft-deleted, never hard-deleted. Every mutation is logged.
- **Denormalized summaries**: Pre-computed monthly summaries for dashboard speed. Recalculated on transaction changes.

### Chart of Accounts Structure

Standard account types following GAAP conventions:

| Type | Normal Balance | Examples |
|------|---------------|----------|
| `ASSET` | Debit | Checking, Savings, Accounts Receivable, Equipment |
| `LIABILITY` | Credit | Credit Cards, Accounts Payable, Loans |
| `EQUITY` | Credit | Owner's Equity, Retained Earnings |
| `REVENUE` | Credit | Photography Income, SaaS Revenue, Consulting |
| `EXPENSE` | Debit | Gear, Travel, Hosting, Marketing, Contractors |

Each entity gets its own chart of accounts, pre-seeded with sensible defaults but fully customizable.

### Entity-Relationship Overview

```
Entity (1) ──── (N) Account
Entity (1) ──── (N) Transaction
Transaction (1) ──── (N) TransactionLine  (debit/credit entries)
Transaction (1) ──── (N) Tag
Transaction (N) ──── (1) Category
Account (1) ──── (N) TransactionLine
Entity (1) ──── (N) Invoice
Invoice (1) ──── (N) InvoiceLine
Entity (1) ──── (N) Budget
Budget (1) ──── (N) BudgetLine
Entity (1) ──── (N) RecurringRule
Transaction (0..1) ── (N) Attachment
```

### Core Tables (per-entity schema)

**accounts** — Bank accounts, credit cards, AR/AP, equity accounts.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR(255) | "Chase Checking", "Stripe" |
| account_type | ENUM | ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE |
| sub_type | VARCHAR(100) | "checking", "credit_card", "accounts_receivable" |
| institution | VARCHAR(255) | Bank/processor name |
| account_number_enc | BYTEA | AES-256 encrypted, last 4 stored plaintext |
| account_number_last4 | VARCHAR(4) | For display |
| currency | VARCHAR(3) | Default "USD" |
| is_active | BOOLEAN | Soft disable |
| opening_balance | BIGINT | Cents. Set at account creation. |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**transactions** — The header record for each financial event.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| date | DATE | Transaction date |
| description | VARCHAR(500) | |
| reference | VARCHAR(255) | Check #, confirmation #, import batch ID |
| status | ENUM | PENDING, CLEARED, RECONCILED, VOID |
| category_id | UUID | FK → categories |
| import_source | VARCHAR(100) | "csv:chase", "stripe:webhook", "manual" |
| import_hash | VARCHAR(64) | SHA-256 for deduplication |
| is_recurring_instance | BOOLEAN | Generated from a recurring rule |
| recurring_rule_id | UUID | FK → recurring_rules (nullable) |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ | Soft delete |

**transaction_lines** — Individual debit/credit entries (double-entry).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| transaction_id | UUID | FK → transactions |
| account_id | UUID | FK → accounts |
| amount | BIGINT | Always positive, in cents |
| type | ENUM | DEBIT, CREDIT |
| created_at | TIMESTAMPTZ | |

> **Invariant**: For every transaction, `SUM(debits) = SUM(credits)`. Enforced at the application layer and verified by a nightly reconciliation job.

**categories** — Hierarchical categorization.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| parent_id | UUID | FK → categories (nullable, for subcategories) |
| name | VARCHAR(255) | "Marketing", "Travel > Flights" |
| tax_category | VARCHAR(100) | IRS category mapping: "advertising", "travel", "meals" |
| is_tax_deductible | BOOLEAN | |
| is_system | BOOLEAN | Prevent deletion of system categories |

**tags** — Flexible labeling (client name, project, etc.).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR(100) | "wedding:johnson", "project:rehive" |

**transaction_tags** — Join table.

**invoices** — Both sent (AR) and received (AP).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| direction | ENUM | SENT, RECEIVED |
| counterparty | VARCHAR(255) | Client or vendor name |
| counterparty_email | VARCHAR(255) | |
| invoice_number | VARCHAR(50) | Auto-generated or manual |
| issue_date | DATE | |
| due_date | DATE | |
| status | ENUM | DRAFT, SENT, VIEWED, PAID, OVERDUE, CANCELLED |
| subtotal | BIGINT | Cents |
| tax_amount | BIGINT | Cents |
| total | BIGINT | Cents |
| paid_amount | BIGINT | Cents (partial payments supported) |
| paid_date | DATE | |
| linked_transaction_id | UUID | FK → transactions (when payment recorded) |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**invoice_lines**

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| invoice_id | UUID | FK |
| description | VARCHAR(500) | |
| quantity | DECIMAL(10,2) | |
| unit_price | BIGINT | Cents |
| amount | BIGINT | Cents |

**recurring_rules** — Templates for auto-generating transactions.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| description | VARCHAR(500) | |
| amount | BIGINT | Cents |
| frequency | ENUM | DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, ANNUAL |
| start_date | DATE | |
| end_date | DATE | Nullable |
| next_due | DATE | |
| account_id | UUID | FK |
| category_id | UUID | FK |
| is_active | BOOLEAN | |
| auto_create | BOOLEAN | If true, auto-generates. If false, creates reminder only. |

**budgets** — Per-entity budget periods.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR(255) | "Q1 2026 Budget" |
| period_start | DATE | |
| period_end | DATE | |

**budget_lines** — Budget amounts per category.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| budget_id | UUID | FK |
| category_id | UUID | FK |
| planned_amount | BIGINT | Cents |

**attachments** — Receipts, documents.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| transaction_id | UUID | FK (nullable) |
| invoice_id | UUID | FK (nullable) |
| filename | VARCHAR(255) | |
| mime_type | VARCHAR(100) | |
| file_path | VARCHAR(500) | Local filesystem path |
| file_size | INTEGER | Bytes |
| created_at | TIMESTAMPTZ | |

### Shared Schema Tables

**entities** — The three business units.

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) | PK: "anselai", "r3studios", "family" |
| display_name | VARCHAR(255) | |
| type | ENUM | BUSINESS, PERSONAL |
| schema_name | VARCHAR(50) | PostgreSQL schema name |
| is_active | BOOLEAN | |

**users** — Finance Hub users (Tyler, potentially a bookkeeper later).

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| email | VARCHAR(255) | |
| password_hash | VARCHAR(255) | bcrypt |
| name | VARCHAR(255) | |
| role | ENUM | OWNER, ADMIN, VIEWER |
| is_active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |

**api_keys** — For consuming apps.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| app_name | VARCHAR(100) | "anselai_crm", "r3_dashboard" |
| key_hash | VARCHAR(255) | SHA-256 of the key |
| key_prefix | VARCHAR(8) | First 8 chars for identification |
| entity_id | VARCHAR(50) | FK → entities. Scoped access. |
| permissions | JSONB | `["read:transactions", "read:summary"]` |
| is_active | BOOLEAN | |
| last_used_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**audit_log** — Every operation, no exceptions.

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL | PK |
| timestamp | TIMESTAMPTZ | |
| user_id | UUID | FK (nullable for API key access) |
| api_key_id | UUID | FK (nullable for user access) |
| entity_id | VARCHAR(50) | Which entity's data |
| action | VARCHAR(50) | CREATE, READ, UPDATE, DELETE, EXPORT, LOGIN |
| resource_type | VARCHAR(50) | "transaction", "invoice", "account" |
| resource_id | VARCHAR(255) | |
| details | JSONB | Changed fields, query params, etc. |
| ip_address | INET | |
| user_agent | VARCHAR(500) | |

> Audit log is append-only. No UPDATE or DELETE permissions on this table, ever.

### Money Handling

All monetary values stored as **BIGINT in cents** (or smallest currency unit). No floating point, no DECIMAL for storage. Display formatting happens at the UI layer.

**Justification**: Floating point arithmetic causes rounding errors in financial calculations. Integer cents are precise and fast.

---

## 4. Security

### Threat Model

Finance Hub contains the most sensitive data in the entire system. A breach exposes bank accounts, revenue figures, tax data, and potentially SSNs. The attack surface includes:

1. Unauthorized network access (mitigated by Tailscale-only)
2. Agent/LLM data exfiltration via group chats (mitigated by confidentiality rules)
3. Local LLM model training on financial data (mitigated by API routing rules)
4. Session hijacking (mitigated by short timeouts + re-auth)
5. Cross-entity data leakage (mitigated by schema separation)

### Authentication

| Aspect | Implementation |
|--------|---------------|
| Provider | NextAuth.js with CredentialsProvider |
| Storage | JWT stored in httpOnly, Secure, SameSite=Strict cookie |
| Password | bcrypt, minimum 12 characters |
| Session lifetime | 4 hours, sliding window |
| Sensitive operations | Re-auth required for: export, bulk delete, account linking, API key management |
| MFA | Not in Phase 1. Add TOTP in Phase 2. |

**Why dedicated auth?** MC and AnselAI have different security postures. Finance Hub auth must be independent so a compromised MC session cannot access financial data.

### Encryption at Rest

| Field | Method |
|-------|--------|
| Account numbers | AES-256-GCM, key from env `FINANCE_ENCRYPTION_KEY` |
| SSN (if ever stored) | AES-256-GCM, separate key `FINANCE_PII_KEY` |
| Transaction amounts | NOT encrypted (needed for queries/aggregation). Protected by access control. |
| Attachments | Stored on local filesystem (Tailscale-only network). Encrypted at OS level via FileVault. |

**Justification for not encrypting amounts**: Encrypting amounts would prevent SUM/AVG/GROUP BY queries, making all reporting impossible without decrypting entire datasets. Access control + network isolation + audit logging is the appropriate mitigation.

### Network Security

- **IP Allowlist**: Finance Hub binds to Tailscale interface only (`100.x.x.x`) or `192.168.68.x` (local network). No public exposure.
- **CORS**: Only allow origins from MC (`192.168.68.105:3100`), AnselAI (`:3200`), and Finance Hub itself (`:3300`).
- **Rate limiting**: 100 req/min per API key, 300 req/min per authenticated user.

### Schema Isolation

```sql
CREATE SCHEMA shared;    -- entities, users, api_keys, audit_log
CREATE SCHEMA anselai;   -- AnselAI financial data
CREATE SCHEMA r3studios; -- R3 Studios financial data
CREATE SCHEMA family;    -- Reese Family financial data
```

Each entity's Prisma client connects with a schema-scoped role:
```sql
CREATE ROLE finance_anselai;
GRANT USAGE ON SCHEMA anselai TO finance_anselai;
GRANT ALL ON ALL TABLES IN SCHEMA anselai TO finance_anselai;
-- No access to r3studios or family schemas
```

The application layer uses the entity context from the authenticated session to select the correct schema. There is no way to query across schemas without explicitly using the shared schema's cross-entity views (which require OWNER role).

### Audit Trail

Every API call and UI action that touches data writes to `shared.audit_log`. This includes:
- All CRUD operations
- All report generations
- All data exports
- All login attempts (success and failure)
- All API key usage

Audit log retention: **7 years** (IRS record-keeping requirement).

### Agent & LLM Rules

| Rule | Enforcement |
|------|-------------|
| No financial data in group chats | Agent confidentiality rules (Section 12) + Marcus's SOUL.md |
| No local LLM processing | Finance Hub AI features call Anthropic API directly. No data passes through LM Studio or any local model. |
| API responses include `confidential: true` | Consuming apps must respect this flag |
| Marcus never speaks dollar amounts in group context | Hardcoded in agent behavior rules |

---

## 5. Import Pipelines

### Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Raw File     │────▶│ Parser       │────▶│ Transformer  │
│ (CSV/OFX/QBO)│     │ (format-     │     │ (normalize,  │
│              │     │  specific)   │     │  deduplicate)│
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                           ┌──────▼───────┐
                                           │ Review Queue  │
                                           │ (pending      │
                                           │  approval)    │
                                           └──────┬───────┘
                                                  │ approve
                                           ┌──────▼───────┐
                                           │ Ledger Write  │
                                           │ (transaction  │
                                           │  + lines)     │
                                           └──────────────┘
```

### Supported Formats

| Format | Source | Parser |
|--------|--------|--------|
| CSV | Chase, Wells Fargo, generic bank exports | Column-mapping UI. Presets for major banks. |
| OFX/QFX | Most US banks | Standard OFX parser library |
| QBO | QuickBooks Desktop/Online export | IIF/QBO parser |
| Stripe | R3 Studios | Stripe API (balance transactions endpoint) |
| Square | AnselAI | Square API (payments endpoint) |
| PayPal | Both | PayPal transaction CSV or API |
| Manual | All | Form entry in UI |

### Deduplication Logic

Every imported transaction generates a **dedup hash**:
```
SHA-256(entity_id + date + amount + description_normalized + account_id)
```

Before writing, the import engine checks for existing transactions with the same hash. Matches are flagged for review rather than silently skipped (user might have legitimate duplicate transactions like two identical subscription charges).

Additional heuristics:
- Same amount ± 1 day from same account → flag as potential duplicate
- Same reference/confirmation number → definite duplicate

### Import Review Queue

All imported transactions land in a **review queue** (status: PENDING). The user can:
- Approve individually or in bulk
- Edit category/description before approval
- Mark as duplicate (links to existing transaction)
- Reject (discards)

AI auto-categorization runs on pending transactions to suggest categories before review.

### Recurring Transaction Engine

A background job runs daily (or on-demand):
1. Query all active `recurring_rules` where `next_due <= today`
2. For `auto_create = true`: generate the transaction, set status CLEARED
3. For `auto_create = false`: create a notification/reminder
4. Advance `next_due` based on `frequency`

---

## 6. Core Features

### 6.1 Dashboards

**Per-Entity Dashboard** shows:
- Current month P&L (revenue vs expenses bar chart)
- Cash position (sum of all asset accounts minus liabilities)
- Recent transactions (last 20)
- Outstanding invoices (AR aging)
- Budget vs actual (current period)
- Upcoming recurring transactions (next 7 days)

**Global Dashboard** shows:
- Combined net worth across all entities
- Per-entity P&L comparison (side-by-side)
- Cash flow trend (12-month line chart)
- Alerts (overdue invoices, unusual charges, missed recurring)

**Access**: Global dashboard requires OWNER role. Entity dashboards are available to anyone with entity access.

### 6.2 Transaction Management

- **List view**: Filterable by date range, account, category, tag, amount range, status
- **Search**: Full-text search on description, notes, reference
- **Bulk actions**: Categorize, tag, approve, void
- **Split transactions**: One bank charge → multiple category allocations (e.g., Costco receipt with business and personal items)
- **Transfer tracking**: Move money between accounts (creates balanced debit/credit automatically)

### 6.3 Auto-Categorization

When a transaction is created or imported:
1. Check rule-based matches first (vendor name → category mapping, user-defined rules)
2. If no rule match, call Sonnet with the transaction description + historical patterns
3. Suggest top 3 categories with confidence scores
4. High-confidence matches (>90%) auto-apply; others queue for review

The system learns from user corrections: if the user recategorizes a Sonnet suggestion, that correction feeds into future rule-based matching.

### 6.4 Invoice Management

- **Create**: Line-item invoice with entity branding
- **Send**: Email via configured SMTP (or download PDF for manual send)
- **Track**: Status progression (Draft → Sent → Viewed → Paid)
- **Link to transaction**: When payment arrives, link invoice to the deposit transaction
- **Aging report**: 30/60/90 day AR aging
- **Received invoices**: Track bills/AP with due dates and payment status

### 6.5 Budget Tracking

- Create budgets per entity per period (monthly or quarterly)
- Set planned amounts per category
- Dashboard shows actual vs planned with variance
- Alerts when a category exceeds 80% or 100% of budget
- Rollover option: unused budget carries to next period (configurable)

### 6.6 Tax Features

- **Tax category mapping**: Each category maps to an IRS tax category
- **Quarterly estimates**: Based on YTD income and historical effective rate
- **Deduction tracking**: Flag deductible expenses, running total per category
- **Tax summary report**: Exportable for CPA / tax software
- **Self-employment tax**: Automatic SE tax calculation for business entities
- **Estimated payment tracking**: Record quarterly payments, compare to estimates

### 6.7 Reconciliation

1. Upload bank statement (CSV or enter ending balance manually)
2. System shows unreconciled transactions for the account/period
3. User checks off matching transactions
4. Difference displayed in real-time
5. When balanced, mark period as reconciled
6. Reconciled transactions are locked from editing (require explicit unlock)

### 6.8 Receipt & Document Attachment

- Upload images/PDFs to any transaction or invoice
- Stored on local filesystem: `/Volumes/reeseai-memory/data/finance-hub/attachments/{entity}/{year}/{month}/`
- Filename: `{transaction_id}_{original_name}`
- Max file size: 10MB
- Supported formats: PDF, PNG, JPG, HEIC

---

## 7. Reporting

### Report Catalog

| Report | Periods | Scope | Export Formats |
|--------|---------|-------|---------------|
| Profit & Loss | Monthly, Quarterly, Annual | Per entity, Combined | PDF, CSV |
| Balance Sheet | Point-in-time | Per entity, Combined | PDF, CSV |
| Cash Flow Statement | Monthly, Quarterly, Annual | Per entity | PDF, CSV |
| Tax Summary | Quarterly, Annual | Per entity | PDF, CSV |
| Revenue by Client | Any date range | Per entity | CSV |
| Revenue by Project | Any date range | Per entity | CSV |
| Expense by Category | Any date range | Per entity | CSV |
| Expense Trends | 12-month rolling | Per entity | Chart + CSV |
| Budget Variance | Budget period | Per entity | PDF, CSV |
| YTD Comparison | Current vs prior year | Per entity | Chart + CSV |
| Accounts Receivable Aging | Point-in-time | Per entity | PDF |
| Transaction Detail | Any date range | Per entity | CSV |

### Report Generation

Reports are generated on-demand (not pre-computed). For dashboards, monthly summaries are materialized into a `monthly_summaries` table and refreshed when transactions change.

### Materialized Summary Table

```sql
CREATE TABLE monthly_summaries (
  id UUID PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  account_id UUID REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  total_debit BIGINT DEFAULT 0,
  total_credit BIGINT DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ
);
```

Refreshed by a trigger or background job whenever transactions are created/updated/deleted.

---

## 8. API Design

### Base URL

```
http://192.168.68.105:3300/api/v1
```

### Authentication

All API requests require a header:
```
Authorization: Bearer fhk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

API keys are prefixed `fhk_` (Finance Hub Key) for easy identification in logs.

### Endpoints

#### Entity Summary
```
GET /api/v1/entities/:entityId/summary
```
Returns: current month revenue, expenses, net income, cash position, outstanding AR.

Response:
```json
{
  "entity": "anselai",
  "period": "2026-02",
  "revenue": 850000,
  "expenses": 312500,
  "net_income": 537500,
  "cash_position": 2450000,
  "outstanding_ar": 350000,
  "currency": "USD",
  "amounts_in": "cents",
  "confidential": true
}
```

#### Transactions
```
GET /api/v1/entities/:entityId/transactions
  ?from=2026-01-01
  &to=2026-01-31
  &account=uuid
  &category=uuid
  &status=CLEARED
  &search=keyword
  &page=1
  &limit=50
```

```
POST /api/v1/transactions
Content-Type: application/json

{
  "entity_id": "anselai",
  "date": "2026-02-15",
  "description": "Wedding booking deposit - Johnson",
  "lines": [
    { "account_id": "uuid-checking", "amount": 250000, "type": "DEBIT" },
    { "account_id": "uuid-revenue", "amount": 250000, "type": "CREDIT" }
  ],
  "category_id": "uuid-bookings",
  "tags": ["wedding:johnson"]
}
```

#### Profit & Loss
```
GET /api/v1/entities/:entityId/pnl
  ?from=2026-01-01
  &to=2026-03-31
```

Returns hierarchical P&L with revenue and expense categories, subtotals, and net income.

#### Budget
```
GET /api/v1/entities/:entityId/budgets
  ?period=2026-Q1

GET /api/v1/entities/:entityId/budgets/:budgetId
```

Returns budget lines with planned vs actual amounts.

#### Invoices
```
GET /api/v1/entities/:entityId/invoices
  ?status=SENT
  &direction=SENT

POST /api/v1/entities/:entityId/invoices
```

### Error Responses

Standard HTTP status codes with body:
```json
{
  "error": "ENTITY_ACCESS_DENIED",
  "message": "API key does not have access to entity 'family'",
  "status": 403
}
```

### Rate Limiting

Response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709078400
```

---

## 9. AI Integration

### Guiding Principle

All AI processing uses **Anthropic API (Sonnet or Opus) exclusively**. Financial data never passes through local LLM models (LM Studio, Ollama, etc.). This is a hard security boundary.

### Features

#### 9.1 Transaction Categorization

- **Trigger**: New transaction created or imported
- **Model**: Sonnet (fast, cost-effective for classification)
- **Input**: Transaction description, amount, account, date, plus last 50 similar transactions with their categories
- **Output**: Top 3 category suggestions with confidence scores
- **Auto-apply threshold**: 90% confidence
- **Learning**: User corrections stored as rules for future rule-based matching (reducing AI calls over time)

#### 9.2 Natural Language Queries

- **Interface**: Chat-style input in Finance Hub UI
- **Model**: Sonnet
- **Examples**:
  - "What did AnselAI spend on marketing in Q1?"
  - "Show me all unreconciled transactions for Chase checking"
  - "How does R3 revenue this quarter compare to last?"
- **Implementation**: NL → SQL generation with safety constraints (SELECT only, entity-scoped, no schema modifications)
- **Output**: Formatted table + natural language summary

#### 9.3 Anomaly Detection

- **Frequency**: Weekly batch job
- **Model**: Sonnet
- **Detects**:
  - Charges significantly above category average
  - Missing expected recurring transactions
  - Unusual vendor activity
  - Duplicate charges (same vendor, same amount, same day)
- **Output**: Alert list in dashboard, optional notification to Tyler

#### 9.4 Tax Optimization

- **Frequency**: Quarterly (Jan, Apr, Jul, Oct)
- **Model**: Opus (complex reasoning)
- **Analysis**:
  - Review categorized deductions vs common missed deductions
  - Suggest recategorization for tax benefit
  - Estimate quarterly payment amounts
  - Flag potential audit risks (unusually high deduction ratios)
- **Output**: Written summary stored as a report

#### 9.5 Cash Flow Forecasting

- **Model**: Sonnet
- **Input**: Historical transactions (12+ months), recurring rules, outstanding invoices
- **Output**: 90-day cash flow projection per entity with confidence intervals
- **Displayed**: Line chart on dashboard with projected vs actual overlay

---

## 10. Development Phases

### Phase 1: Foundation (Weeks 1–3)

**Goal**: Working app with core data model, manual data entry, and basic dashboard.

- [ ] Project scaffolding (Next.js 15, Bun, Prisma, PostgreSQL)
- [ ] Database schema creation (all four schemas)
- [ ] Authentication (NextAuth.js, credentials provider)
- [ ] Entity management (hardcoded 3 entities)
- [ ] Chart of accounts CRUD (pre-seeded per entity)
- [ ] Account management (add/edit bank accounts)
- [ ] Manual transaction entry (with double-entry validation)
- [ ] Transaction list with basic filters
- [ ] Basic per-entity dashboard (current month P&L, cash position)
- [ ] CSV import (generic column mapper)
- [ ] Audit log middleware
- [ ] Tailscale-only network binding

**Deliverable**: Tyler can manually enter transactions, import CSVs, and see a basic dashboard.

### Phase 2: Import & Intelligence (Weeks 4–6)

- [ ] OFX/QFX import parser
- [ ] Bank-specific CSV presets (Chase, Wells Fargo)
- [ ] Import review queue
- [ ] Deduplication engine
- [ ] AI auto-categorization (Sonnet integration)
- [ ] Rule-based categorization (vendor → category mappings)
- [ ] Invoice creation and management
- [ ] Recurring transaction rules and auto-generation
- [ ] Receipt/document upload
- [ ] Budget creation and tracking
- [ ] Global dashboard (all entities)

**Deliverable**: Tyler can bulk-import bank statements, AI categorizes them, and he can create/track invoices.

### Phase 3: Reporting & Tax (Weeks 7–9)

- [ ] P&L report (monthly/quarterly/annual)
- [ ] Balance sheet
- [ ] Cash flow statement
- [ ] Tax summary and quarterly estimates
- [ ] Budget variance report
- [ ] YTD comparisons
- [ ] Expense trends visualization
- [ ] Revenue by client/project
- [ ] Reconciliation workflow
- [ ] Natural language query interface
- [ ] Anomaly detection (weekly job)
- [ ] PDF export for reports
- [ ] TOTP MFA

**Deliverable**: Full reporting suite. Tyler's CPA can receive tax summaries. Reconciliation is functional.

### Phase 4: API & Integration (Weeks 10–12)

- [ ] REST API implementation (all endpoints from Section 8)
- [ ] API key management UI
- [ ] AnselAI CRM integration (revenue widget)
- [ ] R3 Studios dashboard integration
- [ ] Mission Control iframe embed
- [ ] Stripe API integration
- [ ] Square/PayPal API integration
- [ ] Cash flow forecasting
- [ ] Tax optimization quarterly job
- [ ] QuickBooks export import
- [ ] Migration script from SQLite prototype

**Deliverable**: Full system operational. AnselAI and R3 Studios pull live financial data. All integrations connected.

---

## 11. Tech Stack

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| Runtime | Bun | Latest | Consistent with AnselAI/MC. Fast startup, native TypeScript. |
| Framework | Next.js | 15+ | App Router for server components. Consistent with other apps. |
| ORM | Prisma | 6+ | Type-safe queries, schema migrations, multi-schema support. |
| Database | PostgreSQL | 16+ | ACID compliance, schema isolation, JSON support, mature. |
| CSS | Tailwind CSS | 4+ | Consistent with other apps. Utility-first, fast iteration. |
| Auth | NextAuth.js | 5+ | Proven, supports credentials provider, JWT sessions. |
| Charts | Recharts | 2+ | React-native, composable, good for financial charts. |
| AI | Anthropic API | Claude 3.5+ | Sonnet for classification/queries, Opus for complex analysis. |
| File Storage | Local FS | — | `/Volumes/reeseai-memory/data/finance-hub/`. No cloud dependency. |
| PDF | @react-pdf/renderer | Latest | Invoice and report PDF generation. |

### Project Structure

```
finance-hub/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx              # Global dashboard
│   │   │   ├── [entity]/
│   │   │   │   ├── page.tsx          # Entity dashboard
│   │   │   │   ├── transactions/
│   │   │   │   ├── invoices/
│   │   │   │   ├── accounts/
│   │   │   │   ├── budgets/
│   │   │   │   ├── reports/
│   │   │   │   └── reconcile/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── entities/
│   │   │   │   ├── transactions/
│   │   │   │   └── invoices/
│   │   │   ├── auth/
│   │   │   └── import/
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── db.ts                     # Prisma client factory (schema-aware)
│   │   ├── auth.ts                   # NextAuth config
│   │   ├── encryption.ts             # AES-256-GCM helpers
│   │   ├── audit.ts                  # Audit log middleware
│   │   ├── ai.ts                     # Anthropic API client
│   │   └── import/
│   │       ├── csv.ts
│   │       ├── ofx.ts
│   │       └── dedup.ts
│   ├── components/
│   │   ├── charts/
│   │   ├── forms/
│   │   ├── tables/
│   │   └── ui/
│   └── types/
├── public/
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── .env.local
```

---

## 12. Confidentiality Rules

### Classification Levels

| Level | Description | Where Allowed |
|-------|-------------|---------------|
| **RESTRICTED** | Dollar amounts, account numbers, SSN, tax IDs | Finance Hub UI only. Tyler DM only. |
| **CONFIDENTIAL** | Revenue trends, client names + amounts, P&L | Finance Hub UI. Tyler DM with directional language. |
| **INTERNAL** | Category names, entity existence, general status | Tyler DM. Group chat with vague language only. |

### Agent Behavior Rules

These rules apply to **all agents** (Marcus, Brunel, Walt, Scout, Dewey, Ada, Ed):

1. **NEVER** include dollar amounts, percentages, or specific financial figures in group chat messages.
2. **NEVER** include account numbers, balances, or transaction details in any chat.
3. In group contexts, use only directional language: "revenue is trending up", "expenses are within budget", "cash flow looks healthy".
4. In DM with Tyler: dollar amounts permitted, but use directional first and offer specifics on request.
5. **NEVER** pass financial data to local LLM models for any reason.
6. **NEVER** log financial data to daily memory notes. Use references: "reviewed AnselAI Q1 finances" not "AnselAI Q1 revenue was $X".
7. API responses from Finance Hub include `"confidential": true`. Any agent consuming this data must respect this flag.

### Technical Enforcement

- Finance Hub API returns `X-Confidentiality: RESTRICTED` header on all financial data endpoints
- Agent middleware checks context (group vs DM) before including any Finance Hub data in responses
- Audit log captures every data access with context (which chat, which agent)

---

## 13. Open Questions for Tyler

> These must be answered before Phase 2 begins. Phase 1 can proceed with CSV-only import.

1. **Current tools**: What are you currently using for bookkeeping? (QuickBooks, Wave, spreadsheets, nothing?)
2. **Bank accounts**: Which banks/accounts should we set up for import? (Chase checking, savings, credit cards, etc.)
3. **Payment processors**: Confirm which processors per entity:
   - AnselAI: Square? PayPal? HoneyBook? Other?
   - R3 Studios: Stripe? PayPal? Direct invoicing?
4. **Tax structure**: Are AnselAI and R3 Studios separate LLCs? S-Corp? Sole prop? (Affects tax calculation logic)
5. **CPA relationship**: Do you have a CPA? What format do they need for tax prep? (We can generate it.)
6. **Historical data**: How far back should we import? Current year only? Last 2-3 years?
7. **Multiple users**: Will anyone besides you access Finance Hub? (Spouse, bookkeeper, CPA?)
8. **Investment tracking**: For Reese Family, do you want to track investment accounts (brokerage, 401k) or just cash flow?

---

## 14. Prisma Schema Draft

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["shared", "anselai", "r3studios", "family"]
}

// ============================================================
// SHARED SCHEMA
// ============================================================

model Entity {
  id          String   @id @db.VarChar(50)
  displayName String   @map("display_name") @db.VarChar(255)
  type        EntityType
  schemaName  String   @map("schema_name") @db.VarChar(50)
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz

  apiKeys     ApiKey[]

  @@map("entities")
  @@schema("shared")
}

enum EntityType {
  BUSINESS
  PERSONAL

  @@schema("shared")
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  name         String   @db.VarChar(255)
  role         UserRole @default(VIEWER)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz

  auditLogs    AuditLog[]

  @@map("users")
  @@schema("shared")
}

enum UserRole {
  OWNER
  ADMIN
  VIEWER

  @@schema("shared")
}

model ApiKey {
  id          String   @id @default(uuid()) @db.Uuid
  appName     String   @map("app_name") @db.VarChar(100)
  keyHash     String   @map("key_hash") @db.VarChar(255)
  keyPrefix   String   @map("key_prefix") @db.VarChar(8)
  entityId    String   @map("entity_id") @db.VarChar(50)
  permissions Json     @default("[]")
  isActive    Boolean  @default(true) @map("is_active")
  lastUsedAt  DateTime? @map("last_used_at") @db.Timestamptz
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz

  entity      Entity   @relation(fields: [entityId], references: [id])
  auditLogs   AuditLog[]

  @@map("api_keys")
  @@schema("shared")
}

model AuditLog {
  id           BigInt   @id @default(autoincrement())
  timestamp    DateTime @default(now()) @db.Timestamptz
  userId       String?  @map("user_id") @db.Uuid
  apiKeyId     String?  @map("api_key_id") @db.Uuid
  entityId     String?  @map("entity_id") @db.VarChar(50)
  action       String   @db.VarChar(50)
  resourceType String   @map("resource_type") @db.VarChar(50)
  resourceId   String?  @map("resource_id") @db.VarChar(255)
  details      Json?
  ipAddress    String?  @map("ip_address") @db.VarChar(45)
  userAgent    String?  @map("user_agent") @db.VarChar(500)

  user         User?    @relation(fields: [userId], references: [id])
  apiKey       ApiKey?  @relation(fields: [apiKeyId], references: [id])

  @@index([entityId, timestamp])
  @@index([userId, timestamp])
  @@map("audit_log")
  @@schema("shared")
}

// ============================================================
// ENTITY SCHEMA (replicated per entity - showing AnselAI as example)
// In practice, use Prisma's multi-schema or raw SQL migrations
// to create identical tables in each entity schema.
// ============================================================

model Account {
  id                String      @id @default(uuid()) @db.Uuid
  name              String      @db.VarChar(255)
  accountType       AccountType @map("account_type")
  subType           String?     @map("sub_type") @db.VarChar(100)
  institution       String?     @db.VarChar(255)
  accountNumberEnc  Bytes?      @map("account_number_enc")
  accountNumberLast4 String?    @map("account_number_last4") @db.VarChar(4)
  currency          String      @default("USD") @db.VarChar(3)
  isActive          Boolean     @default(true) @map("is_active")
  openingBalance    BigInt      @default(0) @map("opening_balance")
  createdAt         DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime    @updatedAt @map("updated_at") @db.Timestamptz

  transactionLines  TransactionLine[]
  recurringRules    RecurringRule[]

  @@map("accounts")
  @@schema("anselai")
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE

  @@schema("anselai")
}

model Category {
  id              String    @id @default(uuid()) @db.Uuid
  parentId        String?   @map("parent_id") @db.Uuid
  name            String    @db.VarChar(255)
  taxCategory     String?   @map("tax_category") @db.VarChar(100)
  isTaxDeductible Boolean   @default(false) @map("is_tax_deductible")
  isSystem        Boolean   @default(false) @map("is_system")

  parent          Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children        Category[] @relation("CategoryHierarchy")
  transactions    Transaction[]
  budgetLines     BudgetLine[]
  recurringRules  RecurringRule[]

  @@map("categories")
  @@schema("anselai")
}

model Transaction {
  id                   String            @id @default(uuid()) @db.Uuid
  date                 DateTime          @db.Date
  description          String            @db.VarChar(500)
  reference            String?           @db.VarChar(255)
  status               TransactionStatus @default(PENDING)
  categoryId           String?           @map("category_id") @db.Uuid
  importSource         String?           @map("import_source") @db.VarChar(100)
  importHash           String?           @map("import_hash") @db.VarChar(64)
  isRecurringInstance  Boolean           @default(false) @map("is_recurring_instance")
  recurringRuleId      String?           @map("recurring_rule_id") @db.Uuid
  notes                String?
  createdAt            DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime          @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt            DateTime?         @map("deleted_at") @db.Timestamptz

  category             Category?         @relation(fields: [categoryId], references: [id])
  recurringRule        RecurringRule?    @relation(fields: [recurringRuleId], references: [id])
  lines                TransactionLine[]
  tags                 TransactionTag[]
  attachments          Attachment[]
  invoices             Invoice[]         @relation("InvoicePayment")

  @@index([date])
  @@index([importHash])
  @@index([status])
  @@map("transactions")
  @@schema("anselai")
}

enum TransactionStatus {
  PENDING
  CLEARED
  RECONCILED
  VOID

  @@schema("anselai")
}

model TransactionLine {
  id            String          @id @default(uuid()) @db.Uuid
  transactionId String          @map("transaction_id") @db.Uuid
  accountId     String          @map("account_id") @db.Uuid
  amount        BigInt
  type          LineType
  createdAt     DateTime        @default(now()) @map("created_at") @db.Timestamptz

  transaction   Transaction     @relation(fields: [transactionId], references: [id])
  account       Account         @relation(fields: [accountId], references: [id])

  @@map("transaction_lines")
  @@schema("anselai")
}

enum LineType {
  DEBIT
  CREDIT

  @@schema("anselai")
}

model Tag {
  id           String           @id @default(uuid()) @db.Uuid
  name         String           @unique @db.VarChar(100)

  transactions TransactionTag[]

  @@map("tags")
  @@schema("anselai")
}

model TransactionTag {
  transactionId String      @map("transaction_id") @db.Uuid
  tagId         String      @map("tag_id") @db.Uuid

  transaction   Transaction @relation(fields: [transactionId], references: [id])
  tag           Tag         @relation(fields: [tagId], references: [id])

  @@id([transactionId, tagId])
  @@map("transaction_tags")
  @@schema("anselai")
}

model Invoice {
  id                   String        @id @default(uuid()) @db.Uuid
  direction            InvoiceDirection
  counterparty         String        @db.VarChar(255)
  counterpartyEmail    String?       @map("counterparty_email") @db.VarChar(255)
  invoiceNumber        String        @map("invoice_number") @db.VarChar(50)
  issueDate            DateTime      @map("issue_date") @db.Date
  dueDate              DateTime      @map("due_date") @db.Date
  status               InvoiceStatus @default(DRAFT)
  subtotal             BigInt
  taxAmount            BigInt        @default(0) @map("tax_amount")
  total                BigInt
  paidAmount           BigInt        @default(0) @map("paid_amount")
  paidDate             DateTime?     @map("paid_date") @db.Date
  linkedTransactionId  String?       @map("linked_transaction_id") @db.Uuid
  notes                String?
  createdAt            DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  linkedTransaction    Transaction?  @relation("InvoicePayment", fields: [linkedTransactionId], references: [id])
  lines                InvoiceLine[]
  attachments          Attachment[]

  @@index([status])
  @@index([dueDate])
  @@map("invoices")
  @@schema("anselai")
}

enum InvoiceDirection {
  SENT
  RECEIVED

  @@schema("anselai")
}

enum InvoiceStatus {
  DRAFT
  SENT
  VIEWED
  PAID
  OVERDUE
  CANCELLED

  @@schema("anselai")
}

model InvoiceLine {
  id          String  @id @default(uuid()) @db.Uuid
  invoiceId   String  @map("invoice_id") @db.Uuid
  description String  @db.VarChar(500)
  quantity    Decimal @db.Decimal(10, 2)
  unitPrice   BigInt  @map("unit_price")
  amount      BigInt

  invoice     Invoice @relation(fields: [invoiceId], references: [id])

  @@map("invoice_lines")
  @@schema("anselai")
}

model RecurringRule {
  id          String             @id @default(uuid()) @db.Uuid
  description String             @db.VarChar(500)
  amount      BigInt
  frequency   RecurringFrequency
  startDate   DateTime           @map("start_date") @db.Date
  endDate     DateTime?          @map("end_date") @db.Date
  nextDue     DateTime           @map("next_due") @db.Date
  accountId   String             @map("account_id") @db.Uuid
  categoryId  String?            @map("category_id") @db.Uuid
  isActive    Boolean            @default(true) @map("is_active")
  autoCreate  Boolean            @default(true) @map("auto_create")

  account     Account            @relation(fields: [accountId], references: [id])
  category    Category?          @relation(fields: [categoryId], references: [id])
  transactions Transaction[]

  @@map("recurring_rules")
  @@schema("anselai")
}

enum RecurringFrequency {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  QUARTERLY
  ANNUAL

  @@schema("anselai")
}

model Budget {
  id          String       @id @default(uuid()) @db.Uuid
  name        String       @db.VarChar(255)
  periodStart DateTime     @map("period_start") @db.Date
  periodEnd   DateTime     @map("period_end") @db.Date
  createdAt   DateTime     @default(now()) @map("created_at") @db.Timestamptz

  lines       BudgetLine[]

  @@map("budgets")
  @@schema("anselai")
}

model BudgetLine {
  id            String   @id @default(uuid()) @db.Uuid
  budgetId      String   @map("budget_id") @db.Uuid
  categoryId    String   @map("category_id") @db.Uuid
  plannedAmount BigInt   @map("planned_amount")

  budget        Budget   @relation(fields: [budgetId], references: [id])
  category      Category @relation(fields: [categoryId], references: [id])

  @@map("budget_lines")
  @@schema("anselai")
}

model Attachment {
  id            String       @id @default(uuid()) @db.Uuid
  transactionId String?      @map("transaction_id") @db.Uuid
  invoiceId     String?      @map("invoice_id") @db.Uuid
  filename      String       @db.VarChar(255)
  mimeType      String       @map("mime_type") @db.VarChar(100)
  filePath      String       @map("file_path") @db.VarChar(500)
  fileSize      Int          @map("file_size")
  createdAt     DateTime     @default(now()) @map("created_at") @db.Timestamptz

  transaction   Transaction? @relation(fields: [transactionId], references: [id])
  invoice       Invoice?     @relation(fields: [invoiceId], references: [id])

  @@map("attachments")
  @@schema("anselai")
}

model MonthlySummary {
  id               String   @id @default(uuid()) @db.Uuid
  year             Int
  month            Int
  accountId        String?  @map("account_id") @db.Uuid
  categoryId       String?  @map("category_id") @db.Uuid
  totalDebit       BigInt   @default(0) @map("total_debit")
  totalCredit      BigInt   @default(0) @map("total_credit")
  transactionCount Int      @default(0) @map("transaction_count")
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([year, month, accountId, categoryId])
  @@map("monthly_summaries")
  @@schema("anselai")
}
```

> **Note**: The Prisma schema above shows entity-specific models in the `anselai` schema. For `r3studios` and `family`, identical table structures are created via raw SQL migrations (Prisma's multi-schema support has limitations with identical models across schemas). The application layer uses a schema-switching pattern in the Prisma client factory.

### Schema Replication Strategy

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';

const clients: Record<string, PrismaClient> = {};

export function getEntityClient(entityId: string): PrismaClient {
  if (!clients[entityId]) {
    clients[entityId] = new PrismaClient({
      datasourceUrl: `${process.env.DATABASE_URL}?schema=${entityId}`,
    });
  }
  return clients[entityId];
}

export const sharedClient = new PrismaClient({
  datasourceUrl: `${process.env.DATABASE_URL}?schema=shared`,
});
```

---

## 15. Migration from Prototype

Brunel's SQLite prototype at `/workspace/skills/financial-tracking/` contains early transaction data. Migration plan:

1. **Phase 1**: Export all data from SQLite to CSV
2. **Phase 1**: Map SQLite categories to new chart of accounts
3. **Phase 1**: Import via the standard CSV pipeline (goes through review queue)
4. **Post-migration**: Archive the SQLite database, do not delete
5. **Validation**: Compare totals between old and new system

The prototype is a **migration source only**. Its schema, architecture, and code are not carried forward.

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://finance:password@localhost:5432/finance_hub

# Auth
NEXTAUTH_SECRET=<generate-random-64-char>
NEXTAUTH_URL=http://192.168.68.105:3300

# Encryption
FINANCE_ENCRYPTION_KEY=<generate-random-32-byte-hex>
FINANCE_PII_KEY=<generate-random-32-byte-hex>

# Anthropic (for AI features)
ANTHROPIC_API_KEY=<from-env>

# File storage
ATTACHMENT_PATH=/Volumes/reeseai-memory/data/finance-hub/attachments
```

---

---

## 16. Tyler Decisions (Resolved)

These were open questions, now answered:

| Question | Answer |
|----------|--------|
| Current financial tools? | Spreadsheets only. No QuickBooks. |
| Data sources? | Amex Gold (ending 2003), Amex Delta (ending 1003), two bank accounts (ending 6837, 2938), HoneyBook exports (2020-2026) |
| Data location? | `/Volumes/reeseai-memory/FINANCIALS/` (90 files, 8.2MB) |
| Business structure? | By The Reeses LLC, two-member (Tyler + Alex), taxed as partnership |
| Tax filing? | Joint return (1040), partnership return (Form 1065), Schedule K-1 |
| HoneyBook data? | Full exports: Payments, Projects, Clients, Booked Clients, Leads, Team Members (Jan 2020 - Feb 2026) |

---

## 17. Merchant Learning System (Phase 1 Core Feature)

**This is NOT a nice-to-have. It's Phase 1.**

### Concept

Human-in-the-loop categorization that trains over time. Tyler categorizes once, the system remembers forever.

### Workflow

1. New transactions imported → AI categorizes using merchant name + merchant rules database
2. **High confidence (>90% match to existing rule):** Auto-categorized, reviewable but not flagged
3. **Low confidence or unknown merchant:** Status = `needs_categorization`, appears in review inbox
4. Tyler categorizes in the UI (dropdown, quick buttons, or swipe on mobile)
5. System saves a **merchant rule**: `{merchantPattern: "ADOBE CREATIVE", category: "Business: Software", businessAllocation: 100, entity: "anselai"}`
6. Next occurrence auto-categorizes using Tyler's rule
7. Tyler can override any auto-categorization (updates the rule)

### Merchant Rules Schema

```prisma
model MerchantRule {
  id                 String   @id @default(uuid()) @db.Uuid
  merchantPattern    String   @map("merchant_pattern")  // regex or exact match
  categoryId         String   @map("category_id") @db.Uuid
  entityId           String   @map("entity_id") @db.Uuid  // which entity this belongs to
  businessAllocation Int      @default(100)  // percentage (0-100) for mixed expenses
  confidence         Float    @default(1.0)  // 1.0 = human-set, <1.0 = AI-suggested
  createdBy          String   @map("created_by")  // "tyler" or "ai"
  usageCount         Int      @default(0) @map("usage_count")  // how many times applied
  createdAt          DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime @updatedAt @map("updated_at") @db.Timestamptz

  @@map("merchant_rules")
  @@schema("shared")
}
```

### Review Inbox UI

- Inbox-style view: "23 transactions need categorization"
- Filter: All uncategorized | By entity | By date range
- Quick actions: Category dropdown + entity selector + business allocation slider
- Bulk categorize: "Select all WALMART → Personal: Groceries"
- Split option for mixed expenses: "70% business, 30% personal"
- Mobile-friendly (accessed via Tailscale)

---

## 18. Tax Infrastructure (Phase 1)

### Partnership Tax Requirements (By The Reeses LLC)

- **Form 1065** partnership return
- **Schedule K-1** generated per member (Tyler + Alex, 50/50 unless specified otherwise)
- **Self-employment tax** calculation (15.3% on net self-employment income)
- **Quarterly estimated tax** tracker with payment reminders:
  - Q1: April 15 | Q2: June 15 | Q3: September 15 | Q4: January 15
- **Tax category mapping**: Every expense category maps to a Schedule C / 1065 line item

### Tax Features

| Feature | Phase |
|---------|-------|
| Expense categorization by tax category | Phase 1 |
| Quarterly estimated tax calculator | Phase 1 |
| Quarterly payment reminders (cron) | Phase 1 |
| P&L per entity (monthly/quarterly/annual) | Phase 1 |
| Balance sheet per entity | Phase 1 |
| Mileage log + IRS rate calculator ($0.70/mi for 2025) | Phase 2 |
| Home office deduction tracker (sq ft allocation) | Phase 2 |
| Depreciation schedule (Section 179 + standard) | Phase 2 |
| Meals & entertainment auto-split (50% deductible) | Phase 2 |
| 1099-NEC tracking (contractors paid >$600) | Phase 2 |
| Tax summary export for CPA/TurboTax | Phase 2 |

### Reports (Phase 1, All Three Entities)

- **Profit & Loss**: Monthly, quarterly, annual. Per entity + consolidated.
- **Balance Sheet**: Assets, liabilities, equity. Per entity + consolidated.
- **Cash Flow Statement**: Operating, investing, financing activities.
- **Tax Summary**: Deductions by category, estimated payments made/owed.

---

## 19. Known Data Sources (Import Pipeline Priority)

### Phase 1 Import (CSV parsers needed)

| Source | Format | Cards/Accounts | Date Range |
|--------|--------|---------------|------------|
| Amex Gold | CSV (Date, Description, Card Member, Account #, Amount) | ending 2003 | 2024-2026 |
| Amex Delta | CSV (Date, Receipt, Description, Card Member, Account #, Amount) | ending 1003 | 2024-2026 |
| HoneyBook Payments | CSV | Photography revenue | 2020-2026 |
| HoneyBook Projects | CSV | Booking details | 2020-2026 |
| HoneyBook Clients | CSV | Client data (feeds AnselAI CRM) | 2020-2026 |

### Phase 2 Import (PDF OCR via Mistral)

| Source | Format | Accounts | Date Range |
|--------|--------|----------|------------|
| Bank statements (6837) | PDF | Checking | 2023-2026 |
| Bank statements (2938) | PDF | Checking/Savings | 2023-2026 |

### Monthly Workflow

Tyler downloads new Amex CSVs and bank statements → drops them in `/Volumes/reeseai-memory/FINANCIALS/` → Finance Hub detects new files or Tyler triggers import in UI → transactions parsed, deduplicated, and queued for categorization → Tyler reviews unknowns → system learns.

---

*This spec is ready for Brunel to implement. Phase 1 can begin immediately.*
