#!/usr/bin/env node
/**
 * Nightly Log Ingest
 * Parses JSONL files into SQLite for indexed querying
 * Tracks byte offsets, deduplicates, handles rotation
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('fs').promises;
const LogDB = require('./db');
const config = require('./config.json');

class LogIngestor {
  constructor() {
    this.logDir = config.log_dir;
    this.db = new LogDB();
  }

  /**
   * Ingest all JSONL files
   */
  async ingestJSONL() {
    console.log('Starting JSONL ingest...');
    
    const files = fs.readdirSync(this.logDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(this.logDir, f));
    
    let totalInserted = 0;
    
    for (const filePath of files) {
      const inserted = await this._ingestFile(filePath);
      totalInserted += inserted;
    }
    
    console.log(`Ingest complete: ${totalInserted} new entries`);
    return totalInserted;
  }

  /**
   * Ingest a single JSONL file
   */
  async _ingestFile(filePath) {
    const fileName = path.basename(filePath);
    
    // Check last ingested offset
    const state = this.db.getIngestState(filePath);
    const lastOffset = state ? state.last_byte_offset : 0;
    
    // Get current file size
    const stat = fs.statSync(filePath);
    
    // Handle rotation: if file is smaller than last offset, start from 0
    const startOffset = (stat.size < lastOffset) ? 0 : lastOffset;
    
    if (stat.size <= startOffset) {
      // No new data
      return 0;
    }
    
    // Read new bytes only
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(stat.size - startOffset);
    fs.readSync(fd, buf, 0, buf.length, startOffset);
    fs.closeSync(fd);
    
    // Parse and insert
    const lines = buf.toString().split('\n').filter(Boolean);
    let inserted = 0;
    
    // Use transaction for bulk insert
    const insertMany = this.db.db.transaction((entries) => {
      for (const entry of entries) {
        try {
          this.db.insertLog(entry, fileName);
          inserted++;
        } catch (err) {
          // Skip duplicates or malformed entries
        }
      }
    });
    
    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) {
        // Skip malformed lines
      }
    }
    
    insertMany(entries);
    
    // Update offset
    this.db.updateIngestState(filePath, stat.size);
    
    if (inserted > 0) {
      console.log(`  ${fileName}: +${inserted} entries`);
    }
    
    return inserted;
  }

  /**
   * Ingest raw server logs (gateway, LM Studio, etc.)
   */
  async ingestRawLogs() {
    console.log('Starting raw log ingest...');
    
    let totalInserted = 0;
    
    for (const source of config.raw_log_sources || []) {
      const inserted = await this._ingestRawSource(source);
      totalInserted += inserted;
    }
    
    if (totalInserted > 0) {
      console.log(`Raw log ingest complete: ${totalInserted} new entries`);
    }
    
    return totalInserted;
  }

  /**
   * Ingest raw logs from a specific source
   */
  async _ingestRawSource(source) {
    const files = this._expandGlob(source.glob);
    let inserted = 0;
    
    for (const filePath of files) {
      if (!fs.existsSync(filePath)) continue;
      
      // Check last ingested offset
      const state = this.db.getIngestState(filePath);
      const lastOffset = state ? state.last_byte_offset : 0;
      
      // Get current file size
      const stat = fs.statSync(filePath);
      
      if (stat.size <= lastOffset) continue;
      
      // Read new bytes
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(stat.size - lastOffset);
      fs.readSync(fd, buf, 0, buf.length, lastOffset);
      fs.closeSync(fd);
      
      // Parse lines
      const lines = buf.toString().split('\n').filter(Boolean);
      
      for (const line of lines) {
        try {
          const parsed = this._parseRawLog(line, source.name);
          if (parsed) {
            this.db.insertRawLog(parsed);
            inserted++;
          }
        } catch (e) {
          // Skip unparseable lines
        }
      }
      
      // Update offset
      this.db.updateIngestState(filePath, stat.size);
    }
    
    if (inserted > 0) {
      console.log(`  ${source.name}: +${inserted} entries`);
    }
    
    return inserted;
  }

  /**
   * Expand glob pattern (simple implementation)
   */
  _expandGlob(pattern) {
    const dir = path.dirname(pattern);
    const base = path.basename(pattern);
    
    if (!fs.existsSync(dir)) return [];
    
    const regex = new RegExp('^' + base.replace(/\*/g, '.*') + '$');
    return fs.readdirSync(dir)
      .filter(f => regex.test(f))
      .map(f => path.join(dir, f));
  }

  /**
   * Parse a raw log line (basic parser, can be extended)
   */
  _parseRawLog(line, sourceName) {
    // Try to extract timestamp, level, message
    // Format: [2026-02-26 15:30:00] INFO: message
    const match = line.match(/\[([^\]]+)\]\s+(\w+):\s*(.+)/);
    
    if (match) {
      return {
        ts: new Date(match[1]).toISOString(),
        source: sourceName,
        level: match[2].toLowerCase(),
        message: match[3],
        raw_line: line
      };
    }
    
    // Fallback: store as-is
    return {
      source: sourceName,
      message: line,
      raw_line: line
    };
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}

// Main execution
if (require.main === module) {
  const ingestor = new LogIngestor();
  
  (async () => {
    try {
      await ingestor.ingestJSONL();
      await ingestor.ingestRawLogs();
      ingestor.close();
      process.exit(0);
    } catch (err) {
      console.error('Ingest failed:', err.message);
      ingestor.close();
      process.exit(1);
    }
  })();
}

module.exports = LogIngestor;
