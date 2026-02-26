# Financial Tracking System Skill

**Status:** Production-ready  
**Cost:** Zero (local LLM, SQLite)  
**Confidentiality:** CRITICAL - Financial data is strictly private

## Overview

Complete financial management system with:
- CSV/Excel import with auto-detection and deduplication
- SQLite database (transactions, invoices, accounts, monthly summaries)
- Natural language queries (converts English → SQL via local LLM)
- Standard reports (P&L, Balance Sheet, open invoices)
- Strict confidentiality enforcement (dollar amount redaction, directional language)
- Access audit log (HIPAA-style tracking)
- CLI tool for all operations

## Database

**Location:** `/Volumes/reeseai-memory/data/finance/finance.db`

**Tables:**
- `accounts` - Chart of accounts (asset, liability, equity, revenue, expense)
- `transactions` - All debits/credits with automatic deduplication
- `invoices` - Client invoices with status tracking
- `monthly_summary` - Auto-calculated P&L by month
- `access_log` - Audit trail of all queries (confidentiality critical)

## Usage

### Initialize Database

```bash
node skills/financial-tracking/db-init.js
```

Creates tables, indexes, and schema. Safe to run multiple times.

### Import Data

```bash
node skills/financial-tracking/finance-cli.js import <file.csv|xlsx>
```

**Auto-detects file type:**
- `transactions` - If has "date", "amount", "description"
- `invoices` - If has "invoice", "client", "amount"
- `chart_of_accounts` - If has "account", "type"

**Deduplication:** Uses SHA256(date+amount+description) to prevent duplicates

**Example:**
```bash
finance-cli import QuickBooks-export.csv
```

### Natural Language Queries

```bash
node skills/financial-tracking/finance-cli.js query "How much revenue last month?"
```

**How it works:**
1. Your English question → sent to local LLM
2. LLM converts to SQL (via Mistral on LM Studio)
3. Query executes, results returned
4. Access logged for audit trail

**Examples:**
```bash
finance-cli query "What were our top 5 expenses?"
finance-cli query "How much did we spend on marketing in Q1?"
finance-cli query "Show all unpaid invoices over $5000"
finance-cli query "What's our year-to-date revenue?"
```

### Standard Reports

**Profit & Loss:**
```bash
finance-cli pnl 2026-01-01 2026-01-31
```

Shows revenue, expenses by category, net income, profit margin.

**Open Invoices:**
```bash
finance-cli invoices
```

Shows unpaid/overdue invoices, days until due.

**Monthly Trends:**
```bash
finance-cli trends 12
```

Shows last 12 months of revenue, expenses, net income.

**Access Audit:**
```bash
finance-cli audit 30
```

Shows all financial queries from last 30 days, redaction status.

### Confidentiality Guard

**Redact sensitive data:**
```bash
finance-cli redact "Revenue was $50,000 in January"
```

Output: `Revenue was [amount redacted] in January`

## Confidentiality Rules

### CRITICAL: Financial data is STRICTLY CONFIDENTIAL

**Private contexts (ALLOWED):**
- `private` - Direct message with Marcus
- `direct` - 1-on-1 chat
- `financials_channel` - Dedicated #financials channel
- `walt_analysis` - Walt's financial analysis

**Group contexts (BLOCKED):**
- `group` - Team chats, group channels
- `public` - Public channels, announcements

### Automatic Enforcement

**When sharing financial data in groups:**
1. Dollar amounts automatically redacted: `$50,000` → `[amount redacted]`
2. Use directional language: "Revenue trending up 15%" (no actual amount)
3. Access logged with `redacted=true` for audit trail
4. Bot refuses to send unredacted data to groups

**Example:**
```javascript
// Private context - allowed
result = engine.query("Q1 revenue?", context='private')
// → { results: [{amount: 50000}], redacted: false }

// Group context - automatically redacted
result = engine.query("Q1 revenue?", context='group')
// → { results: [{amount: '[REDACTED]'}], redacted: true }
```

## Integration Points

### With BI Council

Walt (Financial Guardian) reads from `finance.db`:
```javascript
const engine = new FinancialQueryEngine();
const pnl = engine.profitAndLoss('2026-01-01', '2026-12-31', 'private', 'walt');
// Walt gets full numbers, can analyze in isolation
```

### With Notification Queue

Monthly reminder via notification queue (high priority):
```json
{
  "notification": {
    "priority": "high",
    "text": "Monthly financial export reminder",
    "action": "Reminder to export latest from QuickBooks"
  }
}
```

### With Cron System

Monthly export reminder at 9 AM on 1st of month:
```bash
# Uses cron wrapper with job logging
*/1 * * * * /Users/marcusrawlins/.openclaw/workspace/skills/financial-tracking/cron-monthly-reminder.sh
```

## Security & Audit

### Access Audit Log

All queries logged:
```
agent | query                    | context           | redacted | accessed_at
------|-------------------------|-------------------|----------|---------------------
walt  | report:pnl 2026-01 ...  | walt_analysis     | false    | 2026-02-26 09:15:00
scout | query revenue last...   | group             | true     | 2026-02-26 08:42:00
ada   | query invoice status    | private           | false    | 2026-02-26 07:30:00
```

