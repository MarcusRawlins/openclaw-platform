#!/usr/bin/env node
/**
 * Financial Tracking CLI
 * Command-line interface for financial operations
 */

const path = require('path');
const fs = require('fs');
const FinancialImporter = require('./import');
const FinancialQueryEngine = require('./query');
const ConfidentialityGuard = require('./confidentiality');

class FinanceCLI {
  constructor() {
    this.importer = new FinancialImporter();
    this.queryEngine = new FinancialQueryEngine();
  }

  async run() {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    try {
      switch (command) {
        case 'import':
          await this.handleImport(args);
          break;

        case 'query':
          await this.handleQuery(args);
          break;

        case 'pnl':
          this.handlePnL(args);
          break;

        case 'invoices':
          this.handleInvoices(args);
          break;

        case 'trends':
          this.handleTrends(args);
          break;

        case 'audit':
          this.handleAudit(args);
          break;

        case 'redact':
          this.handleRedact(args);
          break;

        case 'help':
          this.showHelp();
          break;

        case 'init':
          await this.handleInit();
          break;

        default:
          this.showHelp();
          process.exit(command ? 1 : 0);
      }
    } catch (err) {
      console.error(`\n❌ Error: ${err.message}`);
      process.exit(1);
    }

    this.cleanup();
  }

  async handleImport(args) {
    if (args.length === 0) {
      console.log('Usage: finance import <file.csv|xlsx>');
      console.log('\nExamples:');
      console.log('  finance import transactions.csv');
      console.log('  finance import invoices.xlsx');
      console.log('  finance import accounts.csv');
      console.log('\nSupported formats:');
      console.log('  - CSV files with headers');
      console.log('  - Excel files (.xlsx, .xls)');
      console.log('\nAuto-detects file type based on headers.');
      process.exit(1);
    }

    const filePath = args[0];

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`\n📥 Importing: ${path.basename(filePath)}\n`);

    const result = await this.importer.importFile(filePath);

    console.log('\n✅ Import Complete:');
    console.log(`   Type: ${result.type}`);
    console.log(`   Imported: ${result.imported}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Total rows: ${result.total}`);

