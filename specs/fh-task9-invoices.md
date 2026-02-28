# Finance Hub — Task 9: Invoice Management

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Section 6.4)
> Phase 2 Overview: `/workspace/specs/fh-phase2-overview.md`
> Independent of Tasks 6-8 (can build in parallel after review queue exists)
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Full invoice lifecycle: create, edit, track, generate PDF, auto-match payments to transactions. Both outgoing invoices (AR) and received bills (AP). Generic branding now, architecture supports per-entity branding later.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

- `prisma/schema.prisma` — Invoice, InvoiceLine models already defined in Phase 1 schema
- `src/lib/db.ts` — Prisma client factory
- `src/app/(dashboard)/[entity]/` — existing entity dashboard layout

**The Prisma models exist.** Read them. Do not redefine. Build the UI and API on top of the existing schema.

## Architecture

```
src/app/(dashboard)/[entity]/invoices/
├── page.tsx                  # Invoice list view
├── new/page.tsx              # Create invoice form
├── [id]/page.tsx             # Invoice detail / edit
├── [id]/pdf/route.ts         # PDF generation endpoint
├── components/
│   ├── InvoiceForm.tsx       # Create/edit form
│   ├── InvoiceList.tsx       # List with status filters
│   ├── InvoiceDetail.tsx     # Full invoice view
│   ├── InvoicePDF.tsx        # PDF template (React-PDF or HTML-to-PDF)
│   ├── LineItemEditor.tsx    # Add/remove/edit line items
│   ├── PaymentMatcher.tsx    # Link invoice to transaction
│   └── AgingChart.tsx        # AR/AP aging visualization

src/app/api/v1/invoices/
├── route.ts                  # GET (list), POST (create)
├── [id]/route.ts             # GET, PATCH, DELETE (soft)
├── [id]/pdf/route.ts         # GET → returns PDF binary
├── [id]/match/route.ts       # POST → link to transaction
└── aging/route.ts            # GET → aging report data
```

## Detailed Requirements

### 1. Invoice Model (already in Prisma, verify these fields exist)

Per PRD, the Invoice model should have:
- `id`, `entityId`, `invoiceNumber` (auto-generated: INV-YYYY-NNNN)
- `direction`: OUTGOING (AR) or INCOMING (AP)
- `status`: DRAFT, SENT, VIEWED, PAID, OVERDUE, VOID
- `clientName`, `clientEmail`, `clientAddress`
- `issueDate`, `dueDate`, `paidDate`
- `subtotalCents`, `taxCents`, `totalCents` (BIGINT)
- `taxRate` (percentage, stored as integer basis points: 7.25% = 725)
- `notes`, `terms`
- `linkedTransactionId` (nullable, set when payment matched)
- `createdAt`, `updatedAt`, `deletedAt` (soft delete)

InvoiceLine: `id`, `invoiceId`, `description`, `quantity`, `unitPriceCents`, `totalCents`

### 2. Invoice Number Generation

Auto-increment per entity per year:
- Pattern: `{ENTITY_PREFIX}-{YEAR}-{SEQUENCE}`
- AnselAI: `ANS-2026-0001`
- R3 Studios: `R3-2026-0001`
- Family: `FAM-2026-0001`

Sequence resets each year. Store last sequence number or derive from MAX query.

### 3. Create/Edit Form (`InvoiceForm.tsx`)

