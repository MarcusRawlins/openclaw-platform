#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/Volumes/reeseai-memory/data/bi-council';
const CRM_DB = path.join(DATA_DIR, 'crm.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class CRMSync {
  constructor() {
    this.db = new Database(CRM_DB);
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        event_date TEXT,
        event_type TEXT,
        source TEXT,
        status TEXT,
        inquiry_date TEXT,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        inquiry_id TEXT REFERENCES inquiries(id),
        event_date TEXT,
        package_price REAL,
        deposit_paid INTEGER,
        balance_due REAL,
        booking_date TEXT,
        status TEXT,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
      CREATE INDEX IF NOT EXISTS idx_inquiries_date ON inquiries(inquiry_date);
      CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(event_date);
    `);
  }

  // Simulate CRM data sync (in production, would fetch from AnselAI API)
  sync() {
    console.log('📞 Syncing CRM data (placeholder)...');

    // For now, this is a stub. In production:
    // 1. Fetch from AnselAI API: GET /api/inquiries, /api/bookings
    // 2. Upsert into database
    // 3. Track sync timestamps

    console.log('  ℹ CRM sync: Waiting for AnselAI integration');
    return 0;
  }

  getPipelineStats(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const newInquiries = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM inquiries
      WHERE inquiry_date >= ?
    `).get(since).count;

    const newBookings = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM bookings
      WHERE booking_date >= ?
    `).get(since).count;

    const conversionRate = newInquiries > 0 ? ((newBookings / newInquiries) * 100).toFixed(2) : 0;

    return {
      new_inquiries: newInquiries,
      new_bookings: newBookings,
      conversion_rate: conversionRate
    };
  }

  getRecentInquiries(limit = 5) {
    return this.db.prepare(`
      SELECT * FROM inquiries
      ORDER BY inquiry_date DESC
      LIMIT ?
    `).all(limit);
  }

  getRecentBookings(limit = 5) {
    return this.db.prepare(`
      SELECT * FROM bookings
      ORDER BY booking_date DESC
      LIMIT ?
    `).all(limit);
  }

  close() {
    this.db.close();
  }
}

// CLI entry point
if (require.main === module) {
  const sync = new CRMSync();
  sync.sync();
  sync.close();
}

module.exports = CRMSync;
