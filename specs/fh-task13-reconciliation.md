# Finance Hub — Task 13: Reconciliation Workflow

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Section 6.7)
> Phase 3 Overview: `/workspace/specs/fh-phase3-overview.md`
> Depends on: Phase 1 transaction management
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Bank reconciliation workflow: Tyler uploads a statement (or enters ending balance), matches transactions, and locks the period when balanced. Reconciled transactions cannot be edited without explicit unlock and audit trail.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Context: What Already Exists

Read before writing ANY code:
- `prisma/schema.prisma` — Transaction model with `status` enum (PENDING, CLEARED, RECONCILED, VOID)
- `src/app/(dashboard)/[entity]/transactions/page.tsx` — Transaction list view
- `src/lib/db.ts` — Prisma client factory
- `src/lib/import/` — CSV parsers (can reuse for statement parsing)

**Transaction status field exists. Reconciliation builds on top of it.**

## Architecture

```
src/app/(dashboard)/[entity]/reconcile/
├── page.tsx                      # NEW — Reconciliation home (account list)
├── [accountId]/
│   ├── page.tsx                  # NEW — Reconciliation workflow for account
│   └── components/
│       ├── ReconcileHeader.tsx   # Account info, statement upload, ending balance entry
│       ├── TransactionMatcher.tsx # Checkbox list of unreconciled transactions
│       ├── BalanceSummary.tsx    # Running difference calculation
│       └── ReconcileHistory.tsx  # Past reconciliation periods

src/app/api/v1/reconcile/
├── route.ts                      # POST — start new reconciliation
├── [id]/
│   ├── route.ts                  # PATCH — update reconciliation, DELETE — abort
│   ├── match/route.ts            # POST — mark transactions as reconciled
│   └── finalize/route.ts         # POST — lock period when balanced
└── history/route.ts              # GET — reconciliation history for account

src/lib/reconciliation/
├── engine.ts                     # NEW — reconciliation calculation logic
├── lock.ts                       # NEW — transaction locking/unlocking
└── history.ts                    # NEW — reconciliation record management
```

## Detailed Requirements

### 1. Reconciliation Model (New Prisma Model)

Add to `prisma/schema.prisma`:

```prisma
model Reconciliation {
  id                String              @id @default(uuid()) @db.Uuid
  accountId         String              @map("account_id") @db.Uuid
  periodStart       DateTime            @map("period_start") @db.Date
  periodEnd         DateTime            @map("period_end") @db.Date
  startingBalance   BigInt              @map("starting_balance")  // From previous reconciliation or account opening balance
  endingBalance     BigInt              @map("ending_balance")    // From bank statement
  clearedBalance    BigInt              @map("cleared_balance")   // Sum of reconciled transactions
  difference        BigInt              @default(0)               // endingBalance - (startingBalance + clearedBalance)
  status            ReconciliationStatus @default(IN_PROGRESS)
  reconciledCount   Int                 @default(0) @map("reconciled_count")
  unreconciledCount Int                 @default(0) @map("unreconciled_count")
  statementFile     String?             @map("statement_file") // Path to uploaded statement (optional)
  notes             String?
  reconciledBy      String              @map("reconciled_by") @db.Uuid  // User ID
  reconciledAt      DateTime?           @map("reconciled_at") @db.Timestamptz
  createdAt         DateTime            @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime            @updatedAt @map("updated_at") @db.Timestamptz

  account           Account             @relation(fields: [accountId], references: [id])
  user              User                @relation(fields: [reconciledBy], references: [id])

  @@index([accountId, periodEnd])
  @@map("reconciliations")
  @@schema("anselai")  // Replicate in r3studios and family schemas
}

enum ReconciliationStatus {
  IN_PROGRESS
  BALANCED
  LOCKED
  ABORTED

  @@schema("anselai")
}
```

**Note:** This model must be replicated in `r3studios` and `family` schemas via SQL migrations, same as other entity-specific tables.

### 2. Reconciliation Workflow (`[accountId]/page.tsx`)

**Step-by-step UI:**

```
┌─────────────────────────────────────────────────────────┐
│ Reconcile: Chase Checking (****6837)                    │
│ Period: February 1 - February 28, 2026                  │
├─────────────────────────────────────────────────────────┤
│ 📄 Upload Statement (optional):                         │
│    [Drop CSV or PDF here]                               │
│                                                         │
│ 💰 Ending Balance from Statement:                      │
│    $ [_______.__ ]   (or import from uploaded file)    │
│                                                         │
│ Starting Balance (from last reconciliation): $12,450.00│
├─────────────────────────────────────────────────────────┤
│ Transactions to Reconcile (CLEARED status):             │
│                                                         │
│ ☐ 02/03  KROGER #4521           -$127.43                │
│ ☐ 02/05  PAYROLL DEPOSIT        +$5,000.00              │
│ ☐ 02/10  SHELL OIL 12345        -$52.18                 │
│ ☐ 02/15  NETFLIX.COM            -$15.99                 │
│ ... (47 total)                                          │
│                                                         │
│ [☑ Select All] [☐ Select None]                         │
├─────────────────────────────────────────────────────────┤
│ Balance Summary:                                        │
│  Starting Balance:        $12,450.00                    │
│  + Cleared Transactions:  +$4,732.41                    │
│  = Calculated Balance:    $17,182.41                    │
│                                                         │
│  Statement Ending Balance: $17,182.41                   │
│  Difference:              $0.00 ✓                       │
│                                                         │
│ [Mark as Reconciled] (enabled when difference = $0)     │
└─────────────────────────────────────────────────────────┘
```