**Fields:**
- Direction toggle: Outgoing (I'm billing) / Incoming (I received a bill)
- Client name (autocomplete from previous invoices)
- Client email (optional)
- Client address (optional, for PDF)
- Issue date (default: today)
- Due date (default: 30 days from issue, configurable: Net 15, Net 30, Net 60, Due on Receipt)
- Line items (dynamic add/remove):
  - Description (text)
  - Quantity (number, default 1)
  - Unit price (currency input)
  - Line total (auto-calculated, read-only)
- Tax rate (%, default from entity settings or 0)
- Subtotal, tax, total (auto-calculated)
- Notes (rich text or plain text)
- Payment terms text

**Save as Draft** or **Save and Send** (if email configured, otherwise just save).

### 4. Invoice List (`InvoiceList.tsx`)

Table columns: Invoice #, Client, Direction (icon), Date, Due Date, Amount, Status, Actions

**Filters:**
- Status: All, Draft, Sent, Overdue, Paid, Void
- Direction: All, Outgoing, Incoming
- Date range
- Search (client name, invoice number)

**Quick actions:**
- Mark as Sent
- Mark as Paid (opens payment matcher)
- Void
- Download PDF
- Duplicate (create new from existing)

**Status badges:** Color-coded (Draft=zinc, Sent=blue, Overdue=red, Paid=green, Void=zinc strikethrough)

### 5. Payment Matching (`PaymentMatcher.tsx`)

When marking an invoice as PAID:
1. Show recent CLEARED transactions from the entity that haven't been linked to an invoice
2. Filter by amount (exact match or within 5% for partial payments)
3. Filter by date (within 30 days of due date)
4. User selects the matching transaction → links them
5. If no match found, allow manual entry of payment date and amount

**Auto-match on import:** When new transactions are approved in the review queue (Task 7), check if any match an outstanding invoice (same amount, within date range). If match found, suggest linking in the review queue.

### 6. PDF Generation

Use `@react-pdf/renderer` or `puppeteer` (puppeteer is heavier but more flexible).

**Recommendation:** Use `@react-pdf/renderer` for server-side PDF generation. No browser dependency.

**PDF Template:**
```
┌─────────────────────────────────────────┐
│  [ENTITY LOGO PLACEHOLDER]             │
│  Entity Name                            │
│  Entity Address                         │
│                                         │
│  INVOICE                                │
│  Invoice #: ANS-2026-0001              │
│  Date: February 27, 2026               │
│  Due: March 29, 2026                   │
│                                         │
│  Bill To:                               │
│  Client Name                            │
│  Client Address                         │
│                                         │
│  ┌──────────────┬────┬────────┬───────┐ │
│  │ Description  │Qty │ Rate   │ Total │ │
│  ├──────────────┼────┼────────┼───────┤ │
│  │ Wedding Pkg  │ 1  │$5,000  │$5,000 │ │
│  │ Travel       │ 1  │$500    │$500   │ │
│  ├──────────────┼────┼────────┼───────┤ │
│  │              │    │Subtotal│$5,500 │ │
│  │              │    │Tax 7%  │$385   │ │
│  │              │    │TOTAL   │$5,885 │ │
│  └──────────────┴────┴────────┴───────┘ │
│                                         │
│  Notes: Thank you for your business.    │
│  Terms: Due upon receipt.               │
│                                         │
│  [GENERIC FOOTER — future: per-entity]  │
└─────────────────────────────────────────┘
```

**Entity branding slots (generic for now, ready for customization):**
- Logo: placeholder div with entity initial
- Colors: neutral dark theme for PDF (prints well)
- Footer: configurable text field (stored in Entity settings, add column if needed)

### 7. Overdue Detection

Background job (can run as part of daily recurring rules job in Task 10, or standalone):
- Query all SENT invoices where `dueDate < today`
- Update status to OVERDUE
- Could trigger a notification (future, not this task)

### 8. AR/AP Aging Report (`AgingChart.tsx`)

Display aging buckets for outstanding invoices:
- Current (not yet due)
- 1-30 days overdue
- 31-60 days overdue
- 61-90 days overdue
- 90+ days overdue

**Visualization:** Stacked horizontal bar chart per entity. Shows total outstanding in each bucket.

Endpoint: `GET /api/v1/invoices/aging?entityId=X`
Returns: `{ buckets: { current: number, days30: number, days60: number, days90: number, days90plus: number }, invoices: Invoice[] }`

### 9. API Endpoints

#### `GET /api/v1/invoices`
Query params: `entityId`, `status`, `direction`, `dateFrom`, `dateTo`, `search`, `page`, `limit`
Returns: `{ invoices: Invoice[], total: number }`

#### `POST /api/v1/invoices`
Body: Full invoice object with line items
Returns: Created invoice with generated invoice number

#### `GET /api/v1/invoices/[id]`
Returns: Invoice with line items and linked transaction (if any)

#### `PATCH /api/v1/invoices/[id]`
Body: Partial invoice update. Cannot edit if status is PAID or VOID.

#### `DELETE /api/v1/invoices/[id]`
Soft delete (sets `deletedAt`). Cannot delete PAID invoices.

#### `GET /api/v1/invoices/[id]/pdf`
Returns: PDF binary with Content-Type: application/pdf

#### `POST /api/v1/invoices/[id]/match`
Body: `{ transactionId: string }`
Links invoice to transaction, sets status to PAID, records `paidDate`.

#### `GET /api/v1/invoices/aging`
Query: `entityId` (required)
Returns aging breakdown.

### 10. Sidebar Navigation

Add "Invoices" to entity sidebar:
```
📊 Dashboard
💳 Transactions
📥 Import
✅ Review (47)
📄 Invoices      ← This task
📈 Reports
🏷️ Categorize
```

## Testing Requirements

1. **CRUD:** Create invoice with 3 line items, verify totals calculated correctly
2. **Invoice number:** Sequential generation, resets per year, per entity
3. **PDF generation:** Generate PDF, verify it's valid PDF (check magic bytes)
4. **Payment matching:** Create invoice for $5000, approve transaction for $5000, verify auto-match suggestion
5. **Overdue detection:** Create invoice due yesterday, run detection, verify status change
6. **Aging report:** Invoices across buckets, verify correct bucketing
7. **Soft delete:** Delete invoice, verify still in DB with deletedAt set
8. **Edge cases:** Zero-amount invoice, single line item, 100+ line items

## Constraints

- **Money is BIGINT cents.** All amounts stored and calculated in cents.
- **Soft delete only.** Never hard-delete invoices.
- **No email sending in this task.** PDF download only. Email integration is Phase 4.
- **Generic branding.** Entity name + invoice number. No logos, no colors beyond the dark theme. But the template MUST have placeholder slots for logo, brand color, and footer text so it's a config change later.
- **Tax rate stored as basis points** (integer). 7.25% = 725. Avoids float precision issues.
