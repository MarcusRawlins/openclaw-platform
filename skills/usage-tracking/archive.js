#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const db = require('./db');

/**
 * 90-day rolling archive system
 */

/**
 * Get archive database path for a given month
 * @param {string} yearMonth - YYYY-MM format
 * @returns {string} Archive database path
 */
function getArchivePath(yearMonth) {
  const archiveDir = config.archive.archive_dir;
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  return path.join(archiveDir, `${yearMonth}.db`);
}

/**
 * Initialize archive database with same schema
 * @param {string} archivePath - Path to archive database
 * @returns {Database} Archive database instance
 */
function initArchiveDB(archivePath) {
  const archiveDB = new Database(archivePath);
  
  // Use same schema as main database
  archiveDB.exec(`
    CREATE TABLE IF NOT EXISTS llm_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
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
    
    CREATE TABLE IF NOT EXISTS api_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
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
    
    CREATE INDEX IF NOT EXISTS idx_llm_timestamp ON llm_calls(timestamp);
    CREATE INDEX IF NOT EXISTS idx_api_timestamp ON api_calls(timestamp);
  `);
  
  return archiveDB;
}

/**
 * Find old records to archive
 * @param {number} retentionDays - Number of days to retain in main DB
 * @returns {object} { cutoffDate, llmCount, apiCount }
 */
function findOldRecords(retentionDays) {
  const database = db.getDB();
  
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffISO = cutoffDate.toISOString().split('T')[0];
  
  // Count old LLM calls
  const llmStmt = database.prepare(`
    SELECT COUNT(*) as count
    FROM llm_calls
    WHERE date(timestamp) < ?
  `);
  const llmResult = llmStmt.get(cutoffISO);
  
  // Count old API calls
  const apiStmt = database.prepare(`
    SELECT COUNT(*) as count
    FROM api_calls
    WHERE date(timestamp) < ?
  `);
  const apiResult = apiStmt.get(cutoffISO);
  
  return {
    cutoffDate: cutoffISO,
    llmCount: llmResult.count || 0,
    apiCount: apiResult.count || 0
  };
}

/**
 * Archive records for a specific month
 * @param {string} yearMonth - YYYY-MM format
 * @param {string} cutoffDate - Archive records before this date
 * @returns {object} { archived, errors }
 */
function archiveMonth(yearMonth, cutoffDate) {
  const database = db.getDB();
  const archivePath = getArchivePath(yearMonth);
  const archiveDB = initArchiveDB(archivePath);
  
  let archived = { llm: 0, api: 0 };
  let errors = 0;
  
  try {
    // Get LLM calls for this month
    const llmStmt = database.prepare(`
      SELECT * FROM llm_calls
      WHERE strftime('%Y-%m', timestamp) = ?
      AND date(timestamp) < ?
    `);
    const llmRows = llmStmt.all(yearMonth, cutoffDate);
    
    // Insert into archive
    const insertLLM = archiveDB.prepare(`
      INSERT INTO llm_calls (
        id, timestamp, agent, provider, model, task_type, task_description,
        prompt_hash, prompt_preview, response_preview,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        duration_ms, estimated_cost_usd, status, error_message, session_key, metadata
      ) VALUES (
        @id, @timestamp, @agent, @provider, @model, @task_type, @task_description,
        @prompt_hash, @prompt_preview, @response_preview,
        @input_tokens, @output_tokens, @cache_read_tokens, @cache_write_tokens,
        @duration_ms, @estimated_cost_usd, @status, @error_message, @session_key, @metadata
      )
    `);
    
    const insertTransaction = archiveDB.transaction((rows) => {
      for (const row of rows) {
        insertLLM.run(row);
      }
    });
    
    insertTransaction(llmRows);
    archived.llm = llmRows.length;
    
    // Get API calls for this month
    const apiStmt = database.prepare(`
      SELECT * FROM api_calls
      WHERE strftime('%Y-%m', timestamp) = ?
      AND date(timestamp) < ?
    `);
    const apiRows = apiStmt.all(yearMonth, cutoffDate);
    
    // Insert into archive
    const insertAPI = archiveDB.prepare(`
      INSERT INTO api_calls (
        id, timestamp, agent, service, endpoint, method, status_code,
        duration_ms, request_size_bytes, response_size_bytes,
        estimated_cost_usd, error_message
      ) VALUES (
        @id, @timestamp, @agent, @service, @endpoint, @method, @status_code,
        @duration_ms, @request_size_bytes, @response_size_bytes,
        @estimated_cost_usd, @error_message
      )
    `);
    
    const insertAPITransaction = archiveDB.transaction((rows) => {
      for (const row of rows) {
        insertAPI.run(row);
      }
    });
    
    insertAPITransaction(apiRows);
    archived.api = apiRows.length;
    
  } catch (err) {
    console.error(`[Archive] Error archiving ${yearMonth}:`, err.message);
    errors++;
  } finally {
    archiveDB.close();
  }
  
  return { archived, errors };
}