**Workflow Steps:**

1. **Select account** from reconciliation home (shows all accounts with pending CLEARED transactions)
2. **Upload statement** (optional): If uploaded, parse ending balance automatically (CSV or OCR PDF in future)
3. **Enter period**: Default to current month, editable
4. **Enter ending balance**: Manual entry or parsed from statement
5. **Match transactions**: Checkbox list of CLEARED transactions in the period. User checks matching transactions.
6. **Live difference calculation**: As user checks/unchecks, recalculate difference in real-time
7. **Finalize**: When difference = $0.00, "Mark as Reconciled" button enabled
8. **Lock period**: On finalize, all checked transactions → status RECONCILED, period locked

### 3. Starting Balance Logic

**First reconciliation for account:**
- Starting balance = account `openingBalance` from Accounts table

**Subsequent reconciliations:**
- Starting balance = previous reconciliation's `endingBalance`

**Query:**
```typescript
const previousReconciliation = await prisma.reconciliation.findFirst({
  where: { accountId, status: 'LOCKED' },
  orderBy: { periodEnd: 'desc' },
});

const startingBalance = previousReconciliation?.endingBalance ?? account.openingBalance;
```

### 4. Transaction Matching (`TransactionMatcher.tsx`)

**Display:**
- Only show CLEARED transactions within the period
- Sort by date ascending
- Checkbox per transaction
- Running total of checked transactions displayed below list
- Search/filter by description, amount range

**Selection helpers:**
- "Select All" / "Select None" buttons
- "Select This Page" (if paginated)
- Keyboard shortcut: Space to toggle current row

**Visual states:**
- Unchecked: normal row
- Checked: highlighted background (subtle green tint)
- RECONCILED (from previous period): read-only, greyed out, checkbox disabled

### 5. Balance Summary Calculation (`BalanceSummary.tsx`)

Live calculation:
```typescript
interface BalanceSummary {
  startingBalance: bigint;
  clearedBalance: bigint;  // Sum of checked transactions
  calculatedBalance: bigint;  // startingBalance + clearedBalance
  statementBalance: bigint;   // User-entered ending balance
  difference: bigint;         // statementBalance - calculatedBalance
  isBalanced: boolean;        // difference === 0n
}
```

**Display:**
```
Starting Balance:        $12,450.00
+ Cleared Transactions:  +$4,732.41   (47 transactions)
= Calculated Balance:    $17,182.41

Statement Ending Balance: $17,182.41
Difference:              $0.00 ✓
```

Green checkmark when balanced, red warning icon when not.

### 6. Finalization Logic (`lock.ts`)

When user clicks "Mark as Reconciled":

1. **Validation:**
   - Difference must be exactly $0.00
   - At least 1 transaction must be selected
   - Reconciliation must be in IN_PROGRESS status

2. **Transaction updates:**
   - Set all selected transactions to status = RECONCILED
   - Add metadata field (JSONB): `{ reconciledOn: Date, reconciliationId: UUID }`

3. **Lock reconciliation:**
   - Update Reconciliation record: status = LOCKED, reconciledAt = now()
   - Set reconciledCount, unreconciledCount

4. **Audit log:**
   - Log action: `RECONCILE_PERIOD` with details (account, period, transaction count)

5. **Transaction locking:**
   - Reconciled transactions cannot be edited via standard UI
   - Attempting to edit shows modal: "This transaction is reconciled. Unlock the period to edit."

### 7. Unlocking Reconciled Transactions

**Use case:** Tyler finds an error in a reconciled period.

**UI:** Reconciliation history page shows past reconciliations. Each has "Unlock Period" button.

**Unlock flow:**
1. User clicks "Unlock Period"
2. Modal: "Unlocking this period will mark all transactions as CLEARED again. Continue?"
3. On confirm:
   - Update all RECONCILED transactions in period → status = CLEARED
   - Update Reconciliation record → status = ABORTED, add `unlockedAt` timestamp
   - Audit log: `UNLOCK_RECONCILIATION` with user, timestamp, reason (optional text field)
4. User can now edit transactions and re-reconcile

### 8. Reconciliation History (`ReconcileHistory.tsx`)

**Display:** Table of past reconciliations for the account.

