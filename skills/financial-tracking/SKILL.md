# Financial Tracking System

**Version:** 1.0.0  
**Author:** Brunel Edison  
**Priority:** High (BI Council dependency)

## Overview

Complete financial data management system with CSV/Excel import, natural language querying, standard reports (P&L, Balance Sheet, Cash Flow), and strict confidentiality enforcement.

## Features

✅ Auto-detect and import CSV/Excel files (transactions, invoices, accounts)  
✅ Deduplication (SHA256 hash prevents duplicate imports)  
✅ Natural language to SQL queries (via local LLM)  
✅ Standard financial reports (P&L, Balance Sheet, Cash Flow, Open Invoices)  
✅ Confidentiality layer (automatic redaction for group chats)  
✅ Audit trail (all queries logged)  
✅ Monthly summaries (auto-calculated)  
✅ CLI tool for all operations

## Database

**Location:** `/Volumes/reeseai-memory/data/finance/finance.db`

**Tables:**
- `accounts` - Chart of accounts
- `transactions` - All financial transactions (double-entry ready)
- `invoices` - Invoice tracking with status
- `monthly_summary` - Auto-calculated monthly rollups
- `access_log` - Audit trail of all queries

## Installation

```bash
cd /Users/marcusrawlins/.openclaw/workspace/skills/financial-tracking
bun install
```

## Usage

### Import Data

```bash
# Auto-detect file type and import
node finance.js import ~/Downloads/transactions-2026.csv

# Imports transactions, invoices, or chart of accounts
# Automatically deduplicates based on hash
```

**Supported formats:**
- CSV files (transactions, invoices, accounts)
- Excel files (.xlsx, .xls)

**Auto-detection:**
- Transactions: columns include "date" + "amount"
- Invoices: columns include "invoice" + "amount"
- Accounts: columns include "account" + "type"

### Query Data

```bash
# Natural language query (private context)
node finance.js query "what was our revenue last month?"

# Query with non-private context (amounts redacted)
node finance.js query "what was revenue last month" --context=group
```

### Standard Reports

```bash
# Profit & Loss
node finance.js pnl 2026-01-01 2026-01-31

# Balance Sheet (as of date)
node finance.js balance-sheet 2026-02-27

# Open Invoices
node finance.js invoices

# Cash Flow
node finance.js cashflow 2026-01-01 2026-01-31

# Monthly Summary
node finance.js monthly 2026

# Top Expenses by Category
node finance.js top-expenses 2026-01-01 2026-01-31 10
```

### Confidentiality Validation

```bash
# Check if message is safe for context
node finance.js validate-message "Revenue was $50k last month" group
# ❌ BLOCKED - Financial data cannot be shared in group chats
# Suggestion: Use directional language (e.g., "revenue trending up 12%")
```

## Confidentiality Rules

### Private Contexts (ALLOWED)
- Direct messages to Tyler
- Private chat with Marcus
- `#financials` dedicated channel

### Group Contexts (BLOCKED)
- Dollar amounts are automatically redacted
- Use directional language instead:
  - ✅ "Revenue trending up 15% this month"
  - ❌ "Revenue was $50,000 this month"

### Automatic Redaction
The confidentiality guard automatically:
- Detects dollar amounts in messages
- Redacts specific numbers
- Suggests directional language alternatives
- Logs all access attempts

## Natural Language Query Examples

```bash
"what was our revenue last month?"
"show me expenses over $1000 in January"
"which vendors did we pay the most?"
"how much did we spend on marketing last quarter?"
"what's our profit margin year-to-date?"
```

The system converts these to SQL using local LLM (qwen3:4b).

## Programmatic Usage

### Import Module

```javascript
const FinancialImporter = require('./import');

const importer = new FinancialImporter();

const result = await importer.importFile('/path/to/transactions.csv');
// { imported: 150, skipped: 5, type: 'transactions' }

importer.close();
```

### Query Module

