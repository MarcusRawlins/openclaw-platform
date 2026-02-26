const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

/**
 * SQLite database initialization and management
 */

const SCHEMA = `
-- LLM calls table
CREATE TABLE IF NOT EXISTS llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task_type TEXT,
  task_description TEXT,
  prompt_hash TEXT,
  prompt_preview TEXT,
  response_preview TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  duration_ms INTEGER,
  estimated_cost_usd REAL,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  session_key TEXT,
  metadata TEXT
);

-- API calls table (non-LLM)
CREATE TABLE IF NOT EXISTS api_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  agent TEXT,
  service TEXT NOT NULL,
  endpoint TEXT,
  method TEXT DEFAULT 'GET',
  status_code INTEGER,
  duration_ms INTEGER,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  estimated_cost_usd REAL,
  error_message TEXT
);

-- Daily aggregates (materialized for fast dashboard queries)
CREATE TABLE IF NOT EXISTS daily_aggregates (
  date TEXT NOT NULL,
  agent TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  task_type TEXT,
  call_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  avg_duration_ms REAL DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  PRIMARY KEY (date, agent, provider, model, task_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_llm_timestamp ON llm_calls(timestamp);
CREATE INDEX IF NOT EXISTS idx_llm_agent ON llm_calls(agent);
CREATE INDEX IF NOT EXISTS idx_llm_model ON llm_calls(model);
CREATE INDEX IF NOT EXISTS idx_llm_task ON llm_calls(task_type);
CREATE INDEX IF NOT EXISTS idx_api_timestamp ON api_calls(timestamp);
CREATE INDEX IF NOT EXISTS idx_api_service ON api_calls(service);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_aggregates(date);
`;

/**
 * Initialize database with schema
 * @param {string} dbPath - Path to database file (optional, uses config)
 * @returns {Database} SQLite database instance
 */
function init(dbPath = null) {
  const finalPath = dbPath || config.database.path;
  
  // Ensure directory exists
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Open database
  const db = new Database(finalPath);
  
  // Enable WAL mode for concurrent access
  db.pragma('journal_mode = WAL');
  
  // Execute schema
  db.exec(SCHEMA);
  
  return db;
}

/**
 * Get or create database connection (singleton pattern)
 */
let _db = null;

function getDB() {
  if (!_db) {
    _db = init();
  }
  return _db;
}

/**
 * Close database connection
 */
function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Insert LLM call record
 * @param {object} data - Call data
 * @returns {number} Inserted row ID
 */
function insertLLMCall(data) {
  const db = getDB();
  const stmt = db.prepare(`
    INSERT INTO llm_calls (
      timestamp, agent, provider, model, task_type, task_description,
      prompt_hash, prompt_preview, response_preview,
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
      duration_ms, estimated_cost_usd, status, error_message, session_key, metadata
    ) VALUES (
      @timestamp, @agent, @provider, @model, @taskType, @taskDescription,
      @promptHash, @promptPreview, @responsePreview,
      @inputTokens, @outputTokens, @cacheReadTokens, @cacheWriteTokens,
      @durationMs, @estimatedCostUsd, @status, @errorMessage, @sessionKey, @metadata
    )
  `);
  
  const result = stmt.run({
    timestamp: data.timestamp || new Date().toISOString(),
    agent: data.agent,
    provider: data.provider,
    model: data.model,
    taskType: data.taskType || null,
    taskDescription: data.taskDescription || null,
    promptHash: data.promptHash || null,
    promptPreview: data.promptPreview || null,
    responsePreview: data.responsePreview || null,
    inputTokens: data.inputTokens || 0,
    outputTokens: data.outputTokens || 0,
    cacheReadTokens: data.cacheReadTokens || 0,
    cacheWriteTokens: data.cacheWriteTokens || 0,
    durationMs: data.durationMs || null,
    estimatedCostUsd: data.estimatedCostUsd || null,
    status: data.status || 'success',
    errorMessage: data.errorMessage || null,
    sessionKey: data.sessionKey || null,
    metadata: data.metadata ? JSON.stringify(data.metadata) : null
  });
  
  return result.lastInsertRowid;
}

/**
 * Insert API call record
 * @param {object} data - Call data
 * @returns {number} Inserted row ID
 */
function insertAPICall(data) {
  const db = getDB();
  const stmt = db.prepare(`
    INSERT INTO api_calls (
      timestamp, agent, service, endpoint, method, status_code,
      duration_ms, request_size_bytes, response_size_bytes,
      estimated_cost_usd, error_message
    ) VALUES (
      @timestamp, @agent, @service, @endpoint, @method, @statusCode,
      @durationMs, @requestSizeBytes, @responseSizeBytes,
      @estimatedCostUsd, @errorMessage
    )
  `);
  
  const result = stmt.run({
    timestamp: data.timestamp || new Date().toISOString(),
    agent: data.agent || null,
    service: data.service,
    endpoint: data.endpoint || null,
    method: data.method || 'GET',
    statusCode: data.statusCode || null,
    durationMs: data.durationMs || null,
    requestSizeBytes: data.requestSizeBytes || null,
    responseSizeBytes: data.responseSizeBytes || null,
    estimatedCostUsd: data.estimatedCostUsd || null,
    errorMessage: data.errorMessage || null
  });
  
  return result.lastInsertRowid;
}

/**
 * Update daily aggregates (materialized view)
 * @param {string} date - Date string (YYYY-MM-DD)
 */
function updateDailyAggregates(date) {
  const db = getDB();
  
  // Delete existing aggregates for this date
  db.prepare('DELETE FROM daily_aggregates WHERE date = ?').run(date);
  
  // Recalculate from llm_calls
  const stmt = db.prepare(`
    INSERT INTO daily_aggregates (
      date, agent, provider, model, task_type,
      call_count, total_input_tokens, total_output_tokens,
      total_cost_usd, avg_duration_ms, error_count
    )
    SELECT
      date(timestamp) as date,
      agent,
      provider,
      model,
      task_type,
      COUNT(*) as call_count,
      SUM(input_tokens) as total_input_tokens,
      SUM(output_tokens) as total_output_tokens,
      SUM(estimated_cost_usd) as total_cost_usd,
      AVG(duration_ms) as avg_duration_ms,
      SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END) as error_count
    FROM llm_calls
    WHERE date(timestamp) = ?
    GROUP BY date, agent, provider, model, task_type
  `);
  
  stmt.run(date);
}

/**
 * Batch insert multiple records (optimized for logger buffer flush)
 * @param {array} llmCalls - Array of LLM call data
 * @param {array} apiCalls - Array of API call data
 */
function batchInsert(llmCalls = [], apiCalls = []) {
  const db = getDB();
  
  // Use transaction for atomic batch insert
  const transaction = db.transaction(() => {
    for (const call of llmCalls) {
      insertLLMCall(call);
    }
    for (const call of apiCalls) {
      insertAPICall(call);
    }
  });
  
  transaction();
}

module.exports = {
  init,
  getDB,
  close,
  insertLLMCall,
  insertAPICall,
  updateDailyAggregates,
  batchInsert
};