### What Gets Logged

✅ **WHO:** Agent/person who ran the query  
✅ **WHAT:** The actual query/question asked  
✅ **WHERE:** Context (private, group, channel)  
✅ **WHEN:** Timestamp  
✅ **WHETHER:** Was output redacted?

### Compliance

- No raw financial data in group chats (enforced at database level)
- All access tracked (can audit who accessed what)
- Redaction applied consistently (no exceptions)
- Directional language for safe group sharing

## Architecture

```
User Query (English)
         ↓
    Local LLM (Mistral on LM Studio)
    - Converts to SQL
    - Security-checked (SELECT only)
         ↓
    SQLite Query
         ↓
    Results + Context Check
         ↓
    Private? → Full data
    Group?  → Redacted + logged
         ↓
    Return to user
```

## Files

- `db-init.js` - Database schema initialization
- `import.js` - CSV/Excel import pipeline, auto-detection, deduplication
- `query.js` - Natural language query engine, standard reports
- `confidentiality.js` - Redaction, validation, context checks
- `finance-cli.js` - Command-line interface
- `cron-monthly-reminder.sh` - Monthly export reminder (created by cron system)

## Dependencies

- `better-sqlite3` - High-performance SQLite (already installed)
- `node-fetch` - HTTP requests to LM Studio (already installed)
- `xlsx` - Excel parsing (optional, CSV works without it)
- LM Studio with Mistral model (running on port 1234)

## Costs

- **API calls:** $0 (uses local LLM)
- **Database:** Included with SQLite
- **Compute:** Runs on local machine

## Examples

### Example 1: Monthly P&L Review

```bash
# Get January P&L
finance-cli pnl 2026-01-01 2026-01-31

# Output:
# 💰 Profit & Loss Report
# Period: 2026-01-01 to 2026-01-31
# 
# 📈 Revenue:
# category   | total
# photography | $12,500
# consulting | $3,200
# Total: $15,700
#
# 📉 Expenses:
# category    | total
# equipment   | $2,100
# marketing   | $1,400
# hosting     | $45
# Total: $3,545
#
# 🎯 Summary:
# Revenue: $15,700
# Expenses: $3,545
# Net Income: $12,155
# Profit Margin: 77.4%
```

### Example 2: Natural Language Query

```bash
finance-cli query "What was our biggest expense category last quarter?"

# Bot processes:
# 1. Converts to SQL via LLM
# 2. Query: SELECT category, SUM(ABS(amount)) as total FROM transactions WHERE ...
# 3. Results: [{category: 'equipment', total: 8900}]
# 4. Logs access to audit trail
```

### Example 3: Safe Group Sharing

```javascript
// Walt in BI Council (group context)
const result = await engine.query(
  "What was Q1 revenue?",
  context = 'group',  // Group chat
  agent = 'walt'
);

// Result comes back redacted:
// {
//   results: [{amount: '[REDACTED]'}],
//   redacted: true,
//   message: "Financial data redacted for group context"
// }

// Walt can generate directional message:
// "Revenue shows positive momentum this quarter"
```

### Example 4: Audit Trail Check

```bash
finance-cli audit 7

# Shows last 7 days of financial access:
# agent | query                | context    | redacted | accessed_at
# -----|---------------------|------------|----------|---------------------
# walt | report:pnl 2026-01  | private    | false    | 2026-02-26 09:15
# ada  | query revenue today | group      | true     | 2026-02-25 14:30
# ... (all accesses logged)
```

## Troubleshooting

### "LM Studio not running"

```bash
# Start LM Studio
lm-studio
# Choose: Mistral (or compatible model)
# Verify running on port 1234: http://127.0.0.1:1234
```

### Import fails with "Cannot auto-detect file type"

```bash
# Your CSV/Excel is missing expected columns
# Expected for transactions: date, amount, description
# Expected for invoices: invoice number, amount, client
# Expected for accounts: account name, type

# Check headers match expected columns
head -1 yourfile.csv
```

### "UNIQUE constraint failed: transactions.import_hash"

This is expected - means you imported the same data twice. System prevents duplicates automatically. Safe to ignore.

## Future Enhancements

- [ ] Direct QuickBooks API sync (instead of CSV export)
- [ ] Multi-currency support
- [ ] Budget vs actual analysis
- [ ] Cash flow forecasting
- [ ] Tax report generation
- [ ] Integration with Walt's BI analysis engine
- [ ] Custom report builder
- [ ] Balance sheet generation

## Support

For issues or questions:
1. Check audit log: `finance-cli audit 30`
2. Verify database: `ls -la /Volumes/reeseai-memory/data/finance/`
3. Test query engine: `finance-cli query "test"`
4. Review logs in Mission Control

---

**Created:** 2026-02-26  
**Last Updated:** 2026-02-26  
**Maintained by:** Brunel (builder), Walt (financial validation)
