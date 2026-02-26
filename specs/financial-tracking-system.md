# Financial Tracking System

**Priority:** High (BI Council depends on this for Walt's analysis)
**Estimated Time:** 3 days
**Dependencies:** Notification Queue (reminders), Cron Automation (scheduling)

## Goal

Import financial data from accounting exports (CSV/Excel), store in SQLite, provide natural language queries, generate standard reports (P&L, Balance Sheet), and enforce strict confidentiality rules (no dollar amounts in group chats, message redaction).

## Architecture

```
CSV/Excel Export (QuickBooks, etc.)
         ↓
┌─────────────────────────────────────┐
│     FINANCIAL TRACKING SYSTEM        │
├─────────────────────────────────────┤
│                                      │
│  1. Import Pipeline                  │
│     → Auto-detect file type          │
│     → Parse CSV/Excel                │
│     → Validate + deduplicate         │
│     → Insert into SQLite             │
│                                      │
│  2. Query Engine                     │
│     → Natural language → SQL         │
│     → Period calculations            │
│     → Standard reports (P&L, BS)     │
│                                      │
│  3. Confidentiality Layer            │
│     → Private-only enforcement       │
│     → Dollar amount redaction        │
│     → Directional language in groups │
│     → Access audit log               │
│                                      │
│  4. Reminders                        │
│     → Monthly export reminder        │
│     → Via notification queue         │
└─────────────────────────────────────┘
```

## Database Schema

**File:** `/Volumes/reeseai-memory/data/finance/finance.db`

```sql
-- Chart of accounts
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id INTEGER REFERENCES accounts(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (double-entry style)
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  description TEXT,
  reference TEXT,             -- check number, invoice number, etc.
  amount DECIMAL(10,2) NOT NULL,
  account_id INTEGER REFERENCES accounts(id),
  category TEXT,              -- revenue, expense subcategory
  vendor TEXT,
  source TEXT,                -- quickbooks, manual, import
  import_hash TEXT UNIQUE,    -- SHA256 of date+amount+description for dedup
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE,
  client_name TEXT,
  amount DECIMAL(10,2) NOT NULL,
  issued_date DATE,
  due_date DATE,
  paid_date DATE,
  status TEXT DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid', 'overdue', 'void')),
  notes TEXT,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly summaries (auto-calculated)
CREATE TABLE monthly_summary (
  month TEXT PRIMARY KEY,     -- YYYY-MM
  total_revenue DECIMAL(10,2),
  total_expenses DECIMAL(10,2),
  net_income DECIMAL(10,2),
  expense_breakdown TEXT,     -- JSON: { "marketing": 1200, "equipment": 500, ... }
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Access audit log
CREATE TABLE access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT,                 -- who accessed
  query TEXT,                 -- what was queried
  context TEXT,               -- private, group, api
  redacted BOOLEAN DEFAULT 0, -- was output redacted?
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_vendor ON transactions(vendor);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_date);
```

## Import Pipeline

**File:** `skills/financial-tracking/import.js`

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = '/Volumes/reeseai-memory/data/finance/finance.db';

class FinancialImporter {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  // Auto-detect file type from headers
  detectFileType(headers) {
    const h = headers.map(h => h.toLowerCase().trim());

    if (h.includes('debit') && h.includes('credit')) return 'transactions';
    if (h.includes('invoice') || h.includes('invoice number')) return 'invoices';
    if (h.includes('account') && h.includes('type')) return 'chart_of_accounts';
    if (h.includes('amount') && (h.includes('date') || h.includes('transaction date'))) return 'transactions';

    return 'unknown';
  }

  async importFile(filePath) {
    console.log(`Importing: ${filePath}`);

    const ext = filePath.split('.').pop().toLowerCase();
    let rows, headers;

    if (ext === 'csv') {
      ({ rows, headers } = this.parseCSV(filePath));
    } else if (['xlsx', 'xls'].includes(ext)) {
      ({ rows, headers } = await this.parseExcel(filePath));
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const fileType = this.detectFileType(headers);
    console.log(`Detected file type: ${fileType} (${rows.length} rows)`);

    switch (fileType) {
      case 'transactions':
        return this.importTransactions(rows, headers);
      case 'invoices':
        return this.importInvoices(rows, headers);
      case 'chart_of_accounts':
        return this.importAccounts(rows, headers);
      default:
        throw new Error(`Cannot auto-detect file type. Headers: ${headers.join(', ')}`);
    }
  }

  parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.replace(/"/g, '').trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i]; });
      return row;
    });
    return { rows, headers };
  }

  async parseExcel(filePath) {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headers = data[0].map(h => String(h).trim());
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    return { rows, headers };
  }

  importTransactions(rows, headers) {
    let imported = 0, skipped = 0;

    const dateCol = this.findColumn(headers, ['date', 'transaction date', 'trans date']);
    const amountCol = this.findColumn(headers, ['amount', 'total']);
    const descCol = this.findColumn(headers, ['description', 'memo', 'name']);
    const categoryCol = this.findColumn(headers, ['category', 'type', 'account']);
    const vendorCol = this.findColumn(headers, ['vendor', 'payee', 'name']);
    const refCol = this.findColumn(headers, ['reference', 'check', 'ref', 'num']);

    for (const row of rows) {
      const date = this.parseDate(row[dateCol]);
      const amount = this.parseAmount(row[amountCol] || row['Debit'] || row['Credit']);
      const desc = row[descCol] || '';

      if (!date || amount === null) { skipped++; continue; }

      // Dedup hash
      const hash = crypto.createHash('sha256')
        .update(`${date}|${amount}|${desc}`)
        .digest('hex');

      try {
        this.db.prepare(`
          INSERT INTO transactions (date, description, reference, amount, category, vendor, source, import_hash)
          VALUES (?, ?, ?, ?, ?, ?, 'import', ?)
        `).run(
          date,
          desc,
          row[refCol] || null,
          amount,
          row[categoryCol] || null,
          row[vendorCol] || null,
          hash
        );
        imported++;
      } catch (err) {
        if (err.message.includes('UNIQUE constraint')) {
          skipped++; // Duplicate
        } else {
          throw err;
        }
      }
    }

    // Recalculate monthly summaries
    this.recalculateSummaries();

    console.log(`✅ Imported ${imported} transactions (${skipped} skipped/duplicates)`);
    return { imported, skipped };
  }

  findColumn(headers, candidates) {
    const lower = headers.map(h => h.toLowerCase());
    for (const c of candidates) {
      const idx = lower.indexOf(c);
      if (idx >= 0) return headers[idx];
    }
    return null;
  }

  parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }

  parseAmount(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  recalculateSummaries() {
    const months = this.db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', date) as month FROM transactions ORDER BY month
    `).all();

    for (const { month } of months) {
      const revenue = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE strftime('%Y-%m', date) = ? AND amount > 0
      `).get(month).total;

      const expenses = this.db.prepare(`
        SELECT COALESCE(SUM(ABS(amount)), 0) as total
        FROM transactions
        WHERE strftime('%Y-%m', date) = ? AND amount < 0
      `).get(month).total;

      const breakdown = this.db.prepare(`
        SELECT category, SUM(ABS(amount)) as total
        FROM transactions
        WHERE strftime('%Y-%m', date) = ? AND amount < 0
        GROUP BY category
      `).all(month);

      this.db.prepare(`
        INSERT OR REPLACE INTO monthly_summary (month, total_revenue, total_expenses, net_income, expense_breakdown)
        VALUES (?, ?, ?, ?, ?)
      `).run(month, revenue, expenses, revenue - expenses, JSON.stringify(Object.fromEntries(breakdown.map(b => [b.category || 'uncategorized', b.total]))));
    }
  }
}

