#!/usr/bin/env node
/**
 * Financial Query Engine
 * Natural language queries via local LLM, standard reports, confidentiality tracking
 */

const Database = require('better-sqlite3');
const fetch = require('node-fetch');

const DB_PATH = '/Volumes/reeseai-memory/data/finance/finance.db';
const LM_STUDIO_URL = 'http://127.0.0.1:1234/v1';

class FinancialQueryEngine {
  constructor() {
    this.db = new Database(DB_PATH);
  }

  /**
   * Query using natural language via local LLM
   */
  async query(naturalLanguage, context = 'private', agent = 'unknown') {
    console.log(`\n📝 Query: "${naturalLanguage}" (context: ${context})`);

    // Log access attempt
    this.logAccess(agent, naturalLanguage, context, false);

    try {
      // Convert NL to SQL
      const sql = await this.nlToSQL(naturalLanguage);
      console.log(`\n🔍 Generated SQL: ${sql.substring(0, 100)}...`);

      // Execute
      const results = this.db.prepare(sql).all();

      // Apply confidentiality rules
      if (context !== 'private' && context !== 'direct' && context !== 'financials_channel') {
        const redacted = this.redact(results, agent);
        this.logAccess(agent, naturalLanguage, context, true); // Mark as redacted
        return {
          results: redacted,
          redacted: true,
          message: 'Financial data redacted for group context'
        };
      }

      return {
        results,
        redacted: false
      };
    } catch (err) {
      console.error('Query error:', err.message);
      throw err;
    }
  }

  /**
   * Convert natural language to SQL using local LLM
   */
  async nlToSQL(question) {
    const schema = `
Tables:
- transactions(id, date, description, amount, category, vendor, source)
- invoices(id, invoice_number, client_name, amount, issued_date, due_date, paid_date, status)
- monthly_summary(month, total_revenue, total_expenses, net_income, expense_breakdown)
- accounts(id, name, type)

Rules:
- Revenue = positive amounts, Expenses = negative amounts
- Use strftime for date operations
- "last month" = previous month
- "this month" = current month
- "quarter" = 3-month period
- "YTD" = Jan 1 of current year to today
- Always ORDER BY date DESC unless asked otherwise
- LIMIT results to 20 unless specified differently
`;

    const prompt = `You are a SQL expert. Convert this question into a SQLite query.

Schema: ${schema}

Question: ${question}

Return ONLY the SQL query, no explanation or code blocks.`;

    try {
      const response = await fetch(`${LM_STUDIO_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistral',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 250,
          stream: false
        }),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`LLM error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.choices || !data.choices[0]) {
        throw new Error('Invalid LLM response');
      }

      let sql = data.choices[0].message.content.trim();

      // Clean up if wrapped in code blocks
      sql = sql.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();

      // Safety: only allow SELECT
      if (!sql.toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries allowed');
      }

      // Validate query compiles
      this.db.prepare(sql);

      return sql;
    } catch (err) {
      if (err.message.includes('connect') || err.message.includes('ECONNREFUSED')) {
        throw new Error('LM Studio not running. Start it with: lm-studio');
      }
      throw err;
    }
  }

  /**
   * Profit & Loss report
   */
  profitAndLoss(startDate, endDate, context = 'private', agent = 'unknown') {
    this.logAccess(agent, `report:pnl ${startDate} to ${endDate}`, context);

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

    const totalRevenue = revenue.reduce((sum, r) => sum + parseFloat(r.total), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.total), 0);
    const netIncome = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? ((netIncome / totalRevenue) * 100).toFixed(1) : 0;

    const result = {
      period: { start: startDate, end: endDate },
      revenue: {
        items: revenue,
        total: parseFloat(totalRevenue.toFixed(2))
      },
      expenses: {
        items: expenses,
        total: parseFloat(totalExpenses.toFixed(2))
      },
      netIncome: parseFloat(netIncome.toFixed(2)),
      margin: parseFloat(margin)
    };

    // Apply confidentiality rules
    if (context !== 'private') {
      return this.redactPnL(result, agent);
    }