/**
 * Delete archived records from main database
 * @param {string} cutoffDate - Delete records before this date
 * @returns {object} { deleted }
 */
function deleteOldRecords(cutoffDate) {
  const database = db.getDB();
  
  const deleteLLM = database.prepare('DELETE FROM llm_calls WHERE date(timestamp) < ?');
  const deleteAPI = database.prepare('DELETE FROM api_calls WHERE date(timestamp) < ?');
  
  const llmResult = deleteLLM.run(cutoffDate);
  const apiResult = deleteAPI.run(cutoffDate);
  
  return {
    deleted: {
      llm: llmResult.changes || 0,
      api: apiResult.changes || 0
    }
  };
}

/**
 * Vacuum database to reclaim space
 */
function vacuumDatabase() {
  const database = db.getDB();
  database.exec('VACUUM');
}

/**
 * Run archive process
 * @param {boolean} dryRun - If true, only report what would be archived
 * @returns {object} Archive results
 */
function runArchive(dryRun = false) {
  console.log('[Archive] Starting archive process...');
  
  const retentionDays = config.archive.retention_days;
  const old = findOldRecords(retentionDays);
  
  console.log(`[Archive] Found ${old.llmCount} LLM calls and ${old.apiCount} API calls older than ${retentionDays} days`);
  console.log(`[Archive] Cutoff date: ${old.cutoffDate}`);
  
  if (old.llmCount === 0 && old.apiCount === 0) {
    console.log('[Archive] Nothing to archive');
    return { archived: 0, deleted: 0 };
  }
  
  if (dryRun) {
    console.log('[Archive] DRY RUN - no changes made');
    return { dryRun: true, wouldArchive: old };
  }
  
  // Get list of months to archive
  const database = db.getDB();
  const monthsStmt = database.prepare(`
    SELECT DISTINCT strftime('%Y-%m', timestamp) as month
    FROM llm_calls
    WHERE date(timestamp) < ?
    ORDER BY month
  `);
  const months = monthsStmt.all(old.cutoffDate);
  
  let totalArchived = { llm: 0, api: 0 };
  
  // Archive each month
  for (const { month } of months) {
    console.log(`[Archive] Archiving ${month}...`);
    const result = archiveMonth(month, old.cutoffDate);
    totalArchived.llm += result.archived.llm;
    totalArchived.api += result.archived.api;
    console.log(`[Archive]   → Archived ${result.archived.llm} LLM calls, ${result.archived.api} API calls`);
  }
  
  // Delete archived records from main database
  console.log('[Archive] Deleting archived records from main database...');
  const deleted = deleteOldRecords(old.cutoffDate);
  console.log(`[Archive]   → Deleted ${deleted.deleted.llm} LLM calls, ${deleted.deleted.api} API calls`);
  
  // Vacuum to reclaim space
  console.log('[Archive] Running VACUUM to reclaim space...');
  const beforeSize = fs.statSync(config.database.path).size;
  vacuumDatabase();
  const afterSize = fs.statSync(config.database.path).size;
  const saved = ((beforeSize - afterSize) / (1024 * 1024)).toFixed(2);
  console.log(`[Archive]   → Reclaimed ${saved} MB`);
  
  const result = {
    archived: totalArchived,
    deleted: deleted.deleted,
    reclaimedMB: parseFloat(saved)
  };
  
  console.log('[Archive] Complete:', result);
  return result;
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const auto = args.includes('--auto');
  
  if (!auto && !dryRun) {
    console.log('Usage: node archive.js [--auto] [--dry-run]');
    console.log('');
    console.log('Options:');
    console.log('  --auto      Run archive without confirmation');
    console.log('  --dry-run   Show what would be archived without making changes');
    process.exit(0);
  }
  
  try {
    const result = runArchive(dryRun);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[Archive] Fatal error:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runArchive,
  findOldRecords,
  archiveMonth,
  deleteOldRecords,
  vacuumDatabase
};
