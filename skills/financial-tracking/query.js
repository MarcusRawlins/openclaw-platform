const Database = require('better-sqlite3');

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
- transactions(id, date, description, amount, category, vendor, reference)
- invoices(id, invoice_number, client_name, amount, issued_date, due_date, paid_date, status)
- monthly_summary(month, total_revenue, total_expenses, net_income, expense_breakdown)
- accounts(id, name, type, description)`;

    const prompt = `Convert this question to a SQLite query.
Schema: ${schema}

Question: ${question}

Rules:
- Return ONLY the SQL query, nothing else
- Use strftime for date operations
- Revenue = positive amounts, Expenses = negative amounts
- For "last quarter": use date range calculation
- For "YTD": from Jan 1 of current year
- For "this month": current month (strftime('%Y-%m', 'now'))
- Always ORDER BY date DESC unless asked otherwise
- LIMIT 20 unless specified
- Use COALESCE for null safety

SQL query:`;

    try {
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
    } catch (err) {
      console.error('NL to SQL failed:', err.message);
      throw new Error('Could not convert question to SQL. Try being more specific.');
    }
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
      margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) + '%' : '0%'
    };
  }

  balanceSheet(asOfDate = null) {
    const date = asOfDate || new Date().toISOString().split('T')[0];
    this.logAccess('report:balance-sheet', `as of ${date}`, 'private');

    // Assets
    const assets = this.db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE date <= ? AND category IN ('asset', 'cash', 'accounts receivable', 'equipment')
      GROUP BY category
      ORDER BY total DESC
    `).all(date);

    // Liabilities
    const liabilities = this.db.prepare(`
      SELECT category, SUM(ABS(amount)) as total
      FROM transactions
      WHERE date <= ? AND category IN ('liability', 'accounts payable', 'loans')
      GROUP BY category
      ORDER BY total DESC
    `).all(date);

    // Calculate equity
    const totalAssets = assets.reduce((sum, a) => sum + a.total, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.total, 0);
    const equity = totalAssets - totalLiabilities;

    return {
      asOfDate: date,
      assets: { items: assets, total: totalAssets },
      liabilities: { items: liabilities, total: totalLiabilities },
      equity: { total: equity }
    };
  }

  openInvoices() {
    this.logAccess('report:invoices', 'open invoices', 'private');

    return this.db.prepare(`
      SELECT *,
        CASE 
          WHEN due_date < date('now') THEN 'overdue' 
          ELSE status 
        END as current_status,
        julianday(due_date) - julianday('now') as days_until_due
      FROM invoices
      WHERE status IN ('unpaid', 'overdue')
      ORDER BY due_date ASC
    `).all();
  }

  cashFlow(startDate, endDate) {
    this.logAccess('report:cashflow', `${startDate} to ${endDate}`, 'private');

    const inflows = this.db.prepare(`
      SELECT date, description, amount
      FROM transactions
      WHERE date BETWEEN ? AND ? AND amount > 0
      ORDER BY date DESC
    `).all(startDate, endDate);

    const outflows = this.db.prepare(`
      SELECT date, description, amount
      FROM transactions
      WHERE date BETWEEN ? AND ? AND amount < 0
      ORDER BY date DESC
    `).all(startDate, endDate);

    const totalInflows = inflows.reduce((sum, t) => sum + t.amount, 0);
    const totalOutflows = outflows.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      period: { start: startDate, end: endDate },
      inflows: { items: inflows, total: totalInflows },
      outflows: { items: outflows, total: totalOutflows },
      netCashFlow: totalInflows - totalOutflows
    };
  }

  monthlySummary(year = null) {
    const y = year || new Date().getFullYear();
    this.logAccess('report:monthly', `year ${y}`, 'private');

    return this.db.prepare(`
      SELECT * 
      FROM monthly_summary
      WHERE month LIKE ? || '%'
      ORDER BY month
    `).all(y);
  }

  topExpensesByCategory(startDate, endDate, limit = 10) {
    this.logAccess('report:top-expenses', `${startDate} to ${endDate}`, 'private');

    return this.db.prepare(`
      SELECT 
        category, 
        COUNT(*) as transaction_count,
        SUM(ABS(amount)) as total_amount,
        AVG(ABS(amount)) as avg_amount
      FROM transactions
      WHERE date BETWEEN ? AND ? AND amount < 0
      GROUP BY category
      ORDER BY total_amount DESC
      LIMIT ?
    `).all(startDate, endDate, limit);
  }

  revenueByVendor(startDate, endDate) {
    this.logAccess('report:revenue-by-vendor', `${startDate} to ${endDate}`, 'private');

    return this.db.prepare(`
      SELECT 
        vendor,
        COUNT(*) as transaction_count,
        SUM(amount) as total_revenue
      FROM transactions
      WHERE date BETWEEN ? AND ? AND amount > 0 AND vendor IS NOT NULL
      GROUP BY vendor
      ORDER BY total_revenue DESC
    `).all(startDate, endDate);
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
      UPDATE access_log 
      SET redacted = 1
      WHERE id = (SELECT MAX(id) FROM access_log)
    `).run();

    // Convert to directional language
    return results.map(row => {
      const redacted = { ...row };
      for (const [key, value] of Object.entries(redacted)) {
        if (typeof value === 'number' && (
          key.includes('amount') || 
          key.includes('revenue') || 
          key.includes('expense') || 
          key.includes('total') || 
          key.includes('income')
        )) {
          redacted[key] = '[REDACTED]';
        }
      }
      return redacted;
    });
  }

  close() {
    this.db.close();
  }
}

module.exports = FinancialQueryEngine;

// CLI usage
if (require.main === module) {
  const queryEngine = new FinancialQueryEngine();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  (async () => {
    try {
      switch (command) {
        case 'query':
          if (!args[0]) {
            console.error('Usage: node query.js query "your question here"');
            process.exit(1);
          }
          const results = await queryEngine.query(args.join(' '), 'private');
          console.table(results);
          break;

        case 'pnl':
          if (args.length < 2) {
            console.error('Usage: node query.js pnl <start-date> <end-date>');
            process.exit(1);
          }
          console.log(JSON.stringify(queryEngine.profitAndLoss(args[0], args[1]), null, 2));
          break;

        case 'balance-sheet':
          const date = args[0] || null;
          console.log(JSON.stringify(queryEngine.balanceSheet(date), null, 2));
          break;

        case 'invoices':
          console.table(queryEngine.openInvoices());
          break;

        case 'cashflow':
          if (args.length < 2) {
            console.error('Usage: node query.js cashflow <start-date> <end-date>');
            process.exit(1);
          }
          console.log(JSON.stringify(queryEngine.cashFlow(args[0], args[1]), null, 2));
          break;

        case 'monthly':
          const year = args[0] || null;
          console.table(queryEngine.monthlySummary(year));
          break;

        case 'top-expenses':
          if (args.length < 2) {
            console.error('Usage: node query.js top-expenses <start-date> <end-date> [limit]');
            process.exit(1);
          }
          console.table(queryEngine.topExpensesByCategory(args[0], args[1], parseInt(args[2]) || 10));
          break;

        default:
          console.log(`Usage:
  node query.js query "what was revenue..."     Natural language query
  node query.js pnl <start> <end>              Profit & Loss report
  node query.js balance-sheet [date]            Balance Sheet
  node query.js invoices                        Open invoices
  node query.js cashflow <start> <end>         Cash Flow report
  node query.js monthly [year]                  Monthly summaries
  node query.js top-expenses <start> <end>     Top expenses by category`);
      }

      queryEngine.close();
    } catch (err) {
      console.error('Error:', err.message);
      queryEngine.close();
      process.exit(1);
    }
  })();
}
