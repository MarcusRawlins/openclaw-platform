# Finance Hub — Task 23: QuickBooks Export + SQLite Migration

> 🦞 Marcus Rawlins | Spec v1.0 | 2026-02-28
> Parent PRD: `/workspace/specs/finance-hub-prd.md` (Sections 10, 15)
> Phase 4 Overview: `/workspace/specs/fh-phase4-overview.md`
> Review: Walt must score 95%+. Marcus (Opus) must score 99%+.

---

## Objective

Two distinct pieces: (1) Export financial data in QuickBooks-compatible formats so Tyler can hand off to his CPA without friction, and (2) migrate historical data from Brunel's SQLite prototype into Finance Hub.

## Build Location

`/Users/marcusrawlins/.openclaw/workspace/finance-hub/`

## Part 1: QuickBooks Export

### Export Formats

Support two formats:
1. **QuickBooks Desktop IIF** (Intuit Interchange Format) — tab-delimited, legacy but widely supported
2. **QuickBooks Online CSV** — modern, simpler

### IIF Format

IIF files use headers to define record types:

```
!TRNS	TRNSID	TRNSTYPE	DATE	ACCNT	NAME	AMOUNT	MEMO
!SPL	SPLID	TRNSTYPE	DATE	ACCNT	NAME	AMOUNT	MEMO
!ENDTRNS
TRNS		GENERAL JOURNAL	01/15/2026	Checking		-4250	Amazon purchase
SPL		GENERAL JOURNAL	01/15/2026	Office Supplies		4250	Amazon purchase
ENDTRNS
```

Key rules:
- `TRNS` line is the primary entry (debit side)
- `SPL` lines are the splits (credit side)
- `ENDTRNS` closes the transaction
- Amounts are in dollars (not cents) for IIF
- Date format: MM/DD/YYYY
- Tab-delimited (not comma)

### CSV Format (QuickBooks Online)

```csv
Date,Description,Account,Debit,Credit,Name,Memo
01/15/2026,Amazon purchase,Office Supplies,42.50,,Amazon,
01/15/2026,Amazon purchase,Credit Card - Amex Gold,,42.50,Amazon,
```

### Export Architecture

```
src/lib/export/
├── quickbooks-iif.ts      # IIF format generator
├── quickbooks-csv.ts      # QBO CSV format generator
├── export-utils.ts        # Shared: date formatting, amount conversion, sanitization

src/app/api/v1/export/
├── quickbooks/route.ts    # GET — generate and download export file

src/app/(dashboard)/[entity]/export/
└── page.tsx               # Export UI
```

### Export UI (`export/page.tsx`)

```
┌── Export Financial Data ─────────────────────┐
│                                               │
│  Entity: [AnselAI ▼]                         │
│  Period: [Q1 2026 ▼]  (or custom date range) │
│  Format: ○ QuickBooks Desktop (IIF)          │
│          ○ QuickBooks Online (CSV)            │
│          ○ Generic CSV                        │
│                                               │
│  Include:                                     │
│  ☑ Transactions                               │
│  ☑ Chart of Accounts                          │
│  ☑ Invoices                                   │
│  ☐ Budgets                                    │
│                                               │
│  [Preview]  [Download]                        │
└───────────────────────────────────────────────┘
```

Preview shows first 20 rows of the export in a table before downloading.

### Chart of Accounts Export

Also export the Chart of Accounts in IIF format:
```
!ACCNT	NAME	ACCNTTYPE	DESC
ACCNT	Checking	BANK	Primary checking account
ACCNT	Office Supplies	EXP	Office supplies and materials
```

Map Finance Hub account types to QuickBooks types:
| FH Type | QB Type |
|---------|---------|
| ASSET | BANK or OASSET |
| LIABILITY | CCARD or LTLIAB |
| EQUITY | EQUITY |
| REVENUE | INC |
| EXPENSE | EXP |

### Export API

```
GET /api/v1/export/quickbooks?entityId=X&from=2026-01-01&to=2026-03-31&format=iif
GET /api/v1/export/quickbooks?entityId=X&from=2026-01-01&to=2026-03-31&format=csv
```

Returns file download with appropriate Content-Type and Content-Disposition headers.

## Part 2: SQLite Prototype Migration

### Prototype Location

Brunel's Phase 1 prototype used SQLite. Location: check `/workspace/finance-hub/` for any `.db` or `.sqlite` files, or ask Tyler.

