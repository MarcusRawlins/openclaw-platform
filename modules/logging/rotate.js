#!/usr/bin/env node
/**
 * Daily Log Rotation
 * Gzip archives for files over threshold, keeps last 1000 lines
 * Cleans old archives beyond retention, archives old DB rows
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const LogDB = require('./db');
const config = require('./config.json');

class LogRotator {
  constructor() {
    this.logDir = config.log_dir;
    this.archiveDir = path.join(this.logDir, 'archive');
    this.maxSizeBytes = (config.rotation.max_size_mb || 50) * 1024 * 1024;
    this.keepRotations = config.rotation.keep_recent || 3;
    this.dbRetentionDays = config.rotation.db_retention_days || 90;
    this.compressionEnabled = config.rotation.archive_compression !== false;
  }

  /**
   * Rotate all JSONL files exceeding threshold
   */
  async rotateJSONL() {
    console.log('Starting JSONL rotation...');
    
    const files = fs.readdirSync(this.logDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(this.logDir, f));
    
    let rotatedCount = 0;
    
    for (const filePath of files) {
      if (this._shouldRotate(filePath)) {
        await this._rotateFile(filePath);
        rotatedCount++;
      }
    }
    
    console.log(`Rotation complete: ${rotatedCount} files rotated`);
    return rotatedCount;
  }

  /**
   * Check if file should be rotated
   */
  _shouldRotate(filePath) {
    const stat = fs.statSync(filePath);
    return stat.size >= this.maxSizeBytes;
  }

  /**
   * Rotate a single file
   */
  async _rotateFile(filePath) {
    const fileName = path.basename(filePath);
    const stat = fs.statSync(filePath);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
    
    // Create monthly archive directory
    const month = new Date().toISOString().substring(0, 7);  // YYYY-MM
    const monthDir = path.join(this.archiveDir, month);
    
    if (!fs.existsSync(monthDir)) {
      fs.mkdirSync(monthDir, { recursive: true });
    }
    
    // Generate archive filename with date
    const date = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
    const archiveName = fileName.replace('.jsonl', `.${date}.jsonl`);
    const archivePath = path.join(monthDir, archiveName);
    
    // Read current file
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    
    // Write full content to archive
    fs.writeFileSync(archivePath, lines.join('\n') + '\n');
    
    // Compress archive
    if (this.compressionEnabled) {
      try {
        execSync(`gzip -f "${archivePath}"`, { stdio: 'ignore' });
        console.log(`  Rotated ${fileName}: ${sizeMB}MB → ${archiveName}.gz`);
      } catch (err) {
        console.error(`  Failed to compress ${archiveName}: ${err.message}`);
      }
    } else {
      console.log(`  Rotated ${fileName}: ${sizeMB}MB → ${archiveName}`);
    }
    
    // Keep last 1000 lines in active file
    const keepLines = lines.slice(-1000);
    fs.writeFileSync(filePath, keepLines.join('\n') + '\n');
  }

  /**
   * Clean old archived months beyond retention
   */
  async cleanOldArchives() {
    if (!fs.existsSync(this.archiveDir)) return;
    
    console.log('Cleaning old archives...');
    
    const months = fs.readdirSync(this.archiveDir)
      .filter(f => /^\d{4}-\d{2}$/.test(f))
      .sort()
      .reverse();
    
    // Keep the most recent N months
    const toDelete = months.slice(this.keepRotations);
    
    for (const month of toDelete) {
      const monthPath = path.join(this.archiveDir, month);
      fs.rmSync(monthPath, { recursive: true, force: true });
      console.log(`  Cleaned old archive: ${month}`);
    }
    
    if (toDelete.length === 0) {
      console.log('  No old archives to clean');
    }
  }

  /**
   * Archive old database rows
   */
  async archiveOldDBRows() {
    console.log('Archiving old database rows...');
    
    const cutoff = new Date(Date.now() - this.dbRetentionDays * 86400000).toISOString();
    const db = new LogDB();
    
    // Count rows to archive
    const countResult = db.db.prepare('SELECT COUNT(*) as count FROM structured_logs WHERE ts < ?').get(cutoff);
    const rowCount = countResult.count;
    
    if (rowCount === 0) {
      console.log('  No old rows to archive');
      db.close();
      return;
    }
    
    // Create monthly archive DB
    const month = cutoff.substring(0, 7);
    const archiveDbPath = path.join(this.archiveDir, `logs-${month}.db`);
    
    // Ensure archive directory exists
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }
    
    const archiveDb = new Database(archiveDbPath);
    
    // Copy schema to archive DB
    const tableSchema = db.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='structured_logs'").get();
    if (tableSchema) {
      archiveDb.exec(tableSchema.sql);
    }
    
    // Move old rows
    const rows = db.db.prepare('SELECT * FROM structured_logs WHERE ts < ?').all(cutoff);
    
    if (rows.length > 0) {
      const insert = archiveDb.prepare(`
        INSERT INTO structured_logs 
        (ts, event, level, agent, source, session, duration_ms, error, data_json, source_file, ingested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const insertAll = archiveDb.transaction((rows) => {
        for (const row of rows) {
          insert.run(
            row.ts, row.event, row.level, row.agent, row.source, row.session,
            row.duration_ms, row.error, row.data_json, row.source_file, row.ingested_at
          );
        }
      });
      
      insertAll(rows);
      
      // Delete from main DB
      db.db.prepare('DELETE FROM structured_logs WHERE ts < ?').run(cutoff);
      db.db.exec('VACUUM');
      
      console.log(`  Archived ${rows.length} rows older than ${this.dbRetentionDays} days → ${path.basename(archiveDbPath)}`);
    }
    
    archiveDb.close();
    db.close();
  }
}

// Main execution
if (require.main === module) {
  const rotator = new LogRotator();
  
  (async () => {
    try {
      await rotator.rotateJSONL();
      await rotator.cleanOldArchives();
      await rotator.archiveOldDBRows();
      process.exit(0);
    } catch (err) {
      console.error('Rotation failed:', err.message);
      console.error(err.stack);
      process.exit(1);
    }
  })();
}

module.exports = LogRotator;
