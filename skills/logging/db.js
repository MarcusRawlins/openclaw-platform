/**
 * SQLite Database Schema and Query Helpers
 * Manages structured_logs, raw_logs, and ingest_state tables
 */

const Database = require('better-sqlite3');
const path = require('path');
const config = require('./config.json');

class LogDB {
  constructor(dbPath = config.db_path) {
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this._initSchema();
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS structured_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        event TEXT NOT NULL,
        level TEXT NOT NULL,
        agent TEXT,
        source TEXT,
        session TEXT,
        duration_ms INTEGER,
        error TEXT,
        data_json TEXT,
        ingested_at TEXT DEFAULT (datetime('now')),
        source_file TEXT
      );

      CREATE TABLE IF NOT EXISTS raw_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT,
        source TEXT NOT NULL,
        level TEXT,
        message TEXT,
        raw_line TEXT,
        ingested_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ingest_state (
        file_path TEXT PRIMARY KEY,
        last_byte_offset INTEGER DEFAULT 0,
        last_ingested_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_logs_ts ON structured_logs(ts);
      CREATE INDEX IF NOT EXISTS idx_logs_event ON structured_logs(event);
      CREATE INDEX IF NOT EXISTS idx_logs_level ON structured_logs(level);
      CREATE INDEX IF NOT EXISTS idx_logs_agent ON structured_logs(agent);
      CREATE INDEX IF NOT EXISTS idx_logs_event_ts ON structured_logs(event, ts);
      CREATE INDEX IF NOT EXISTS idx_raw_ts ON raw_logs(ts);
      CREATE INDEX IF NOT EXISTS idx_raw_source ON raw_logs(source);
    `);
  }

  /**
   * Query structured logs with filters
   * @param {Object} options - Filter options
   * @returns {Array} Matching log entries
   */
  query(options = {}) {
    let sql = 'SELECT * FROM structured_logs WHERE 1=1';
    const params = [];

    if (options.event) {
      sql += ' AND event = ?';
      params.push(options.event);
    }

    if (options.level) {
      sql += ' AND level = ?';
      params.push(options.level);
    }

    if (options.agent) {
      sql += ' AND agent = ?';
      params.push(options.agent);
    }

    if (options.from) {
      sql += ' AND ts >= ?';
      params.push(options.from);
    }

    if (options.to) {
      sql += ' AND ts <= ?';
      params.push(options.to);
    }

    if (options.grep) {
      sql += ' AND (data_json LIKE ? OR error LIKE ?)';
      params.push(`%${options.grep}%`, `%${options.grep}%`);
    }

    sql += ' ORDER BY ts DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    return this.db.prepare(sql).all(...params);
  }

  /**
   * Count logs matching filters
   * @param {Object} options - Filter options
   * @returns {number} Count of matching entries
   */
  count(options = {}) {
    let sql = 'SELECT COUNT(*) as count FROM structured_logs WHERE 1=1';
    const params = [];

    if (options.event) {
      sql += ' AND event = ?';
      params.push(options.event);
    }

    if (options.level) {
      sql += ' AND level = ?';
      params.push(options.level);
    }

    if (options.agent) {
      sql += ' AND agent = ?';
      params.push(options.agent);
    }

    if (options.from) {
      sql += ' AND ts >= ?';
      params.push(options.from);
    }

    if (options.to) {
      sql += ' AND ts <= ?';
      params.push(options.to);
    }

    return this.db.prepare(sql).get(...params).count;
  }

  /**
   * Get ingest state for a file
   * @param {string} filePath - Path to JSONL file
   * @returns {Object|null} Ingest state or null
   */
  getIngestState(filePath) {
    return this.db.prepare('SELECT * FROM ingest_state WHERE file_path = ?').get(filePath);
  }

  /**
   * Update ingest state for a file
   * @param {string} filePath - Path to JSONL file
   * @param {number} byteOffset - New byte offset
   */
  updateIngestState(filePath, byteOffset) {
    this.db.prepare(`
      INSERT INTO ingest_state (file_path, last_byte_offset, last_ingested_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(file_path) DO UPDATE SET
        last_byte_offset = excluded.last_byte_offset,
        last_ingested_at = excluded.last_ingested_at
    `).run(filePath, byteOffset);
  }

  /**
   * Insert a structured log entry
   * @param {Object} entry - Log entry
   * @param {string} sourceFile - Source JSONL file
   */
  insertLog(entry, sourceFile) {
    this.db.prepare(`
      INSERT OR IGNORE INTO structured_logs 
      (ts, event, level, agent, source, session, duration_ms, error, data_json, source_file)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.ts,
      entry.event,
      entry.level,
      entry.agent || null,
      entry.source || null,
      entry.session || null,
      entry.duration_ms || null,
      entry.error || null,
      JSON.stringify(entry.data || {}),
      sourceFile
    );
  }

  /**
   * Insert a raw log entry
   * @param {Object} entry - Raw log entry
   */
  insertRawLog(entry) {
    this.db.prepare(`
      INSERT INTO raw_logs (ts, source, level, message, raw_line)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      entry.ts || null,
      entry.source,
      entry.level || null,
      entry.message || null,
      entry.raw_line
    );
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
}

module.exports = LogDB;