### Migration Strategy

1. **Discover:** Read SQLite schema to understand table structure
2. **Map:** Create mapping from prototype tables → Finance Hub Prisma models
3. **Extract:** Read all data from SQLite
4. **Transform:** Convert to Finance Hub format (BIGINT cents, proper double-entry, UUIDs)
5. **Dedup:** Check against existing Finance Hub data (by date + amount + description hash)
6. **Load:** Insert into PostgreSQL via Prisma
7. **Verify:** Count comparison (SQLite rows vs PG rows), total amount comparison

### Migration Script

```
src/scripts/
└── migrate-sqlite.ts      # One-time migration script
```

Run with: `bun run src/scripts/migrate-sqlite.ts`

```typescript
import Database from 'bun:sqlite';

async function migrateSQLite(dbPath: string, entityId: string) {
  const sqlite = new Database(dbPath, { readonly: true });
  
  // 1. Read all transactions
  const rows = sqlite.query('SELECT * FROM transactions ORDER BY date ASC').all();
  
  // 2. Transform each row
  for (const row of rows) {
    const amountCents = BigInt(Math.round(row.amount * 100)); // prototype likely used floats
    const dedupHash = generateDedupHash(entityId, new Date(row.date), amountCents, normalizeDescription(row.description), accountId);
    
    // 3. Check for existing
    const existing = await checkExistingByHash(dedupHash);
    if (existing) {
      stats.skipped++;
      continue;
    }
    
    // 4. Insert with proper double-entry
    await createTransaction({
      entityId,
      date: new Date(row.date),
      description: row.description,
      amountCents,
      categoryId: mapCategory(row.category),
      accountId: mapAccount(row.account),
      status: 'CLEARED',
      source: 'sqlite-migration',
    });
    stats.migrated++;
  }
  
  // 5. Verify
  const pgCount = await countTransactions(entityId);
  console.log(`Migration complete: ${stats.migrated} migrated, ${stats.skipped} skipped (duplicates), ${pgCount} total in PG`);
}
```

### Idempotency

The script MUST be idempotent. Running it twice should produce the same result (all duplicates skipped on second run). This is guaranteed by the dedup hash check.

### Migration Report

After migration, generate a summary:
```
SQLite Migration Report
=======================
Source: /path/to/prototype.db
Entity: AnselAI

Rows in SQLite: 2,551
Migrated: 2,412
Skipped (duplicates): 139
Failed: 0

Amount validation:
  SQLite total: $142,350.00
  PG total:     $142,350.00
  Difference:   $0.00 ✅
```

Save report to `/Volumes/reeseai-memory/data/finance-hub/migration-report.md`.

## Sidebar Navigation

Add "Export" to entity sidebar:
```
📊 Dashboard
💳 Transactions
📥 Import
✅ Review
📄 Invoices
🔄 Recurring
💰 Budget
📈 Reports
📉 Forecast
📤 Export         ← This task
🏷️ Categorize
```

## Testing Requirements

### Export Tests
1. **IIF format:** Generate IIF from 10 transactions, validate tab-delimited format, amounts in dollars
2. **CSV format:** Generate CSV, validate comma-separated, proper escaping of descriptions with commas
3. **Chart of Accounts:** Export accounts in IIF, verify QB type mapping
4. **Date range:** Export Q1 only, verify no Q2 data included
5. **Empty period:** Export period with no data, verify valid empty file (headers only)
6. **Round-trip:** Export IIF, import into QuickBooks test (manual verification, not automated)

### Migration Tests
1. **Idempotency:** Run migration twice, verify same count
2. **Amount conversion:** Float $42.50 → BigInt 4250
3. **Dedup:** Pre-import same data via CSV, run migration, verify all skipped
4. **Totals match:** Sum of SQLite amounts equals sum of PG amounts
5. **Edge cases:** Null descriptions, zero amounts, future dates

## Constraints

- **Money is BIGINT cents** in PG. IIF export converts to dollars. CSV export uses dollars with 2 decimal places.
- **SQLite migration is one-time.** Not a sync. After migration, the prototype is archived.
- **Prototype data quality is unknown.** Expect messy descriptions, possible missing fields, float precision issues. Handle gracefully.
- **IIF is tab-delimited.** Tabs in descriptions must be stripped or replaced with spaces.
- **Export files are confidential.** Include "CONFIDENTIAL" watermark in filename: `anselai-q1-2026-CONFIDENTIAL.iif`
