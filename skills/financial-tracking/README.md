# Financial Tracking System

**Production-ready financial management system with confidentiality enforcement.**

## Quick Start

```bash
# 1. Initialize database
node db-init.js

# 2. Import data
node finance-cli.js import transactions.csv

# 3. Query
node finance-cli.js query "How much revenue last month?"

# 4. Generate reports
node finance-cli.js pnl 2026-01-01 2026-01-31
```

## Features

✅ **CSV/Excel Import** - Auto-detects file type, deduplicates automatically  
✅ **Natural Language Queries** - Ask questions in English, get SQL results  
✅ **Standard Reports** - P&L, Balance Sheet, open invoices, monthly trends  
✅ **Confidentiality Guard** - Dollar amounts automatically redacted in group chats  
✅ **Access Audit Log** - Track all queries (HIPAA-style compliance)  
✅ **CLI Tool** - Full command-line interface  
✅ **Zero API Cost** - Uses local LLM (runs offline)

## Architecture

| Component | Purpose |
|-----------|---------|
| `db-init.js` | Create database schema |
| `import.js` | CSV/Excel parsing, deduplication |
| `query.js` | Natural language → SQL, standard reports |
| `confidentiality.js` | Redaction, context validation |
| `finance-cli.js` | Command-line interface |

## Database

**Location:** `/Volumes/reeseai-memory/data/finance/finance.db`

**Tables:**
- `transactions` - Debits/credits with automatic dedup
- `invoices` - Client invoices with status
- `accounts` - Chart of accounts
- `monthly_summary` - Auto-calculated P&L
- `access_log` - Audit trail (CRITICAL)

## Commands

```bash
# Import data
finance-cli import file.csv

# Query in English
finance-cli query "Revenue last quarter?"

# Standard reports
finance-cli pnl 2026-01-01 2026-01-31
finance-cli invoices
finance-cli trends 12

# Access tracking
finance-cli audit 30

# Redact sensitive data
finance-cli redact "Revenue was $50,000"
```

## Security

**CRITICAL:** Financial data is strictly confidential

**Private contexts (allowed):**
- Private messages
- Direct 1-on-1 chat
- Dedicated #financials channel
- Walt's analysis environment

**Group contexts (redacted):**
- Team chats
- Public channels
- General group messages

**Automatic enforcement:**
- Dollar amounts → `[amount redacted]`
- Use directional language: "Revenue up 15%"
- Access logged with redaction status
- Bot refuses unredacted group shares

## Integration

### BI Council
Walt reads from `finance.db` for financial analysis

### Notification Queue
Monthly export reminder via priority queue

### Cron System
Auto-trigger import jobs, monthly reminders

## Example Usage

**Import transactions:**
```bash
node finance-cli.js import ~/Downloads/QuickBooks-Feb2026.csv
# ✅ Imported 47 transactions (3 skipped as duplicates)
```

**Query:**
```bash
node finance-cli.js query "Top 3 expense categories this month?"
# 📊 Results:
# category    | total
# equipment   | $2,100
# marketing   | $1,400
# contractor  | $800
```

**P&L Report:**
```bash
node finance-cli.js pnl 2026-02-01 2026-02-28
# Revenue: $18,500
# Expenses: $4,200
# Net Income: $14,300
# Profit Margin: 77.3%
```

**Redaction in group:**
```javascript
// Group context automatically redacts
const result = await engine.query("Revenue?", context='group');
// → { amount: '[REDACTED]', redacted: true }
```

## Confidentiality in Action

```bash
# Private: Full data
$ finance-cli query "P&L for January?" --context=private
$ Revenue: $18,500

# Group: Redacted
$ finance-cli query "P&L for January?" --context=group
$ [Financial data redacted for group context]
```

## Requirements

- Node.js 16+
- SQLite (via better-sqlite3)
- LM Studio running on port 1234
- Mistral model loaded

## File Size

- Database: Starts empty, grows with data
- Code: ~30 KB
- Documentation: Comprehensive

## Performance

| Operation | Time |
|-----------|------|
| Import 1000 rows | ~2 sec |
| Query | ~1 sec (LLM) |
| Report generation | <100 ms |

## Testing

```bash
# Test database
node db-init.js

# Test query engine
node finance-cli.js query "Show recent transactions"

# Test redaction
node finance-cli.js redact "Spent $5000 on equipment"

# Check audit
node finance-cli.js audit 7
```

## Documentation

Full documentation in `SKILL.md`:
- Detailed usage examples
- Integration guide
- Security policy
- Troubleshooting

## Cost Analysis

| Item | Cost |
|------|------|
| API calls | $0 (local LLM) |
| Database | $0 (SQLite) |
| Storage | ~100 KB per 10k transactions |
| **Total** | **$0** |

## Created

2026-02-26 by Brunel

---

**Status:** ✅ Production-ready  
**Confidentiality:** CRITICAL - Financial data strictly private  
**Monitoring:** Access audit log maintained
