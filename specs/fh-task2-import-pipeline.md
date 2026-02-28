# Finance Hub — Task 2: Import Pipeline

> 🦞 Marcus Rawlins | Spec v1.1 | 2026-02-27
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 5, 16, 19)
> Depends on: Task 1 (Scaffolding)
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+. Below threshold → back to Brunel.

---

## Objective

Build CSV parsers for all 5 credit cards + HoneyBook exports. Transaction normalization, dedup logic, entity assignment, double-entry journal creation, and bulk insert. CLI-testable before any frontend.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Critical Rules from PRD

1. **All amounts stored as BIGINT in cents.** Parse `$1,234.56` → `123456`. No floats in storage.
2. **Double-entry required.** Every imported transaction creates a Transaction + balanced TransactionLines (debit + credit).
3. **Imported transactions start as PENDING status.** They land in the review queue.
4. **Dedup uses SHA-256 hash:** `SHA-256(entity_id + date + amount + description_normalized + account_id)`
5. **Soft deletes only.** Never hard-delete imported data.
6. **Audit every import** in shared.audit_log.

## Data Sources

All source files in `/Volumes/reeseai-memory/FINANCIALS/`

### Credit Card CSVs (5 cards)

| Card | Files | Amex Format | Account # Ending |
|------|-------|------------|-----------------|
| Amex Gold | `amex-gold-{2024,2025,2026}.csv` | Date, Description, Card Member, Account #, Amount | 2003 |
| Amex Delta Reserve | `amex-delta-reserve-{2024,2025,2026}.csv` | Date, Receipt, Description, Card Member, Account #, Amount | (check file) |
| Amex Delta | `amex-delta-{2024,2025,2026}.csv` | Date, Receipt, Description, Card Member, Account #, Amount | 1003 |
| Amex Bonvoy | `amex-bonvoy-{2024,2025,2026}.csv` | Same Amex format (verify headers) | (check file) |
| Capital One Venture | `venture-{2024,2025,2026}.csv` | Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit | (check file) |

