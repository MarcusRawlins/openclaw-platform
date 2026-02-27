#!/usr/bin/env node

const FinancialImporter = require('./import');
const FinancialQueryEngine = require('./query');
const ConfidentialityGuard = require('./confidentiality');

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    switch (command) {
      case 'import': {
        if (!args[0]) {
          console.error('Usage: finance import <file.csv|file.xlsx>');
          process.exit(1);
        }

        const importer = new FinancialImporter();
        const result = await importer.importFile(args[0]);
        console.log('✅ Import complete:', result);
        importer.close();
        break;
      }

      case 'query': {
        if (!args[0]) {
          console.error('Usage: finance query "your question here" [context]');
          process.exit(1);
        }

        const queryEngine = new FinancialQueryEngine();
        const question = args.slice(0, -1).join(' ') || args[0];
        const context = args[args.length - 1].includes('--context=') 
          ? args[args.length - 1].split('=')[1] 
          : 'private';

        const results = await queryEngine.query(question, context);
        
        if (context !== 'private') {
          console.log('⚠️  Results redacted for non-private context');
        }
        
        console.table(results);
        queryEngine.close();
        break;
      }

      case 'pnl': {
        if (args.length < 2) {
          console.error('Usage: finance pnl <start-date> <end-date>');
          process.exit(1);
        }

        const queryEngine = new FinancialQueryEngine();
        const report = queryEngine.profitAndLoss(args[0], args[1]);
        
        console.log('\n=== PROFIT & LOSS ===');
        console.log(`Period: ${report.period.start} to ${report.period.end}\n`);
        
        console.log('REVENUE:');
        console.table(report.revenue.items);
        console.log(`Total Revenue: $${report.revenue.total.toFixed(2)}\n`);
        
        console.log('EXPENSES:');
        console.table(report.expenses.items);
        console.log(`Total Expenses: $${report.expenses.total.toFixed(2)}\n`);
        
        console.log(`NET INCOME: $${report.netIncome.toFixed(2)}`);
        console.log(`Profit Margin: ${report.margin}\n`);
        
        queryEngine.close();
        break;
      }

      case 'balance-sheet': {
        const queryEngine = new FinancialQueryEngine();
        const date = args[0] || null;
        const report = queryEngine.balanceSheet(date);
        
        console.log('\n=== BALANCE SHEET ===');
        console.log(`As of: ${report.asOfDate}\n`);
        
        console.log('ASSETS:');
        console.table(report.assets.items);
        console.log(`Total Assets: $${report.assets.total.toFixed(2)}\n`);
        
        console.log('LIABILITIES:');
        console.table(report.liabilities.items);
        console.log(`Total Liabilities: $${report.liabilities.total.toFixed(2)}\n`);
        
        console.log(`EQUITY: $${report.equity.total.toFixed(2)}\n`);
        
        queryEngine.close();
        break;
      }

      case 'invoices': {
        const queryEngine = new FinancialQueryEngine();
        const invoices = queryEngine.openInvoices();
        
        console.log('\n=== OPEN INVOICES ===');
        console.table(invoices);
        
        const overdue = invoices.filter(i => i.current_status === 'overdue');
        const totalOverdue = overdue.reduce((sum, i) => sum + i.amount, 0);
        
        if (overdue.length > 0) {
          console.log(`\n⚠️  ${overdue.length} OVERDUE invoices totaling $${totalOverdue.toFixed(2)}`);
        }
        
        queryEngine.close();
        break;
      }

      case 'cashflow': {
        if (args.length < 2) {
          console.error('Usage: finance cashflow <start-date> <end-date>');
          process.exit(1);
        }

        const queryEngine = new FinancialQueryEngine();
        const report = queryEngine.cashFlow(args[0], args[1]);
        
        console.log('\n=== CASH FLOW ===');
        console.log(`Period: ${report.period.start} to ${report.period.end}\n`);
        
        console.log(`Total Inflows:  $${report.inflows.total.toFixed(2)}`);
        console.log(`Total Outflows: $${report.outflows.total.toFixed(2)}`);
        console.log(`Net Cash Flow:  $${report.netCashFlow.toFixed(2)}\n`);
        
        queryEngine.close();
        break;
      }

      case 'monthly': {
        const queryEngine = new FinancialQueryEngine();
        const year = args[0] || null;
        const summaries = queryEngine.monthlySummary(year);
        
        console.log('\n=== MONTHLY SUMMARY ===');
        console.table(summaries.map(s => ({
          Month: s.month,
          Revenue: `$${s.total_revenue?.toFixed(2) || '0.00'}`,
          Expenses: `$${s.total_expenses?.toFixed(2) || '0.00'}`,
          'Net Income': `$${s.net_income?.toFixed(2) || '0.00'}`
        })));
        
        queryEngine.close();
        break;
      }

      case 'top-expenses': {
        if (args.length < 2) {
          console.error('Usage: finance top-expenses <start-date> <end-date> [limit]');
          process.exit(1);
        }

        const queryEngine = new FinancialQueryEngine();
        const limit = parseInt(args[2]) || 10;
        const expenses = queryEngine.topExpensesByCategory(args[0], args[1], limit);
        
        console.log('\n=== TOP EXPENSES BY CATEGORY ===');
        console.table(expenses.map(e => ({
          Category: e.category || 'uncategorized',
          Transactions: e.transaction_count,
          Total: `$${e.total_amount.toFixed(2)}`,
          Average: `$${e.avg_amount.toFixed(2)}`
        })));
        
        queryEngine.close();
        break;
      }

      case 'validate-message': {
        if (!args[0]) {
          console.error('Usage: finance validate-message "message text" <context>');
          process.exit(1);
        }

        const message = args.slice(0, -1).join(' ') || args[0];
        const context = args[args.length - 1];
        
        const result = ConfidentialityGuard.validate(message, context);
        
        if (result.safe) {
          console.log('✅ SAFE - Message can be sent');
        } else {
          console.log('❌ BLOCKED - ' + result.reason);
          console.log(`Suggestion: ${result.suggestion}`);
          console.log(`Redacted version: "${result.redactedMessage}"`);
        }
        break;
      }

      default:
        console.log(`
🏦 Financial Tracking System

USAGE:
  finance import <file>                    Import CSV/Excel file (auto-detect type)
  finance query "question" [--context=X]   Natural language query (context: private|group)
  finance pnl <start> <end>               Profit & Loss report
  finance balance-sheet [date]             Balance Sheet (defaults to today)
  finance invoices                         Open invoices list
  finance cashflow <start> <end>          Cash Flow report
  finance monthly [year]                   Monthly summaries (defaults to current year)
  finance top-expenses <start> <end> [N]  Top N expense categories (default 10)
  finance validate-message "msg" context   Check if message is safe for context

EXAMPLES:
  finance import ~/Downloads/transactions-2026.csv
  finance query "what was our revenue last month?"
  finance pnl 2026-01-01 2026-01-31
  finance invoices
  finance monthly 2026

CONFIDENTIALITY:
  - Dollar amounts are PRIVATE by default
  - Group chat messages are automatically redacted
  - Use directional language in non-private contexts
  - All access is logged in the audit trail
        `);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