module.exports = new FinancialImporter();
```

## Natural Language Query Engine

**File:** `skills/financial-tracking/query.js`

```javascript
const Database = require('better-sqlite3');
const fetch = require('node-fetch');

const DB_PATH = '/Volumes/reeseai-memory/data/finance/finance.db';

class FinancialQueryEngine {
  constructor() {
    this.db = new Database(DB_PATH);
  }

  async query(naturalLanguage, context = 'private') {
    // Log access
    this.logAccess('query', naturalLanguage, context);

    // Convert natural language to SQL using local LLM
    const sql = await this.nlToSQL(naturalLanguage);

    // Execute query
    const results = this.db.prepare(sql).all();

    // Apply confidentiality rules
    if (context !== 'private') {
      return this.redact(results, naturalLanguage);
    }

    return results;
  }

  async nlToSQL(question) {
    const schema = `Tables:
- transactions(id, date, description, amount, category, vendor)
- invoices(id, invoice_number, client_name, amount, issued_date, due_date, paid_date, status)
- monthly_summary(month, total_revenue, total_expenses, net_income, expense_breakdown)
- accounts(id, name, type)`;

    const prompt = `Convert this question to a SQLite query.
Schema: ${schema}

Question: ${question}

Rules:
- Return ONLY the SQL query, nothing else
- Use strftime for date operations
- Revenue = positive amounts, Expenses = negative amounts
- For "last quarter": use date range calculation
- For "YTD": from Jan 1 of current year
- For "this month": current month
- Always ORDER BY date DESC unless asked otherwise
- LIMIT 20 unless specified`;

    const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3:4b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 200
      })
    });

    const data = await response.json();
    let sql = data.choices[0].message.content.trim();

    // Strip markdown code blocks if present
    sql = sql.replace(/```sql\n?/g, '').replace(/```/g, '').trim();

    // Safety: only allow SELECT
    if (!sql.toUpperCase().startsWith('SELECT')) {
      throw new Error('Only SELECT queries allowed');
    }

    return sql;
  }

  // Standard reports
  profitAndLoss(startDate, endDate) {
    this.logAccess('report:pnl', `${startDate} to ${endDate}`, 'private');

    const revenue = this.db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE date BETWEEN ? AND ? AND amount > 0
      GROUP BY category
      ORDER BY total DESC
    `).all(startDate, endDate);

    const expenses = this.db.prepare(`
      SELECT category, SUM(ABS(amount)) as total
      FROM transactions
      WHERE date BETWEEN ? AND ? AND amount < 0
      GROUP BY category
      ORDER BY total DESC
    `).all(startDate, endDate);

    const totalRevenue = revenue.reduce((sum, r) => sum + r.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);

    return {
      period: { start: startDate, end: endDate },
      revenue: { items: revenue, total: totalRevenue },
      expenses: { items: expenses, total: totalExpenses },
      netIncome: totalRevenue - totalExpenses,
      margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) : 0
    };
  }

  openInvoices() {
    this.logAccess('report:invoices', 'open invoices', 'private');

    return this.db.prepare(`
      SELECT *,
        CASE WHEN due_date < date('now') THEN 'overdue' ELSE status END as current_status,
        julianday(due_date) - julianday('now') as days_until_due
      FROM invoices
      WHERE status IN ('unpaid', 'overdue')
      ORDER BY due_date ASC
    `).all();
  }

  logAccess(agent, query, context) {
    this.db.prepare(`
      INSERT INTO access_log (agent, query, context)
      VALUES (?, ?, ?)
    `).run(agent, query, context);
  }

  // Redact dollar amounts for non-private contexts
  redact(results, query) {
    this.db.prepare(`
      INSERT INTO access_log (agent, query, context, redacted)
      VALUES (?, ?, 'group', 1)
    `).run('redactor', query);

    // Convert to directional language
    return results.map(row => {
      const redacted = { ...row };
      for (const [key, value] of Object.entries(redacted)) {
        if (typeof value === 'number' && (key.includes('amount') || key.includes('revenue') || key.includes('expense') || key.includes('total') || key.includes('income'))) {
          redacted[key] = '[REDACTED]';
        }
      }
      return redacted;
    });
  }
}

module.exports = new FinancialQueryEngine();
```

## Confidentiality Layer

**File:** `skills/financial-tracking/confidentiality.js`

```javascript
class ConfidentialityGuard {
  // Check if message contains dollar amounts
  containsDollarAmounts(text) {
    const patterns = [
      /\$[\d,]+\.?\d*/g,           // $1,234.56
      /\d+\.\d{2}\s*(dollars?)/gi,  // 1234.56 dollars
      /revenue.*\d+/gi,             // revenue 50000
      /expense.*\d+/gi,             // expense 1200
      /profit.*\d+/gi,              // profit 3000
      /income.*\d+/gi               // income 42000
    ];

    return patterns.some(p => p.test(text));
  }

  // Redact dollar amounts from outbound messages
  redactMessage(text) {
    let redacted = text;

    // Replace $X,XXX.XX patterns
    redacted = redacted.replace(/\$[\d,]+\.?\d*/g, '[amount redacted]');

    // Replace "X dollars" patterns
    redacted = redacted.replace(/\d+\.?\d*\s*(dollars?)/gi, '[amount redacted]');

    return redacted;
  }

  // Convert specific amounts to directional language
  toDirectionalLanguage(currentValue, previousValue, metricName) {
    if (!previousValue || previousValue === 0) return `${metricName}: data available`;

    const change = ((currentValue - previousValue) / previousValue * 100).toFixed(1);
    const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

    return `${metricName} trending ${direction} ${Math.abs(change)}%`;
  }

  // Check context and enforce rules
  shouldAllow(context, containsFinancialData) {
    if (!containsFinancialData) return { allowed: true };

    if (context === 'private' || context === 'direct') {
      return { allowed: true };
    }

    if (context === 'financials_channel') {
      return { allowed: true }; // Dedicated financials channel is OK
    }

    // Group chats: block or redact
    return {
      allowed: false,
      reason: 'Financial data cannot be shared in group chats',
      suggestion: 'Use directional language (e.g., "revenue trending up") without specific amounts'
    };
  }
}

module.exports = new ConfidentialityGuard();
```

## CLI

**File:** `skills/financial-tracking/finance-cli.js`

```javascript
#!/usr/bin/env node
const importer = require('./import');
const queryEngine = require('./query');

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'import':
    importer.importFile(args[0]).then(r => console.log(r));
    break;
  case 'query':
    queryEngine.query(args.join(' '), 'private').then(r => console.table(r));
    break;
  case 'pnl':
    console.log(queryEngine.profitAndLoss(args[0], args[1]));
    break;
  case 'invoices':
    console.table(queryEngine.openInvoices());
    break;
  default:
    console.log(`Usage:
  finance import <file.csv>              Import transactions/invoices
  finance query "what was revenue..."    Natural language query
  finance pnl <start> <end>             Profit & Loss report
  finance invoices                       Open invoices`);
}
```

## Cron: Monthly Reminder

```json
{
  "name": "Financial: Monthly Export Reminder (1st of month)",
  "schedule": { "kind": "cron", "expr": "0 9 1 * *", "tz": "America/New_York" },
  "payload": {
    "kind": "systemEvent",
    "text": "Remind Tyler to export latest financial data from QuickBooks. Send via notification queue as high priority."
  },
  "sessionTarget": "main",
  "enabled": true
}
```

## Deliverables

- [ ] SQLite financial database with schema
- [ ] Import pipeline (CSV + Excel, auto-detect, dedup)
- [ ] Natural language query engine (local LLM)
- [ ] Standard reports (P&L, Balance Sheet, open invoices)
- [ ] Confidentiality guard (redaction, directional language, context enforcement)
- [ ] Access audit log
- [ ] CLI tool (import, query, reports)
- [ ] Monthly reminder cron
- [ ] Integration with BI Council (Walt reads from this DB)
- [ ] Documentation in SKILL.md
- [ ] Git commit: "feat: financial tracking with confidentiality"

## Integration Points

- **BI Council:** Walt (Financial Guardian) reads from finance.db
- **Notification Queue:** Monthly export reminders route through queue
- **Cron System:** Import + reminder jobs use cron wrapper
- **Confidentiality:** All outbound financial messages checked before sending