**IMPORTANT:** Before building parsers, READ THE ACTUAL CSV FILES to verify headers. The PRD lists expected formats but the real files are the source of truth. Amex formats may have slight variations (some include Receipt column, some don't). Build parsers that handle both.

### HoneyBook CSVs

| File | Purpose |
|------|---------|
| `January-2020-February-2026-Payments-report-(HoneyBook).csv` | Revenue: payment amounts, dates, clients |
| `January-2020-February-2026-Project-report-(HoneyBook).csv` | Project metadata for enrichment |
| `January-2020-February-2026-Booked Client-report-(HoneyBook).csv` | Booking data |
| `January-2020-February-2026-Client-report-(HoneyBook).csv` | Client info |

## File Structure

```
finance-hub/src/
├── lib/
│   └── import/
│       ├── index.ts            # Import orchestrator
│       ├── types.ts            # Shared import types (NormalizedTransaction, ImportResult)
│       ├── parsers/
│       │   ├── amex.ts         # Amex CSV parser (handles Gold, Delta, Reserve, Bonvoy variations)
│       │   ├── venture.ts      # Capital One Venture CSV parser
│       │   └── honeybook.ts    # HoneyBook payments CSV parser
│       ├── normalizer.ts       # Convert parsed rows → NormalizedTransaction
│       ├── dedup.ts            # SHA-256 hash generation + DB duplicate check
│       ├── journal.ts          # Create balanced TransactionLines for each transaction
│       └── bulk-insert.ts      # Atomic batch insert with Prisma $transaction
├── scripts/
│   ├── import-csv.ts           # CLI: bun run scripts/import-csv.ts <file> --source <source> --entity <entity>
│   └── import-all.ts           # CLI: import all known files with preconfigured mappings
```

## Parser Specifications

### Amex Parser (`amex.ts`)

Handles all 4 Amex cards. Auto-detect which format based on headers.

**Format A (Gold):** `Date`, `Description`, `Card Member`, `Account #`, `Amount`
**Format B (Delta/Reserve):** `Date`, `Receipt`, `Description`, `Card Member`, `Account #`, `Amount`

Handle both. If `Receipt` column exists, capture it as `reference`.

```typescript
interface ParsedAmexRow {
  date: Date;               // Parsed from MM/DD/YYYY
  description: string;      // Raw description
  reference?: string;       // Receipt number if present
  cardMember?: string;      // For audit trail
  accountNumber?: string;   // Last 4 for identification
  amountCents: bigint;      // Converted to cents. Positive = charge (expense), Negative = credit/refund
}
```

**Source identifiers:**
- `amex-gold-*` → `importSource: "csv:amex_gold"`
- `amex-delta-reserve-*` → `importSource: "csv:amex_reserve"`
- `amex-delta-*` → `importSource: "csv:amex_delta"`
- `amex-bonvoy-*` → `importSource: "csv:amex_bonvoy"`

### Venture Parser (`venture.ts`)

**Columns:** `Transaction Date`, `Posted Date`, `Card No.`, `Description`, `Category`, `Debit`, `Credit`

```typescript
interface ParsedVentureRow {
  date: Date;               // Parsed from YYYY-MM-DD (Transaction Date)
  postedDate: Date;
  cardNumber?: string;      // Last 4
  description: string;
  vendorCategory: string;   // Cap One's category (store as metadata, don't trust for our categorization)
  amountCents: bigint;      // Debit column = expense (positive), Credit column = refund (negative)
}
```

Source: `importSource: "csv:venture"`

### HoneyBook Parser (`honeybook.ts`)

Parse the Payments report for revenue transactions.

**Read the actual file headers first.** Extract:
- Payment date → `date`
- Amount → `amountCents` (this is REVENUE, so it's a credit/income)
- Client name → stored in `description` and `reference`
- Project name → stored in `notes`
- Payment status → **only import completed/paid payments**

Source: `importSource: "csv:honeybook"`

HoneyBook data is **always** `anselai` entity. The CLI should enforce this.

## Normalizer (`normalizer.ts`)

All parsers produce format-specific rows. The normalizer converts to the PRD's Transaction shape:

```typescript
interface NormalizedTransaction {
  date: Date;
  description: string;          // Cleaned description
  reference: string | null;     // Check #, receipt #, confirmation
  status: 'PENDING';            // Always PENDING on import
  importSource: string;         // csv:amex_gold, csv:venture, csv:honeybook
  importHash: string;           // SHA-256 dedup hash
  notes: string | null;         // Extra metadata (project name, vendor category)
  amountCents: bigint;          // Always positive
  lineType: 'DEBIT' | 'CREDIT'; // DEBIT = money out (expense), CREDIT = money in (income)
  merchantName: string | null;   // Cleaned merchant name for matching
}
```

**Merchant name cleaning:**
- Strip trailing location codes: "RESTAURANT NAME CITY ST 12345" → "RESTAURANT NAME"
- Strip card member references and transaction IDs
- Remove common prefixes: "SQ *", "TST*", "PAYPAL *", "AMZN MKTP US*" (keep merchant name after)
- Normalize whitespace, Title Case
- Store both `description` (cleaned) and preserve raw in a way that's recoverable

## Dedup Logic (`dedup.ts`)

Per PRD Section 5:

```typescript
function generateImportHash(entityId: string, date: Date, amountCents: bigint, description: string, accountId: string): string {
  const normalized = `${entityId}|${date.toISOString().split('T')[0]}|${amountCents}|${description.toLowerCase().trim()}|${accountId}`;
  return sha256(normalized);
}
```

Before inserting, query existing transactions for matching `importHash`. Return only new (non-duplicate) transactions.

**Edge case:** Legitimate duplicates (two identical subscription charges same day) should be flagged for review, not silently skipped. If a hash collision is detected, check if the existing transaction was user-approved. If yes, allow the new one but flag it.

## Journal Entry Creation (`journal.ts`)

Every imported transaction gets balanced TransactionLines:

**For expenses (credit card charges):**
- DEBIT: Uncategorized Expense account (5999) for the amount
- CREDIT: The appropriate credit card liability account (2100-2104) for the amount

**For revenue (HoneyBook income):**
- DEBIT: Accounts Receivable (1100) or Cash (1000) for the amount
- CREDIT: Service Revenue (4000) for the amount

**Account mapping by source:**
| Source | Credit/Debit Account |
|--------|---------------------|
| csv:amex_gold | 2100 (Credit Card - Amex Gold) |
| csv:amex_reserve | 2101 (Credit Card - Amex Delta Reserve) |
| csv:amex_delta | 2102 (Credit Card - Amex Delta) |
| csv:amex_bonvoy | 2103 (Credit Card - Amex Bonvoy) |
| csv:venture | 2104 (Credit Card - Venture) |
| csv:honeybook | 1100 (Accounts Receivable) |

**Invariant:** For every transaction, `SUM(debit lines) === SUM(credit lines)`. Validate this before insert. If it doesn't balance, throw an error.

## Bulk Insert (`bulk-insert.ts`)

For each batch of normalized transactions:

1. Generate import hashes for all rows
2. Query DB for existing hashes (dedup)
3. Filter to new-only transactions
4. Within a Prisma `$transaction`:
   a. Create all Transaction records (status: PENDING)
   b. Create all TransactionLine records (balanced debits and credits)
   c. Write audit log entry: action=CREATE, resourceType=import, details={source, filename, count, entityId}
5. Return ImportResult: { imported: N, skipped: N, flagged: N, errors: [] }

If any insert fails, the entire batch rolls back. Log the error and report which rows failed.

## CLI Scripts

### `import-csv.ts`

```
Usage: bun run scripts/import-csv.ts <file> --source <source> --entity <entity> [--dry-run]

Options:
  --source    amex_gold | amex_reserve | amex_delta | amex_bonvoy | venture | honeybook
  --entity    anselai | r3studios | family
  --dry-run   Parse, validate, and report without inserting

Examples:
  bun run scripts/import-csv.ts /Volumes/reeseai-memory/FINANCIALS/amex-gold-2024.csv --source amex_gold --entity family
  bun run scripts/import-csv.ts /Volumes/reeseai-memory/FINANCIALS/venture-2025.csv --source venture --entity r3studios
  bun run scripts/import-csv.ts "/Volumes/reeseai-memory/FINANCIALS/January-2020-February-2026-Payments-report-(HoneyBook).csv" --source honeybook --entity anselai
```

Output:
```
Parsing: amex-gold-2024.csv (source: amex_gold, entity: family)
Parsed: 847 rows
Duplicates skipped: 0
Flagged for review: 2 (potential duplicates)
New transactions imported: 845
Journal entries created: 845 (1690 lines, all balanced)
Audit logged: import batch abc123
```

### `import-all.ts`

Imports all known files with preconfigured source/entity mappings:

```typescript
const IMPORT_MAP = [
  // Amex Gold → family (can be re-categorized later in Task 4)
  { glob: 'amex-gold-*.csv', source: 'amex_gold', entity: 'family' },
  { glob: 'amex-delta-reserve-*.csv', source: 'amex_reserve', entity: 'family' },
  { glob: 'amex-delta-*.csv', source: 'amex_delta', entity: 'family' },
  { glob: 'amex-bonvoy-*.csv', source: 'amex_bonvoy', entity: 'family' },
  { glob: 'venture-*.csv', source: 'venture', entity: 'family' },
  // HoneyBook → always anselai
  { glob: '*Payments-report-(HoneyBook).csv', source: 'honeybook', entity: 'anselai' },
];
```

Runs each import sequentially, reports combined results.

## Error Handling

- **Invalid CSV format:** Throw with specific error (expected headers vs actual headers)
- **Malformed rows:** Skip with warning logged, continue import. Report count of skipped rows.
- **Date parsing:** Handle MM/DD/YYYY (Amex) and YYYY-MM-DD (Venture). Reject unparseable dates.
- **Amount parsing:** Strip `$`, commas, spaces. Handle negative signs and parenthetical negatives `(123.45)`. Convert to cents immediately.
- **Empty files:** Warning, skip, report.
- **Database errors:** Roll back entire batch, report which step failed.
- **Missing account:** If the seed accounts don't exist (e.g., Task 1 seed wasn't run), fail loudly with clear error message.

## Acceptance Criteria

1. All 5 card parsers correctly parse their respective real CSV files from `/Volumes/reeseai-memory/FINANCIALS/`
2. HoneyBook payment parser extracts revenue data (completed payments only)
3. All amounts stored as BigInt cents (verify: `123456n` not `1234.56`)
4. Every imported transaction has balanced TransactionLines (SUM debits = SUM credits)
5. Transaction status is PENDING on import
6. Dedup prevents double-importing the same file (run import twice, second run shows 0 new)
7. `--dry-run` parses and reports without inserting
8. `import-csv.ts` successfully imports a real Amex Gold CSV
9. `import-all.ts` imports all 15+ files without errors
10. Audit log captures every import operation
11. Import hashes are SHA-256 per PRD spec
12. Merchant names are cleaned and normalized
13. Credit card expenses debit 5999 (Uncategorized) and credit the correct card liability account
14. HoneyBook revenue debits 1100 (AR) and credits 4000 (Service Revenue)
15. No TypeScript errors

## What NOT To Build

- No UI for imports (CLI only for now)
- No merchant learning / AI categorization (Task 4)
- No entity auto-routing (Task 4)
- No bank PDF OCR (Phase 2)
- No OFX/QFX parser (Phase 2)
- No Stripe/Square/PayPal API integration (Phase 2)
