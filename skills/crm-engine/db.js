#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const CONFIG = require('./config.json');

// Resolve skills directory
const SKILLS_DIR = process.env.OPENCLAW_SKILLS_PATH || 
                   path.join(process.env.HOME, '.openclaw/workspace/skills');

let logger;
try {
  const Logger = require(path.join(SKILLS_DIR, 'logging/logger'));
  logger = Logger.getInstance();
} catch (e) {
  logger = { 
    info: (event, data) => console.log(`[${event}]`, data),
    error: (event, data) => console.error(`[${event}]`, data),
    warn: (event, data) => console.warn(`[${event}]`, data)
  };
}

const DB_PATH = path.resolve(__dirname, CONFIG.database.path);

// Initialize database
function initDatabase() {
  // Ensure directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info('crm.db_dir_created', { path: dbDir });
  }

  const db = new Database(DB_PATH);
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  // Run migrations
  runMigrations(db);
  
  logger.info('crm.db_initialized', { path: DB_PATH });
  
  return db;
}

function runMigrations(db) {
  // Get current schema version
  let version = 0;
  try {
    const row = db.prepare('PRAGMA user_version').get();
    version = row.user_version;
  } catch (e) {
    // First time, no schema yet
  }

  logger.info('crm.schema_version', { version });

  // Migration 1: Initial schema
  if (version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        company TEXT,
        role TEXT,
        source TEXT,
        source_id TEXT,
        priority TEXT DEFAULT 'normal',
        relationship_score INTEGER DEFAULT 0,
        relationship_type TEXT,
        communication_style TEXT,
        key_topics TEXT,
        auto_added BOOLEAN DEFAULT 0,
        approved BOOLEAN DEFAULT 1,
        skip_pattern BOOLEAN DEFAULT 0,
        notes TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        subject TEXT,
        summary TEXT,
        source TEXT,
        source_id TEXT,
        direction TEXT,
        occurred_at TEXT NOT NULL,
        logged_at TEXT DEFAULT (datetime('now')),
        metadata TEXT,
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      );

      CREATE TABLE IF NOT EXISTS follow_ups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        snoozed_until TEXT,
        priority TEXT DEFAULT 'normal',
        created_by TEXT DEFAULT 'system',
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      );

      CREATE TABLE IF NOT EXISTS contact_context (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        context_type TEXT,
        embedding BLOB,
        occurred_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      );

      CREATE TABLE IF NOT EXISTS contact_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        key_facts TEXT,
        last_interaction TEXT,
        interaction_count INTEGER DEFAULT 0,
        generated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      );

      CREATE TABLE IF NOT EXISTS company_news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        headline TEXT NOT NULL,
        url TEXT,
        summary TEXT,
        relevance_score FLOAT,
        published_at TEXT,
        discovered_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS discovery_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        name TEXT,
        domain TEXT,
        decision TEXT NOT NULL,
        decided_at TEXT DEFAULT (datetime('now')),
        auto_decision BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS skip_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL UNIQUE,
        pattern_type TEXT NOT NULL,
        reason TEXT,
        learned_from INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
      CREATE INDEX IF NOT EXISTS idx_contacts_score ON contacts(relationship_score);
      CREATE INDEX IF NOT EXISTS idx_contacts_priority ON contacts(priority);
      CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_date ON interactions(occurred_at);
      CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_contact ON follow_ups(contact_id);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON follow_ups(due_date);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
      CREATE INDEX IF NOT EXISTS idx_context_contact ON contact_context(contact_id);
      CREATE INDEX IF NOT EXISTS idx_company_news_company ON company_news(company);
      CREATE INDEX IF NOT EXISTS idx_discovery_email ON discovery_decisions(email);
      CREATE INDEX IF NOT EXISTS idx_skip_pattern ON skip_patterns(pattern);
    `);

    db.pragma('user_version = 1');
    logger.info('crm.migration_complete', { version: 1 });
  }
}

// Singleton database instance
let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

module.exports = {
  getDatabase,
  initDatabase
};

// CLI: initialize database
if (require.main === module) {
  const db = initDatabase();
  console.log(`✅ Database initialized: ${DB_PATH}`);
  console.log(`   Schema version: ${db.pragma('user_version', { simple: true })}`);
  
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `).all();
  
  console.log(`   Tables: ${tables.map(t => t.name).join(', ')}`);
  db.close();
}
