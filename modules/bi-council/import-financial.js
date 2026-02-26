#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/Volumes/reeseai-memory/data/bi-council';
const FINANCE_DB = path.join(DATA_DIR, 'finance.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class FinancialImport {
  constructor() {
    this.db = new Database(FINANCE_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS revenue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        amount REAL,
        category TEXT,
        source TEXT,
        notes TEXT,
        imported_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        amount REAL,
        category TEXT,
        vendor TEXT,
        description TEXT,
        imported_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS monthly_summary (
        month TEXT PRIMARY KEY,
        total_revenue REAL,
        total_expenses REAL,
        net_income REAL,
        calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue(date);
      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
      CREATE INDEX IF NOT EXISTS idx_monthly_date ON monthly_summary(month);
    `);
  }

  // Add revenue record
  addRevenue(date, amount, category, source, notes = null) {
    this.db.prepare(`
      INSERT INTO revenue (date, amount, category, source, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(date, amount, category, source, notes);
    this.recalculateMonthlySummaries();
  }

  // Add expense record
  addExpense(date, amount, category, vendor, description = null) {
    this.db.prepare(`
      INSERT INTO expenses (date, amount, category, vendor, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(date, amount, category, vendor, description);
    this.recalculateMonthlySummaries();
  }

  // Import from financial-tracking skill (already built)
  importFromFinancialTrackingSkill() {
    console.log('💰 Importing from financial-tracking skill...');

    // Reference spec: /workspace/specs/financial-tracking-system.md
    // This will read from the financial-tracking database if it exists
    const ftPath = '/Volumes/reeseai-memory/data/financial-tracking.db';

    if (!fs.existsSync(ftPath)) {
      console.log('  ℹ financial-tracking.db not found, skipping');
      return 0;
    }

    try {
      const ftDb = new Database(ftPath);
      let imported = 0;

      // Copy revenue records
      const revenues = ftDb.prepare(`
        SELECT date, amount, category, source, notes
        FROM revenue
      `).all();

      for (const rev of revenues) {
        try {
          this.db.prepare(`
            INSERT OR IGNORE INTO revenue (date, amount, category, source, notes)
            VALUES (?, ?, ?, ?, ?)
          `).run(rev.date, rev.amount, rev.category, rev.source, rev.notes);
          imported++;
        } catch (err) {
          // Skip duplicates
        }
      }

      // Copy expense records
      const expenses = ftDb.prepare(`
        SELECT date, amount, category, vendor, description
        FROM expenses
      `).all();

      for (const exp of expenses) {
        try {
          this.db.prepare(`
            INSERT OR IGNORE INTO expenses (date, amount, category, vendor, description)
            VALUES (?, ?, ?, ?, ?)
          `).run(exp.date, exp.amount, exp.category, exp.vendor, exp.description);
          imported++;
        } catch (err) {
          // Skip duplicates
        }
      }

      ftDb.close();
      this.recalculateMonthlySummaries();
      console.log(`  ✓ Imported ${imported} records from financial-tracking`);
      return imported;
    } catch (err) {
      console.error(`  ✗ Import failed: ${err.message}`);
      return 0;
    }
  }

  recalculateMonthlySummaries() {
    // Get all months with data
    const months = this.db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', date) as month
      FROM revenue
      UNION
      SELECT DISTINCT strftime('%Y-%m', date) as month
      FROM expenses
      ORDER BY month DESC
    `).all();

    for (const { month } of months) {
      const revenue = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM revenue
        WHERE strftime('%Y-%m', date) = ?
      `).get(month).total;

      const expenses = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM expenses
        WHERE strftime('%Y-%m', date) = ?
      `).get(month).total;

      const netIncome = revenue - expenses;

      this.db.prepare(`
        INSERT OR REPLACE INTO monthly_summary (month, total_revenue, total_expenses, net_income)
        VALUES (?, ?, ?, ?)
      `).run(month, revenue, expenses, netIncome);
    }
  }

  getMonthlySummaries(months = 3) {
    return this.db.prepare(`
      SELECT * FROM monthly_summary
      ORDER BY month DESC
      LIMIT ?
    `).all(months);
  }

  getYTDSummary() {
    const year = new Date().getFullYear().toString();

    return this.db.prepare(`
      SELECT 
        SUM(amount) as total_revenue
      FROM revenue
      WHERE strftime('%Y', date) = ?
    `).get(year).total_revenue || 0;
  }

  close() {
    this.db.close();
  }
}

// CLI entry point
if (require.main === module) {
  const finance = new FinancialImport();
  finance.importFromFinancialTrackingSkill();
  
  const summary = finance.getMonthlySummaries(3);
  if (summary.length > 0) {
    console.log('\nRecent monthly summaries:');
    summary.forEach(s => {
      console.log(`  ${s.month}: Revenue $${s.total_revenue.toFixed(2)}, Expenses $${s.total_expenses.toFixed(2)}, Net $${s.net_income.toFixed(2)}`);
    });
  }

  finance.close();
}

module.exports = FinancialImport;
