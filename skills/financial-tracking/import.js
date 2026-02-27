const Database = require('better-sqlite3');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');

const DB_PATH = '/Volumes/reeseai-memory/data/finance/finance.db';

class FinancialImporter {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
  }

  // Auto-detect file type from headers
  detectFileType(headers) {
    const h = headers.map(h => String(h).toLowerCase().trim());

    if (h.includes('debit') && h.includes('credit')) return 'transactions';
    if (h.includes('invoice') || h.includes('invoice number')) return 'invoices';
    if (h.includes('account') && h.includes('type')) return 'chart_of_accounts';
    if (h.includes('amount') && (h.includes('date') || h.includes('transaction date'))) return 'transactions';

    return 'unknown';
  }

  async importFile(filePath) {
    console.log(`Importing: ${filePath}`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = filePath.split('.').pop().toLowerCase();
    let rows, headers;

    if (ext === 'csv') {
      ({ rows, headers } = this.parseCSV(filePath));
    } else if (['xlsx', 'xls'].includes(ext)) {
      ({ rows, headers } = this.parseExcel(filePath));
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
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const headers = Object.keys(records[0]);
    return { rows: records, headers };
  }

  parseExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (data.length < 2) {
      throw new Error('Excel file is empty or has no data rows');
    }

    const headers = data[0].map(h => String(h).trim());
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] !== undefined ? row[i] : '';
      });
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

    const stmt = this.db.prepare(`
      INSERT INTO transactions (date, description, reference, amount, category, vendor, source, import_hash)
      VALUES (?, ?, ?, ?, ?, ?, 'import', ?)
    `);

    for (const row of rows) {
      const date = this.parseDate(row[dateCol]);
      
      // Handle Debit/Credit columns or Amount column
      let amount = null;
      if (row['Debit'] !== undefined && row['Debit'] !== '') {
        amount = this.parseAmount(row['Debit']);
      } else if (row['Credit'] !== undefined && row['Credit'] !== '') {
        amount = -Math.abs(this.parseAmount(row['Credit']));
      } else if (amountCol) {
        amount = this.parseAmount(row[amountCol]);
      }

      const desc = row[descCol] || '';

      if (!date || amount === null || isNaN(amount)) {
        skipped++;
        continue;
      }

      // Dedup hash
      const hash = crypto.createHash('sha256')
        .update(`${date}|${amount}|${desc}`)
        .digest('hex');

      try {
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
    return { imported, skipped, type: 'transactions' };
  }

  importInvoices(rows, headers) {
    let imported = 0, skipped = 0;

    const invoiceCol = this.findColumn(headers, ['invoice', 'invoice number', 'invoice #']);
    const clientCol = this.findColumn(headers, ['client', 'customer', 'client name']);
    const amountCol = this.findColumn(headers, ['amount', 'total']);
    const issuedCol = this.findColumn(headers, ['issued', 'issue date', 'date']);
    const dueCol = this.findColumn(headers, ['due', 'due date']);
    const paidCol = this.findColumn(headers, ['paid', 'paid date', 'payment date']);
    const statusCol = this.findColumn(headers, ['status']);

    const stmt = this.db.prepare(`
      INSERT INTO invoices (invoice_number, client_name, amount, issued_date, due_date, paid_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of rows) {
      const invoiceNum = row[invoiceCol] || '';
      const amount = this.parseAmount(row[amountCol]);

      if (!invoiceNum || amount === null) {
        skipped++;
        continue;
      }

      try {
        stmt.run(
          invoiceNum,
          row[clientCol] || null,
          amount,
          this.parseDate(row[issuedCol]) || null,
          this.parseDate(row[dueCol]) || null,
          this.parseDate(row[paidCol]) || null,
          row[statusCol] || 'unpaid'
        );
        imported++;
      } catch (err) {
        if (err.message.includes('UNIQUE constraint')) {
          skipped++; // Duplicate invoice number
        } else {
          throw err;
        }
      }
    }

    console.log(`✅ Imported ${imported} invoices (${skipped} skipped/duplicates)`);
    return { imported, skipped, type: 'invoices' };
  }

  importAccounts(rows, headers) {
    let imported = 0, skipped = 0;

    const nameCol = this.findColumn(headers, ['name', 'account', 'account name']);
    const typeCol = this.findColumn(headers, ['type', 'account type']);
    const descCol = this.findColumn(headers, ['description', 'desc']);

    const stmt = this.db.prepare(`
      INSERT INTO accounts (name, type, description)
      VALUES (?, ?, ?)
    `);

    for (const row of rows) {
      const name = row[nameCol] || '';
      const type = String(row[typeCol] || '').toLowerCase();

      if (!name || !['asset', 'liability', 'equity', 'revenue', 'expense'].includes(type)) {
        skipped++;
        continue;
      }

      try {
        stmt.run(name, type, row[descCol] || null);
        imported++;
      } catch (err) {
        skipped++;
      }
    }

    console.log(`✅ Imported ${imported} accounts (${skipped} skipped)`);
    return { imported, skipped, type: 'accounts' };
  }

  findColumn(headers, candidates) {
    const lower = headers.map(h => String(h).toLowerCase());
    for (const c of candidates) {
      const idx = lower.indexOf(c);
      if (idx >= 0) return headers[idx];
    }
    return null;
  }

  parseDate(value) {
    if (!value || value === '') return null;
    
    // Handle Excel serial dates
    if (typeof value === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return date.toISOString().split('T')[0];
    }

    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  }

  parseAmount(value) {
    if (value === null || value === undefined || value === '') return null;
    
    // Handle string amounts with $, commas
    const cleaned = String(value).replace(/[$,\s()]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  recalculateSummaries() {
    const months = this.db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', date) as month 
      FROM transactions 
      WHERE date IS NOT NULL
      ORDER BY month
    `).all();

    const updateStmt = this.db.prepare(`
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
      for (const b of breakdown) {
        breakdownObj[b.category || 'uncategorized'] = b.total;
      }

      updateStmt.run(
        month, 
        revenue, 
        expenses, 
        revenue - expenses, 
        JSON.stringify(breakdownObj)
      );
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = FinancialImporter;

// CLI usage
if (require.main === module) {
  const importer = new FinancialImporter();
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node import.js <file.csv|file.xlsx>');
    process.exit(1);
  }

  importer.importFile(filePath)
    .then(result => {
      console.log('Import complete:', result);
      importer.close();
    })
    .catch(err => {
      console.error('Import failed:', err.message);
      importer.close();
      process.exit(1);
    });
}
