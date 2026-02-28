# Finance Hub — Task 7: Import Review Queue

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 5.4, 6.2)
> Phase 2 Overview: `/workspace/specs/fh-phase2-overview.md`
> Depends on: Task 6 (import parsers + dedup engine)
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+. Below threshold → back to Brunel.

---

## Objective

Build the review queue where all imported transactions land. Tyler needs to review, categorize, approve, reject, or resolve duplicates efficiently. This is the single bottleneck between raw imports and the ledger, so speed matters. Target: review 50+ transactions in under 2 minutes.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

Read before writing ANY code:
- `src/lib/import/` — Task 6's parsers, types, dedup engine
- `src/app/(dashboard)/[entity]/transactions/page.tsx` — existing transaction list (Phase 1)
- `src/app/api/v1/transactions/route.ts` — existing transaction API
- `src/lib/import/types.ts` — ImportedTransaction, DedupResult types
- `src/lib/categorization/` — Phase 1's merchant rule matching
- `prisma/schema.prisma` — Transaction model (has `status` field with PENDING/CLEARED/VOID)

**Do not duplicate existing transaction management.** The review queue is a filtered view of PENDING transactions with enhanced actions.

## Architecture

```
src/app/(dashboard)/[entity]/review/
├── page.tsx              # Review queue page
├── components/
│   ├── ReviewTable.tsx       # Main table with inline editing
│   ├── ReviewToolbar.tsx     # Bulk actions, filters, stats
│   ├── TransactionRow.tsx    # Individual row with quick actions
│   ├── DuplicateResolver.tsx # Side-by-side duplicate comparison
│   ├── QuickEdit.tsx         # Inline edit popover (category, description, account)
│   └── ImportSummary.tsx     # Header card showing import session stats

src/app/api/v1/review/
├── route.ts              # GET (list pending), PATCH (bulk actions)
├── [id]/route.ts         # PATCH (single transaction update), DELETE (reject)
└── duplicates/route.ts   # GET (flagged duplicates with their matches)
```

## Detailed Requirements

### 1. Review Queue Page (`src/app/(dashboard)/[entity]/review/page.tsx`)

**Layout:**
- Header: Import summary card (total pending, approved today, rejected, duplicates flagged)
- Toolbar: filters + bulk action buttons
- Main table: scrollable, keyboard-navigable transaction list
- Sidebar (conditional): duplicate resolver or edit panel

**URL:** `/[entity]/review`
**Add to sidebar navigation** in `[entity]/layout.tsx` with badge showing pending count.

### 2. Review Table (`ReviewTable.tsx`)

Columns:
| Column | Width | Content |
|--------|-------|---------|
| ☐ | 40px | Checkbox (for bulk select) |
| Date | 100px | Transaction date |
| Description | flex | Raw description + normalized preview on hover |
| Amount | 120px | Formatted, green for credits, red for debits |
| Account | 140px | Account name (Credit Card, Checking, etc.) |
| Category | 160px | Dropdown selector (existing categories) + AI suggestion badge |
| Flags | 80px | Duplicate icon, low-confidence icon |
| Actions | 120px | Approve ✓, Reject ✗, Edit ✏️ |

**Sorting:** Default by date descending. Clickable column headers for sort.
**Pagination:** 50 per page with infinite scroll (load more on scroll).

### 3. Keyboard Shortcuts

These are critical for speed. Implement with a global keyboard listener on the review page:

| Key | Action |
|-----|--------|
| `j` / `↓` | Move selection down |
| `k` / `↑` | Move selection up |
| `a` | Approve selected transaction(s) |
| `x` | Reject selected transaction(s) |
| `e` | Open edit for selected transaction |
| `d` | Open duplicate resolver for flagged transaction |
| `Space` | Toggle checkbox on selected row |
| `Ctrl+A` | Select all visible |
| `Ctrl+Shift+A` | Approve all visible |
| `Escape` | Clear selection / close panels |
| `?` | Show keyboard shortcut help overlay |

**Visual indicator:** Selected row has a subtle highlight (`bg-zinc-800`). Active row has a left border accent.

### 4. Filters (ReviewToolbar.tsx)

- **Status filter:** All Pending | Duplicates Only | Low Confidence | High Confidence
- **Date range:** Quick picks (This month, Last month, Last 90 days) + custom range
- **Account filter:** Dropdown of accounts
- **Amount range:** Min/max inputs
- **Import session:** Filter by specific import batch
- **Search:** Full-text on description

Filters update URL query params so they persist on refresh.

### 5. Bulk Actions

- **Approve Selected:** Move selected transactions from PENDING → CLEARED. Creates TransactionLines (debit expense, credit liability/asset per account type).
- **Reject Selected:** Set status to VOID, add rejection note to audit log.
- **Categorize Selected:** Apply a single category to all selected transactions.
- **Approve All High-Confidence:** One-click approve everything with AI confidence >90% AND a matching MerchantRule.

### 6. Inline Quick Edit (`QuickEdit.tsx`)

Clicking the edit icon or pressing `e` opens an inline edit panel (not a modal, not a new page). Fields:
- **Description:** Editable text input (pre-filled with raw description)
- **Category:** Searchable dropdown of categories
- **Account:** Dropdown (which credit card / bank account)
- **Notes:** Optional text field
- **Tags:** Tag selector (existing tags + create new)
- Save and Approve (one action) or just Save (stays pending)

### 7. Duplicate Resolver (`DuplicateResolver.tsx`)