| Period | Ending Balance | Transactions | Status | Reconciled By | Date | Actions |
|--------|---------------|--------------|--------|---------------|------|---------|
| Feb 2026 | $17,182.41 | 47 | LOCKED | Tyler | Feb 28 | [View] [Unlock] |
| Jan 2026 | $12,450.00 | 52 | LOCKED | Tyler | Jan 31 | [View] [Unlock] |
| Dec 2025 | $9,823.15 | 61 | LOCKED | Tyler | Dec 31 | [View] [Unlock] |

**View:** Opens read-only view of the reconciliation (which transactions were matched).

**Unlock:** Described above.

### 9. Account List View (`reconcile/page.tsx`)

**Purpose:** Show all accounts that need reconciliation.

```
┌─────────────────────────────────────────────────────────┐
│ Reconciliation                                          │
├─────────────────────────────────────────────────────────┤
│ Chase Checking (****6837)                               │
│   Last reconciled: Feb 28, 2026                         │
│   Unreconciled transactions: 23                         │
│   [Reconcile Now]                                       │
│                                                         │
│ Wells Fargo Savings (****2938)                          │
│   Last reconciled: Never                                │
│   Unreconciled transactions: 8                          │
│   [Reconcile Now]                                       │
│                                                         │
│ Amex Gold (****2003)                                    │
│   Last reconciled: Feb 15, 2026                         │
│   Unreconciled transactions: 12                         │
│   [Reconcile Now]                                       │
└─────────────────────────────────────────────────────────┘
```

**Badge:** If account has >20 unreconciled transactions, show warning badge.

### 10. API Endpoints

#### `POST /api/v1/reconcile`
**Body:**
```json
{
  "accountId": "uuid",
  "periodStart": "2026-02-01",
  "periodEnd": "2026-02-28",
  "endingBalance": 1718241  // cents
}
```
**Returns:** Created Reconciliation record (status: IN_PROGRESS)

#### `GET /api/v1/reconcile/[id]`
**Returns:** Reconciliation record with list of transactions in period

#### `POST /api/v1/reconcile/[id]/match`
**Body:**
```json
{
  "transactionIds": ["uuid1", "uuid2", ...]
}
```
**Action:** Temporarily mark these transactions as matched (doesn't change status yet, just tracks selection)

#### `POST /api/v1/reconcile/[id]/finalize`
**Validation:** Checks difference = 0, then:
- Updates selected transactions → status RECONCILED
- Updates Reconciliation → status LOCKED
- Logs audit event

**Returns:** Updated Reconciliation record

#### `POST /api/v1/reconcile/[id]/unlock`
**Requires:** OWNER role or explicit permission
**Action:** Unlocks period, reverts transactions to CLEARED
**Body:** `{ reason: string }` (optional)
**Returns:** Updated Reconciliation record (status: ABORTED)

#### `GET /api/v1/reconcile/history?accountId=uuid`
**Returns:** Array of Reconciliation records for account, ordered by periodEnd desc

### 11. Statement Upload (Optional Enhancement)

**Phase 3 Minimum:** Manual entry of ending balance.

**Future (Phase 4):** Parse ending balance from uploaded CSV or PDF statement.

**For this task:** Add UI for statement file upload, store path in `statementFile` field, but don't parse. Just store for record-keeping.

## New Prisma Models

See **Reconciliation** model in section 1 above.

## Testing Requirements

1. **First reconciliation:** Account with no prior reconciliations, verify starting balance = openingBalance
2. **Subsequent reconciliation:** Second reconciliation, verify starting balance = previous ending balance
3. **Balance calculation:** 10 transactions totaling +$500, starting $1000, ending $1500, verify difference = $0
4. **Finalize:** Balanced reconciliation, verify transactions marked RECONCILED, period locked
5. **Edit locked transaction:** Attempt to edit RECONCILED transaction, verify blocked
6. **Unlock period:** Unlock reconciliation, verify transactions reverted to CLEARED
7. **Audit trail:** Finalize and unlock, verify both actions logged in AuditLog
8. **Multiple accounts:** Reconcile two accounts in same period, verify no cross-contamination
9. **Partial selection:** Select only 5 of 10 transactions, verify difference reflects only selected
10. **Zero-transaction period:** No transactions in period, verify still reconcilable with $0 change

## Constraints

- **Money is BIGINT cents.** All balance calculations in cents, display formatted.
- **Difference must be exactly $0.00** to finalize. No tolerance for rounding errors.
- **Soft lock enforcement:** Reconciled transactions can be unlocked, but requires explicit action and audit trail.
- **Single reconciliation per account per period.** Cannot have overlapping reconciliation periods for same account.
- **OWNER-only unlock:** Unlocking a reconciliation requires OWNER role. Regular users cannot unlock.
- **Read-only display:** Once LOCKED, the reconciliation detail view is read-only. Show "Locked" badge prominently.

---

🦞 **Marcus Rawlins**
