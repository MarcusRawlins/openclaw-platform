#!/usr/bin/env node
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const CONFIG = require('./config.json');

function initDatabase() {
  const dbPath = CONFIG.database.path;
  const dbDir = path.dirname(dbPath);

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      message_id TEXT NOT NULL UNIQUE,
      thread_id TEXT,
      from_email TEXT NOT NULL,
      from_name TEXT,
      from_domain TEXT,
      to_email TEXT,
      subject TEXT,
      body_text TEXT,
      body_html_sanitized TEXT,
      received_at TEXT NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now')),
      is_reply BOOLEAN DEFAULT 0,
      in_reply_to TEXT,
      quarantine_status TEXT DEFAULT 'pending',
      quarantine_reason TEXT,
      score INTEGER,
      score_bucket TEXT,
      classification TEXT,
      classification_label TEXT,
      score_label TEXT,
      stage_label TEXT,
      draft_status TEXT DEFAULT 'none',
      draft_text TEXT,
      escalated BOOLEAN DEFAULT 0,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS sender_research (
      domain TEXT PRIMARY KEY,
      domain_resolves BOOLEAN,
      website_title TEXT,
      website_description TEXT,
      credibility_markers TEXT,
      industry TEXT,
      company_size_estimate TEXT,
      social_links TEXT,
      researched_at TEXT DEFAULT (datetime('now')),
      raw_data TEXT
    );

    CREATE TABLE IF NOT EXISTS stage_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER NOT NULL,
      thread_id TEXT,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      changed_at TEXT DEFAULT (datetime('now')),
      changed_by TEXT DEFAULT 'system',
      reason TEXT,
      FOREIGN KEY (email_id) REFERENCES emails(id)
    );

    CREATE TABLE IF NOT EXISTS scoring_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER NOT NULL,
      rubric_version TEXT,
      dimension_scores TEXT,
      flags TEXT,
      raw_llm_response TEXT,
      scored_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (email_id) REFERENCES emails(id)
    );

    CREATE TABLE IF NOT EXISTS poll_state (
      account_id TEXT PRIMARY KEY,
      folder TEXT NOT NULL,
      last_seen_uid TEXT,
      last_poll_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);
    CREATE INDEX IF NOT EXISTS idx_emails_domain ON emails(from_domain);
    CREATE INDEX IF NOT EXISTS idx_emails_score ON emails(score);
    CREATE INDEX IF NOT EXISTS idx_emails_stage ON emails(stage_label);
    CREATE INDEX IF NOT EXISTS idx_emails_received ON emails(received_at);
    CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
  `);

  return db;
}

function getDatabase() {
  const dbPath = CONFIG.database.path;
  if (!fs.existsSync(dbPath)) {
    return initDatabase();
  }
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

// CLI: node db.js --init
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--init')) {
    console.log('Initializing database...');
    initDatabase();
    console.log(`Database initialized at ${CONFIG.database.path}`);
  } else {
    console.log('Usage: node db.js --init');
  }
}

module.exports = { initDatabase, getDatabase };
