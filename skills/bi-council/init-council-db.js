#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DATA_DIR = '/Volumes/reeseai-memory/data/bi-council';
const COUNCIL_DB = path.join(DATA_DIR, 'council-history.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initCouncilDB() {
  const db = new Database(COUNCIL_DB);

  db.exec(`
    CREATE TABLE IF NOT EXISTS council_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date TEXT UNIQUE,
      run_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      duration_seconds INTEGER
    );

    CREATE TABLE IF NOT EXISTS expert_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES council_sessions(id),
      expert_name TEXT,
      analysis_text TEXT,
      risk_level TEXT,
      opportunity_count INTEGER,
      recommendation_count INTEGER,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES council_sessions(id),
      expert_name TEXT,
      recommendation_text TEXT,
      impact_score INTEGER,
      urgency_score INTEGER,
      combined_rank INTEGER,
      rationale TEXT,
      status TEXT DEFAULT 'pending',
      feedback_at TEXT,
      feedback_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS synthesis (
      session_id INTEGER PRIMARY KEY REFERENCES council_sessions(id),
      executive_summary TEXT,
      key_metrics TEXT,
      risk_alerts TEXT,
      cross_domain_insights TEXT,
      synthesized_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_council_sessions_date ON council_sessions(session_date);
    CREATE INDEX IF NOT EXISTS idx_expert_analyses_session ON expert_analyses(session_id);
    CREATE INDEX IF NOT EXISTS idx_recommendations_session ON recommendations(session_id);
    CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
    CREATE INDEX IF NOT EXISTS idx_recommendations_rank ON recommendations(combined_rank DESC);
  `);

  db.close();
  console.log(`✓ Council history database initialized at ${COUNCIL_DB}`);
}

// CLI entry point
if (require.main === module) {
  initCouncilDB();
}

module.exports = { initCouncilDB };