    return result;
  }

  /**
   * Open invoices report
   */
  openInvoices(context = 'private', agent = 'unknown') {
    this.logAccess(agent, 'report:invoices', context);

    const invoices = this.db.prepare(`
      SELECT *,
        CASE 
          WHEN status = 'paid' THEN 'paid'
          WHEN due_date < date('now') AND status != 'paid' THEN 'overdue'
          ELSE status
        END as current_status,
        CAST(julianday(due_date) - julianday('now') AS INTEGER) as days_until_due
      FROM invoices
      WHERE status IN ('unpaid', 'overdue') OR (status = 'paid' AND paid_date >= date('now', '-30 days'))
      ORDER BY due_date ASC
    `).all();

    // Apply confidentiality
    if (context !== 'private') {
      return this.redactInvoices(invoices, agent);
    }

    return invoices;
  }

  /**
   * Monthly trends
   */
  monthlyTrends(months = 12, context = 'private', agent = 'unknown') {
    this.logAccess(agent, `report:trends ${months}m`, context);

    const trends = this.db.prepare(`
      SELECT month, total_revenue, total_expenses, net_income
      FROM monthly_summary
      ORDER BY month DESC
      LIMIT ?
    `).all(months);

    // Reverse to chronological order
    trends.reverse();

    if (context !== 'private') {
      return this.redactTrends(trends, agent);
    }

    return trends;
  }

  /**
   * Redact sensitive amounts from results
   */
  redact(results, agent) {
    if (!Array.isArray(results)) {
      return results;
    }

    return results.map(row => {
      const redacted = { ...row };
      for (const [key, value] of Object.entries(redacted)) {
        // Redact numeric fields that contain financial data
        if (typeof value === 'number' && this.isSensitiveField(key)) {
          redacted[key] = '[REDACTED]';
        }
      }
      return redacted;
    });
  }

  redactPnL(pnl, agent) {
    return {
      period: pnl.period,
      revenue: {
        items: pnl.revenue.items.map(item => ({
          category: item.category,
          total: '[REDACTED]'
        })),
        total: '[REDACTED]'
      },
      expenses: {
        items: pnl.expenses.items.map(item => ({
          category: item.category,
          total: '[REDACTED]'
        })),
        total: '[REDACTED]'
      },
      netIncome: '[REDACTED]',
      margin: '[REDACTED]'
    };
  }

  redactInvoices(invoices, agent) {
    return invoices.map(inv => ({
      ...inv,
      amount: '[REDACTED]',
      client_name: inv.client_name ? `${inv.client_name.substring(0, 1)}***` : '[REDACTED]'
    }));
  }

  redactTrends(trends, agent) {
    return trends.map(trend => ({
      month: trend.month,
      total_revenue: '[REDACTED]',
      total_expenses: '[REDACTED]',
      net_income: '[REDACTED]'
    }));
  }

  isSensitiveField(fieldName) {
    const sensitivePatterns = [
      'amount', 'total', 'revenue', 'expense', 'income', 
      'profit', 'loss', 'price', 'cost', 'value', 'rate'
    ];
    const lower = fieldName.toLowerCase();
    return sensitivePatterns.some(p => lower.includes(p));
  }

  /**
   * Log all access for audit trail
   */
  logAccess(agent, query, context = 'private', redacted = false) {
    try {
      this.db.prepare(`
        INSERT INTO access_log (agent, query, context, redacted)
        VALUES (?, ?, ?, ?)
      `).run(agent, query, context, redacted ? 1 : 0);
    } catch (err) {
      console.error('Failed to log access:', err.message);
    }
  }

  /**
   * Get access audit log
   */
  getAuditLog(days = 30) {
    return this.db.prepare(`
      SELECT agent, query, context, redacted, accessed_at
      FROM access_log
      WHERE accessed_at >= datetime('now', '-' || ? || ' days')
      ORDER BY accessed_at DESC
    `).all(days);
  }

  close() {
    this.db.close();
  }
}

module.exports = FinancialQueryEngine;

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  const engine = new FinancialQueryEngine();

  (async () => {
    try {
      switch (command) {
        case 'query':
          const question = args.join(' ');
          const result = await engine.query(question, 'private', 'cli');
          console.log('\n📊 Results:');
          console.table(result.results);
          break;

        case 'pnl':
          const pnl = engine.profitAndLoss(args[0], args[1], 'private', 'cli');
          console.log('\n💰 Profit & Loss:');
          console.log(JSON.stringify(pnl, null, 2));
          break;

        case 'invoices':
          const invoices = engine.openInvoices('private', 'cli');
          console.log('\n📄 Open Invoices:');
          console.table(invoices);
          break;

        case 'trends':
          const trends = engine.monthlyTrends(args[0] || 12, 'private', 'cli');
          console.log('\n📈 Monthly Trends:');
          console.table(trends);
          break;

        case 'audit':
          const log = engine.getAuditLog(args[0] || 30);
          console.log('\n🔐 Access Audit Log:');
          console.table(log);
          break;

        default:
          console.log(`Usage:
  query <question>          Natural language query
  pnl <start> <end>        Profit & Loss report
  invoices                 Open invoices
  trends [months]          Monthly trends
  audit [days]             Access audit log`);
      }

      engine.close();
    } catch (err) {
      console.error('❌ Error:', err.message);
      engine.close();
      process.exit(1);
    }
  })();
}
