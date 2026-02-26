#!/usr/bin/env node
/**
 * Financial Import Pipeline
 * Auto-detects file type (CSV/Excel), imports transactions/invoices, deduplicates
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Try to load xlsx module if available
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  XLSX = null;
}

const DB_PATH = '/Volumes/reeseai-memory/data/finance/finance.db';

class FinancialImporter {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
  }

  // Auto-detect file type from headers
  detectFileType(headers) {
    const h = headers.map(h => h.toLowerCase().trim());

    // Debit/Credit indicates transaction format
    if (h.includes('debit') && h.includes('credit')) return 'transactions';

    // Invoice-specific columns
    if (h.includes('invoice') || h.includes('invoice number')) return 'invoices';
    if (h.includes('client') && h.includes('due date')) return 'invoices';

    // Chart of accounts
    if (h.includes('account') && h.includes('type')) return 'chart_of_accounts';

    // Generic transaction indicators
    if (h.includes('amount') && (h.includes('date') || h.includes('transaction date'))) return 'transactions';
    if (h.includes('date') && (h.includes('vendor') || h.includes('payee') || h.includes('description'))) return 'transactions';

    return 'unknown';
  }

  async importFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`Importing: ${filePath}`);

    const ext = path.extname(filePath).toLowerCase().slice(1);
    let rows, headers;

    if (ext === 'csv') {
      ({ rows, headers } = this.parseCSV(filePath));
    } else if (['xlsx', 'xls'].includes(ext)) {
      if (!XLSX) {
        throw new Error('xlsx module not available. Install with: npm install xlsx');
      }
      ({ rows, headers } = this.parseExcel(filePath));
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const fileType = this.detectFileType(headers);
    console.log(`Detected file type: ${fileType} (${rows.length} rows)`);

    if (fileType === 'unknown') {
      throw new Error(`Cannot auto-detect file type. Headers: ${headers.join(', ')}`);
    }

    switch (fileType) {
      case 'transactions':
        return this.importTransactions(rows, headers);
      case 'invoices':
        return this.importInvoices(rows, headers);
      case 'chart_of_accounts':
        return this.importAccounts(rows, headers);
      default:
        throw new Error(`Unknown file type: ${fileType}`);
    }
  }

  parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Handle quoted CSV values
    const headers = this.parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    });

    return { rows, headers };
  }

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  parseExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 2) {
      throw new Error('Excel file is empty or has no data rows');
    }

    const headers = data[0].map(h => String(h).trim());
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? String(row[i]).trim() : '';
      });
      return obj;
    });

    return { rows, headers };
  }

  importTransactions(rows, headers) {
    let imported = 0, skipped = 0, errors = [];

    const dateCol = this.findColumn(headers, ['date', 'transaction date', 'trans date', 'date posted']);
    const amountCol = this.findColumn(headers, ['amount', 'total', 'debit', 'credit']);
    const descCol = this.findColumn(headers, ['description', 'memo', 'name', 'account name']);
    const categoryCol = this.findColumn(headers, ['category', 'type', 'account']);
    const vendorCol = this.findColumn(headers, ['vendor', 'payee', 'customer']);
    const refCol = this.findColumn(headers, ['reference', 'check', 'ref', 'num', 'check num']);

    if (!dateCol || !amountCol) {
      throw new Error(`Cannot find required columns. Found: ${headers.join(', ')}`);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const date = this.parseDate(row[dateCol]);
        const amount = this.parseAmount(row[amountCol]);
        const desc = row[descCol] || '';

        if (!date || amount === null) {
          skipped++;
          continue;
        }

        // Create dedup hash: SHA256(date + amount + description)
        const hash = crypto.createHash('sha256')
          .update(`${date}|${amount}|${desc}`)
          .digest('hex');

        const stmt = this.db.prepare(`
          INSERT INTO transactions (date, description, reference, amount, category, vendor, source, import_hash)
          VALUES (?, ?, ?, ?, ?, ?, 'import', ?)
        `);

        stmt.run(
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
        if (err.message && err.message.includes('UNIQUE constraint')) {
          skipped++; // Duplicate
        } else {
          errors.push(`Row ${i + 2}: ${err.message}`);
          skipped++;
        }
      }
    }

    // Recalculate monthly summaries
    this.recalculateSummaries();

    const result = {
      type: 'transactions',
      imported,
      skipped,
      total: rows.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : []
    };

    console.log(`✅ Imported ${imported} transactions (${skipped} skipped/duplicates)`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors encountered`);
    }

    return result;
  }

  importInvoices(rows, headers) {
    let imported = 0, skipped = 0, errors = [];

    const numberCol = this.findColumn(headers, ['invoice', 'invoice number', 'number']);
    const clientCol = this.findColumn(headers, ['client', 'customer', 'name']);
    const amountCol = this.findColumn(headers, ['amount', 'total', 'invoice amount']);
    const issuedCol = this.findColumn(headers, ['issued', 'issued date', 'date issued']);
    const dueCol = this.findColumn(headers, ['due', 'due date']);
    const paidCol = this.findColumn(headers, ['paid', 'paid date']);
    const statusCol = this.findColumn(headers, ['status', 'payment status']);

    if (!numberCol || !amountCol) {
      throw new Error(`Cannot find required columns. Found: ${headers.join(', ')}`);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const invoiceNum = row[numberCol];
        const amount = this.parseAmount(row[amountCol]);

        if (!invoiceNum || amount === null) {
          skipped++;
          continue;
        }

        const stmt = this.db.prepare(`
          INSERT INTO invoices (invoice_number, client_name, amount, issued_date, due_date, paid_date, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          invoiceNum,
          row[clientCol] || null,
          amount,
          issuedCol ? this.parseDate(row[issuedCol]) : null,
          dueCol ? this.parseDate(row[dueCol]) : null,
          paidCol ? this.parseDate(row[paidCol]) : null,
          row[statusCol] ? this.normalizeStatus(row[statusCol]) : 'unpaid'
        );

        imported++;
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          skipped++;
        } else {
          errors.push(`Row ${i + 2}: ${err.message}`);
          skipped++;
        }
      }
    }

    const result = {
      type: 'invoices',
      imported,
      skipped,
      total: rows.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : []
    };

    console.log(`✅ Imported ${imported} invoices (${skipped} skipped/duplicates)`);
    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} errors encountered`);
    }

    return result;
  }

  importAccounts(rows, headers) {
    let imported = 0, skipped = 0, errors = [];

    const nameCol = this.findColumn(headers, ['name', 'account name', 'account']);
    const typeCol = this.findColumn(headers, ['type', 'account type']);

    if (!nameCol || !typeCol) {
      throw new Error(`Cannot find required columns. Found: ${headers.join(', ')}`);
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const name = row[nameCol];
        const type = row[typeCol];

        if (!name || !type) {
          skipped++;
          continue;
        }

        const normalizedType = type.toLowerCase();
        if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(normalizedType)) {
          skipped++;
          continue;
        }

        const stmt = this.db.prepare(`
          INSERT INTO accounts (name, type, description)
          VALUES (?, ?, ?)
        `);

        stmt.run(name, normalizedType, row['description'] || null);
        imported++;
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint')) {
          skipped++;
        } else {
          errors.push(`Row ${i + 2}: ${err.message}`);
          skipped++;
        }
      }
    }

    const result = {
      type: 'accounts',
      imported,
      skipped,
      total: rows.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : []
    };

    console.log(`✅ Imported ${imported} accounts (${skipped} skipped/duplicates)`);

    return result;
  }

  findColumn(headers, candidates) {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    for (const candidate of candidates) {
      const idx = lowerHeaders.indexOf(candidate.toLowerCase());
      if (idx >= 0) return headers[idx];
    }
    return null;
  }

  parseDate(value) {
    if (!value || value === '') return null;

    const d = new Date(value);
    if (isNaN(d.getTime())) return null;

    // Return YYYY-MM-DD format
    return d.toISOString().split('T')[0];
  }

  parseAmount(value) {
    if (!value || value === '') return null;

    const cleaned = String(value).replace(/[$,\s]/g, '').trim();
    const num = parseFloat(cleaned);

    return isNaN(num) ? null : num;
  }

  normalizeStatus(value) {
    const val = value.toLowerCase().trim();
    if (['paid', 'complete', 'completed'].includes(val)) return 'paid';
    if (['void', 'voided', 'cancelled'].includes(val)) return 'void';
    if (['overdue', 'past due'].includes(val)) return 'overdue';
    return 'unpaid';
  }

  recalculateSummaries() {
    // Get all months with transactions
    const months = this.db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', date) as month FROM transactions ORDER BY month
    `).all();

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO monthly_summary (month, total_revenue, total_expenses, net_income, expense_breakdown)
      VALUES (?, ?, ?, ?, ?)
    `);

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

      const breakdownObj = {};
      breakdown.forEach(b => {
        breakdownObj[b.category || 'uncategorized'] = parseFloat(b.total.toFixed(2));
      });

      stmt.run(month, revenue, expenses, revenue - expenses, JSON.stringify(breakdownObj));
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = FinancialImporter;

// CLI support
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: node import.js <file.csv|file.xlsx>');
    process.exit(1);
  }

  const importer = new FinancialImporter();
  importer.importFile(filePath)
    .then(result => {
      console.log('\n📊 Import Summary:');
      console.log(JSON.stringify(result, null, 2));
      importer.close();
    })
    .catch(err => {
      console.error('❌ Import failed:', err.message);
      importer.close();
      process.exit(1);
    });
}