    if (result.errors && result.errors.length > 0) {
      console.log(`\n⚠️  Errors (showing first 5):`);
      result.errors.forEach(err => console.log(`   - ${err}`));
    }
  }

  async handleQuery(args) {
    if (args.length === 0) {
      console.log('Usage: finance query "your question here"');
      console.log('\nExamples:');
      console.log('  finance query "How much revenue did we have last month?"');
      console.log('  finance query "What were our top expense categories?"');
      console.log('  finance query "Show transactions from January"');
      console.log('\nNote: Uses local LLM to convert natural language to SQL.');
      process.exit(1);
    }

    const question = args.join(' ');
    console.log(`\n🤔 Processing query...\n`);

    const result = await this.queryEngine.query(question, 'private', 'cli');

    if (result.results && result.results.length > 0) {
      console.log('\n📊 Results:');
      console.table(result.results);
    } else {
      console.log('\n📊 No results found.');
    }

    if (result.redacted) {
      console.log('\n🔐 Note: Results were redacted for security.');
    }
  }

  handlePnL(args) {
    if (args.length < 2) {
      console.log('Usage: finance pnl <start-date> <end-date>');
      console.log('\nFormat: YYYY-MM-DD');
      console.log('\nExamples:');
      console.log('  finance pnl 2026-01-01 2026-01-31');
      console.log('  finance pnl 2026-01-01 2026-12-31');
      process.exit(1);
    }

    const [startDate, endDate] = args;

    console.log(`\n💰 Profit & Loss Report\n`);
    console.log(`Period: ${startDate} to ${endDate}\n`);

    const report = this.queryEngine.profitAndLoss(startDate, endDate, 'private', 'cli');

    console.log('📈 Revenue:');
    if (report.revenue.items.length > 0) {
      console.table(report.revenue.items);
      console.log(`   Total: $${report.revenue.total.toLocaleString()}`);
    } else {
      console.log('   No revenue entries');
    }

    console.log('\n📉 Expenses:');
    if (report.expenses.items.length > 0) {
      console.table(report.expenses.items);
      console.log(`   Total: $${report.expenses.total.toLocaleString()}`);
    } else {
      console.log('   No expense entries');
    }

    console.log(`\n🎯 Summary:`);
    console.log(`   Revenue: $${report.revenue.total.toLocaleString()}`);
    console.log(`   Expenses: $${report.expenses.total.toLocaleString()}`);
    console.log(`   Net Income: $${report.netIncome.toLocaleString()}`);
    console.log(`   Profit Margin: ${report.margin}%`);
  }

  handleInvoices(args) {
    const context = args.includes('--public') ? 'public' : 'private';

    console.log(`\n📄 Open Invoices\n`);

    const invoices = this.queryEngine.openInvoices(context, 'cli');

    if (invoices && invoices.length > 0) {
      console.table(invoices);
      console.log(`\n📊 Summary:`);
      const totalAmount = invoices.reduce((sum, inv) => {
        return sum + (typeof inv.amount === 'number' ? inv.amount : 0);
      }, 0);
      const overdue = invoices.filter(inv => inv.current_status === 'overdue').length;

      if (context === 'private') {
        console.log(`   Total Outstanding: $${totalAmount.toLocaleString()}`);
        console.log(`   Overdue: ${overdue}`);
      } else {
        console.log(`   Total Outstanding: [REDACTED]`);
        console.log(`   Overdue: ${overdue}`);
      }
    } else {
      console.log('No open invoices.');
    }
  }

  handleTrends(args) {
    const months = args[0] ? parseInt(args[0]) : 12;
    const context = args.includes('--public') ? 'public' : 'private';

    console.log(`\n📈 Monthly Trends (Last ${months} months)\n`);

    const trends = this.queryEngine.monthlyTrends(months, context, 'cli');

    if (trends && trends.length > 0) {
      console.table(trends);

      if (context === 'private') {
        const avgRevenue = trends.reduce((sum, t) => sum + parseFloat(t.total_revenue || 0), 0) / trends.length;
        const avgExpense = trends.reduce((sum, t) => sum + parseFloat(t.total_expenses || 0), 0) / trends.length;
        console.log(`\n💡 Averages:`);
        console.log(`   Avg Revenue/Month: $${avgRevenue.toLocaleString()}`);
        console.log(`   Avg Expenses/Month: $${avgExpense.toLocaleString()}`);
      }
    } else {
      console.log('No trend data available.');
    }
  }

  handleAudit(args) {
    const days = args[0] ? parseInt(args[0]) : 30;

    console.log(`\n🔐 Access Audit Log (Last ${days} days)\n`);

    const log = this.queryEngine.getAuditLog(days);

    if (log && log.length > 0) {
      console.table(log);

      const redactedCount = log.filter(l => l.redacted).length;
      console.log(`\n📊 Summary:`);
      console.log(`   Total accesses: ${log.length}`);
      console.log(`   Redacted: ${redactedCount}`);
      console.log(`   Unique agents: ${new Set(log.map(l => l.agent)).size}`);
    } else {
      console.log('No access records found.');
    }
  }

  handleRedact(args) {
    if (args.length === 0) {
      console.log('Usage: finance redact "<text>"');
      console.log('\nRemoves dollar amounts and sensitive financial data from text.');
      console.log('\nExample:');
      console.log('  finance redact "Revenue was $50,000 in January"');
      process.exit(1);
    }

    const text = args.join(' ');
    const redacted = ConfidentialityGuard.redactMessage(text);

    console.log('\n🔐 Redaction Result:\n');
    console.log('Original:');
    console.log(`  ${text}\n`);
    console.log('Redacted:');
    console.log(`  ${redacted}\n`);

    const hasDollars = ConfidentialityGuard.containsDollarAmounts(text);
    console.log(`Financial data detected: ${hasDollars ? '✅ Yes' : '❌ No'}`);
  }

  async handleInit() {
    console.log('\n🔧 Initializing financial database...\n');

    const initScript = require('./db-init');
    console.log('✅ Database initialized');
  }

  showHelp() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║           FINANCIAL TRACKING SYSTEM - CLI TOOL                 ║
╚════════════════════════════════════════════════════════════════╝

COMMANDS:

  init                          Initialize database schema
  
  import <file>                 Import CSV/Excel file
    Example: finance import transactions.csv
  
  query "<question>"           Natural language query
    Example: finance query "How much did we spend on marketing?"
  
  pnl <start> <end>            Profit & Loss report
    Example: finance pnl 2026-01-01 2026-01-31
  
  invoices [--public]          Open invoices
    Example: finance invoices
    Use --public to get redacted version for group sharing
  
  trends [months] [--public]   Monthly trends
    Example: finance trends 12
  
  audit [days]                 Access audit log
    Example: finance audit 30
  
  redact "<text>"              Remove sensitive data from text
    Example: finance redact "Revenue was $50,000"

OPTIONS:

  --public                     Return redacted version (no dollar amounts)

SECURITY:

  ✅ All financial queries logged
  ✅ Dollar amounts automatically redacted in group contexts
  ✅ Access audit trail maintained
  ✅ Confidentiality enforced

DOCUMENTATION:

  Full documentation: /workspace/skills/financial-tracking/SKILL.md
  Database location: /Volumes/reeseai-memory/data/finance/finance.db
  `);
  }

  cleanup() {
    this.importer.close();
    this.queryEngine.close();
  }
}

// Run CLI
if (require.main === module) {
  const cli = new FinanceCLI();
  cli.run().catch(err => {
    console.error(`\n❌ Fatal error: ${err.message}`);
    cli.cleanup();
    process.exit(1);
  });
}

module.exports = FinanceCLI;