When a transaction has a duplicate flag (from Task 6 dedup engine):
- Opens a side panel showing the flagged transaction and its potential match(es) side by side
- Fields compared: Date, Amount, Description, Account, Status
- Differences highlighted in amber
- Actions:
  - **Keep This:** Approve this transaction, it's not a duplicate
  - **Is Duplicate:** Link to existing transaction, reject this one
  - **Keep Both:** Approve both, mark as intentional duplicates (adds a note)
  - **Merge:** Keep one, transfer any additional info from the other

### 8. Import Summary Card (`ImportSummary.tsx`)

Sticky card at top of review page:
```
┌─────────────────────────────────────────────────────────┐
│  📥 47 Pending   ✅ 123 Approved Today   ❌ 2 Rejected  │
│  ⚠️ 5 Duplicates Flagged   🤖 38 AI-Categorized        │
└─────────────────────────────────────────────────────────┘
```

Numbers are live (query on page load, update after each action without full refresh).

### 9. API Endpoints

#### `GET /api/v1/review?entity=X`
Query params: `status`, `dateFrom`, `dateTo`, `accountId`, `amountMin`, `amountMax`, `importSessionId`, `search`, `page`, `limit`, `sort`, `order`

Returns: `{ transactions: Transaction[], total: number, page: number, stats: ReviewStats }`

`ReviewStats`: `{ pending: number, approvedToday: number, rejected: number, duplicatesFlagged: number, aiCategorized: number }`

#### `PATCH /api/v1/review` (bulk)
Body: `{ action: 'approve' | 'reject' | 'categorize', transactionIds: string[], categoryId?: string, note?: string }`

- `approve`: Sets status CLEARED, creates TransactionLines, writes AuditLog entry
- `reject`: Sets status VOID, writes AuditLog with rejection note
- `categorize`: Updates category on all specified transactions

Returns: `{ updated: number, errors: { id: string, error: string }[] }`

#### `PATCH /api/v1/review/[id]`
Body: `{ description?: string, categoryId?: string, accountId?: string, notes?: string, tags?: string[], status?: 'CLEARED' | 'VOID' }`

Single transaction update. If status changes to CLEARED, create TransactionLines.

#### `GET /api/v1/review/duplicates?entity=X`
Returns transactions flagged as duplicates with their potential matches:
```json
{
  "duplicates": [
    {
      "transaction": { ... },
      "matches": [
        { "transaction": { ... }, "confidence": "exact", "hash": "abc123" }
      ]
    }
  ]
}
```

#### `POST /api/v1/review/[id]/resolve-duplicate`
Body: `{ action: 'keep' | 'is_duplicate' | 'keep_both' | 'merge', matchId?: string }`

### 10. TransactionLine Creation on Approval

When a PENDING transaction is approved (moved to CLEARED), the system must create proper double-entry TransactionLines:

```typescript
// For a debit (expense):
// Debit → Expense category account
// Credit → Source account (credit card, checking, etc.)

// For a credit (income/refund):
// Debit → Source account
// Credit → Revenue/refund category account
```

The account is determined by:
1. The `accountId` on the transaction (which credit card / bank account)
2. The `categoryId` maps to a Chart of Accounts entry

**This is the core accounting logic.** SUM(debits) must equal SUM(credits) for every transaction. Enforce this as a database constraint or application-layer check.

### 11. Audit Trail

Every review action writes to AuditLog:
- `action`: 'transaction.approved', 'transaction.rejected', 'transaction.categorized', 'transaction.edited', 'duplicate.resolved'
- `entityId`: which entity
- `targetId`: transaction ID
- `details`: JSON with before/after values
- `userId`: who performed the action

### 12. Real-time Stats Update

After any bulk action, the ImportSummary card updates without a full page reload. Use:
- Server actions (Next.js) that return updated stats, OR
- Optimistic updates on the client with revalidation

## Sidebar Navigation Update

Add "Review" to the entity sidebar in `[entity]/layout.tsx`:
```
📊 Dashboard
💳 Transactions
📥 Import        ← Task 6
✅ Review (47)   ← This task, badge shows pending count
📈 Reports
🏷️ Categorize
```

## Testing Requirements

1. **API tests:** CRUD operations on review endpoints, bulk approve/reject, duplicate resolution
2. **Dedup integration:** Import a file with known duplicates, verify they appear in duplicate resolver
3. **Double-entry validation:** Approve a transaction, verify TransactionLines balance
4. **Bulk operations:** Approve 50 transactions at once, verify all get lines created
5. **Edge cases:** Approve already-approved (idempotent), reject then un-reject, edit after approve

Run with `bun test`.

## UI Design

Same dark theme as Phase 1:
- `bg-zinc-950` page, `bg-zinc-900` cards, `bg-zinc-800` hover/selected states
- Green (`text-emerald-400`) for approve/credits, red (`text-red-400`) for reject/debits
- Amber (`text-amber-400`) for warnings/duplicate flags
- Blue (`text-blue-400`) for AI suggestion badges
- Keyboard shortcut hints: subtle `text-zinc-500` badges next to action buttons
- Transitions: 150ms ease for row selection, panel open/close

## Constraints

- **Money is BIGINT cents.** Display formatting at UI layer only.
- **No modal dialogs** for review actions. Everything inline or side panel. Modals break flow.
- **Optimistic UI:** Actions should feel instant. Update UI immediately, revert on error.
- **PENDING is the only reviewable status.** CLEARED and VOID transactions don't appear in review queue.