```javascript
const FinancialQueryEngine = require('./query');

const queryEngine = new FinancialQueryEngine();

// Natural language query
const results = await queryEngine.query("what was revenue last month?", 'private');

// Standard reports
const pnl = queryEngine.profitAndLoss('2026-01-01', '2026-01-31');
const invoices = queryEngine.openInvoices();
const cashflow = queryEngine.cashFlow('2026-01-01', '2026-01-31');

queryEngine.close();
```

### Confidentiality Guard

```javascript
const ConfidentialityGuard = require('./confidentiality');

// Validate message safety
const result = ConfidentialityGuard.validate(
  "Revenue was $50,000 last month",
  'group'
);

if (!result.safe) {
  console.log(result.reason);          // "Financial data cannot be shared in group chats"
  console.log(result.redactedMessage); // "Revenue was [amount redacted] last month"
}

// Convert to directional language
const safe = ConfidentialityGuard.toDirectionalLanguage(50000, 45000, 'Revenue');
// "Revenue trending up 11.1%"
```

## File Format Examples

### Transactions CSV

```csv
Date,Description,Amount,Category,Vendor
2026-01-15,Website redesign payment,5000.00,Revenue,Acme Corp
2026-01-16,Camera lens purchase,-1200.00,Equipment,B&H Photo
2026-01-17,Marketing ads,-300.00,Marketing,Google Ads
```

### Invoices CSV

```csv
Invoice Number,Client Name,Amount,Issued Date,Due Date,Status
INV-2026-001,Smith Wedding,3500.00,2026-01-10,2026-02-10,unpaid
INV-2026-002,Jones Portrait,800.00,2026-01-15,2026-02-15,paid
```

### Accounts CSV

```csv
Account Name,Type,Description
Cash,asset,Operating cash account
Equipment,asset,Camera gear and equipment
Accounts Payable,liability,Unpaid vendor bills
Photography Revenue,revenue,Client payments
Marketing,expense,Advertising and promotion
```

## Integration Points

### Mission Control
- Financial dashboard pulls from `finance.db`
- Real-time P&L, cash flow, invoice tracking
- Monthly revenue/expense charts

### BI Council (Walt)
- Walt (Financial Guardian) has read access to `finance.db`
- Can run queries and generate reports
- Enforces confidentiality rules before outputting results

### Cron Jobs
- Monthly reminder to export QuickBooks data (1st of month, 9am)
- Auto-import if Tyler uploads to watched folder

## Audit Trail

All queries are logged in `access_log` table:

```sql
SELECT * FROM access_log ORDER BY accessed_at DESC LIMIT 10;
```

Includes:
- Who queried (agent name)
- What was queried (question or report type)
- Context (private, group, api)
- Whether output was redacted
- Timestamp

## Next Steps

1. ✅ Database schema created
2. ✅ Import pipeline built
3. ✅ Query engine with NL support
4. ✅ Confidentiality layer
5. ✅ CLI tool
6. ⏳ Mission Control UI integration (next phase)
7. ⏳ Cron job for monthly reminders
8. ⏳ Walt BI Council integration

## Testing

```bash
# Test import
echo "Date,Description,Amount
2026-01-01,Test transaction,100.00" > /tmp/test.csv

node finance.js import /tmp/test.csv

# Test query
node finance.js query "show me all transactions"

# Test reports
node finance.js monthly 2026

# Test confidentiality
node confidentiality.js
```

## Maintenance

- **Backups:** finance.db is included in nightly backup
- **Cleanup:** Old access_log entries can be archived after 1 year
- **Updates:** Monthly summaries recalculate automatically on import

## Security

- ✅ Only SELECT queries allowed (no DELETE/UPDATE via NL query)
- ✅ Access audit trail
- ✅ Confidentiality enforcement
- ✅ Group chat redaction
- ✅ Context-aware permissions

## Support

Questions? Contact:
- Brunel Edison (builder)
- Marcus Rawlins (chief of staff)
- Walt (financial guardian, BI Council)
