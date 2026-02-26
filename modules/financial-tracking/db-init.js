#!/usr/bin/env node
/**
 * Financial Database Initialization
 * Creates schema with proper indexes and constraints
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = '/Volumes/reeseai-memory/data/finance/finance.db';

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`Initializing financial database at: ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Create schema
const schema = `
-- Chart of accounts
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id INTEGER REFERENCES accounts(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (double-entry style)
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  amount DECIMAL(10,2) NOT NULL,
  account_id INTEGER REFERENCES accounts(id),
  category TEXT,
  vendor TEXT,
  source TEXT DEFAULT 'manual',
  import_hash TEXT UNIQUE,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
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
CREATE TABLE IF NOT EXISTS monthly_summary (
  month TEXT PRIMARY KEY,
  total_revenue DECIMAL(10,2),
  total_expenses DECIMAL(10,2),
  net_income DECIMAL(10,2),
  expense_breakdown TEXT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Access audit log (CRITICAL for confidentiality tracking)
CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT,
  query TEXT,
  context TEXT DEFAULT 'private',
  redacted BOOLEAN DEFAULT 0,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor ON transactions(vendor);
CREATE INDEX IF NOT EXISTS idx_transactions_import_hash ON transactions(import_hash);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_paid ON invoices(paid_date);
CREATE INDEX IF NOT EXISTS idx_access_log_agent ON access_log(agent);
CREATE INDEX IF NOT EXISTS idx_access_log_context ON access_log(context);
`;

// Execute schema creation
const statements = schema.split(';').filter(s => s.trim());
for (const stmt of statements) {
  if (stmt.trim()) {
    try {
      db.exec(stmt);
    } catch (err) {
      // Table might already exist - that's ok
      if (!err.message.includes('already exists')) {
        console.error(`Error executing statement: ${stmt.substring(0, 50)}...`);
        console.error(err);
      }
    }
  }
}

console.log('✅ Database schema initialized successfully');
console.log(`Database location: ${DB_PATH}`);
console.log('WAL mode: enabled for concurrent access');
console.log('Indexes: created for optimal query performance');

db.close();
