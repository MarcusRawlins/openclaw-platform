#!/usr/bin/env node
/**
 * Log Viewer CLI
 * Filters by event, level, agent, grep, time range
 * Supports JSONL and SQLite modes, tail, count
 */

const fs = require('fs');
const path = require('path');
const LogDB = require('./db');
const config = require('./config.json');

class LogViewer {
  constructor(options) {
    this.logDir = config.log_dir;
    this.options = options;
  }

  /**
   * Parse time expressions like "1h", "24h", "7d" to timestamp
   */
  _parseTimeExpression(expr) {
    if (!expr) return null;
    
    const match = expr.match(/^(\d+)(m|h|d)$/);
    if (!match) return expr; // Assume ISO timestamp
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    let ms = 0;
    if (unit === 'm') ms = value * 60 * 1000;
    if (unit === 'h') ms = value * 60 * 60 * 1000;
    if (unit === 'd') ms = value * 24 * 60 * 60 * 1000;
    
    return new Date(Date.now() - ms).toISOString();
  }

  /**
   * Get relevant JSONL files to scan
   */
  _getRelevantFiles() {
    const files = [];
    
    if (this.options.event) {
      // Only scan the specific event file
      const eventFile = path.join(this.logDir, `${this.options.event}.jsonl`);
      if (fs.existsSync(eventFile)) {
        files.push(eventFile);
      }
    } else {
      // Scan all.jsonl for all events
      const allFile = path.join(this.logDir, 'all.jsonl');
      if (fs.existsSync(allFile)) {
        files.push(allFile);
      }
    }
    
    return files;
  }

  /**
   * Check if an entry matches all filters
   */
  _matchesFilters(entry) {
    if (this.options.event && entry.event !== this.options.event) return false;
    if (this.options.level && entry.level !== this.options.level) return false;
    if (this.options.agent && entry.agent !== this.options.agent) return false;
    if (this.options.grep && !JSON.stringify(entry).includes(this.options.grep)) return false;
    if (this.options.from && entry.ts < this.options.from) return false;
    if (this.options.to && entry.ts > this.options.to) return false;
    return true;
  }

  /**
   * Print a log entry
   */
  _printEntry(entry) {
    if (this.options.json) {
      console.log(JSON.stringify(entry));
    } else {
      const level = entry.level.toUpperCase().padEnd(5);
      const time = entry.ts.substring(11, 23);  // HH:MM:SS.mmm
      const event = entry.event.padEnd(25);
      const agent = (entry.agent || '').padEnd(8);
      const msg = entry.data?.message || JSON.stringify(entry.data || {}).substring(0, 80);
      console.log(`${time} ${level} ${agent} ${event} ${msg}`);
    }
  }

  /**
   * View logs from JSONL files
   */
  async viewFromJSONL() {
    const files = this._getRelevantFiles();
    const results = [];
    
    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (this._matchesFilters(entry)) {
            results.push(entry);
          }
        } catch (e) {
          // Skip malformed lines
        }
      }
    }
    
    // Sort by timestamp
    results.sort((a, b) => a.ts.localeCompare(b.ts));
    
    // Apply limit
    const limited = this.options.limit ? results.slice(-this.options.limit) : results;
    
    return limited;
  }

  /**
   * View logs from SQLite database
   */
  async viewFromDB() {
    const db = new LogDB();
    const queryOptions = { ...this.options };
    
    // Parse time expressions
    if (this.options.last) {
      queryOptions.from = this._parseTimeExpression(this.options.last);
    }
    
    const results = db.query(queryOptions);
    db.close();
    
    // Convert data_json back to object
    return results.map(row => ({
      ts: row.ts,
      event: row.event,
      level: row.level,
      agent: row.agent,
      source: row.source,
      session: row.session,
      duration_ms: row.duration_ms,
      error: row.error,
      data: row.data_json ? JSON.parse(row.data_json) : {}
    }));
  }

  /**
   * Count matching logs
   */
  async count() {
    if (this.options.db) {
      const db = new LogDB();
      const queryOptions = { ...this.options };
      
      if (this.options.last) {
        queryOptions.from = this._parseTimeExpression(this.options.last);
      }
      
      const count = db.count(queryOptions);
      db.close();
      return count;
    } else {
      const results = await this.viewFromJSONL();
      return results.length;
    }
  }

  /**
   * Tail mode: watch file for new lines
   */
  async tail() {
    const file = this.options.event
      ? path.join(this.logDir, `${this.options.event}.jsonl`)
      : path.join(this.logDir, 'all.jsonl');
    
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }
    
    // Get initial file size
    let pos = fs.statSync(file).size;
    
    console.log(`Tailing ${path.basename(file)}... (Ctrl+C to stop)\n`);
    
    // Watch for changes
    fs.watch(file, (eventType) => {
      if (eventType !== 'change') return;
      
      try {
        const stat = fs.statSync(file);
        if (stat.size > pos) {
          const fd = fs.openSync(file, 'r');
          const buf = Buffer.alloc(stat.size - pos);
          fs.readSync(fd, buf, 0, buf.length, pos);
          fs.closeSync(fd);
          pos = stat.size;
          
          const lines = buf.toString().split('\n').filter(Boolean);
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              if (this._matchesFilters(entry)) {
                this._printEntry(entry);
              }
            } catch (e) {
              // Skip malformed lines
            }
          }
        }
      } catch (err) {
        // File might be rotating, ignore
      }
    });
    
    // Keep process alive
    process.stdin.resume();
  }

  /**
   * Main view function
   */
  async view() {
    // Parse time expressions
    if (this.options.last) {
      this.options.from = this._parseTimeExpression(this.options.last);
      delete this.options.last;
    }
    
    // Choose mode
    const results = this.options.db 
      ? await this.viewFromDB()
      : await this.viewFromJSONL();
    
    // Print results
    for (const entry of results) {
      this._printEntry(entry);
    }
    
    return results.length;
  }
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    
    if (arg === '--event' && next) { options.event = next; i++; }
    else if (arg === '--level' && next) { options.level = next; i++; }
    else if (arg === '--agent' && next) { options.agent = next; i++; }
    else if (arg === '--grep' && next) { options.grep = next; i++; }
    else if (arg === '--from' && next) { options.from = next; i++; }
    else if (arg === '--to' && next) { options.to = next; i++; }
    else if (arg === '--last' && next) { options.last = next; i++; }
    else if (arg === '--limit' && next) { options.limit = parseInt(next); i++; }
    else if (arg === '--json') { options.json = true; }
    else if (arg === '--tail') { options.tail = true; }
    else if (arg === '--count') { options.count = true; }
    else if (arg === '--db') { options.db = true; }
    else if (arg === '--help' || arg === '-h') {
      console.log(`
Log Viewer CLI

Usage:
  node viewer.js [options]

Options:
  --event <name>     Filter by event name
  --level <level>    Filter by level (debug|info|warn|error|fatal)
  --agent <name>     Filter by agent name
  --grep <text>      Filter by text content
  --from <time>      Start time (ISO or relative like 1h, 24h, 7d)
  --to <time>        End time (ISO)
  --last <expr>      Relative time (1h, 24h, 7d)
  --limit <n>        Limit results
  --json             JSON output
  --tail             Tail mode (watch live)
  --count            Count matching entries
  --db               Query from SQLite instead of JSONL
  --help, -h         Show this help

Examples:
  node viewer.js --last 1h
  node viewer.js --event lead.scored --last 24h
  node viewer.js --level error --last 7d
  node viewer.js --grep "timeout" --last 24h
  node viewer.js --agent brunel --last 12h
  node viewer.js --tail --event system.error
  node viewer.js --count --event agent.heartbeat --last 24h
      `);
      process.exit(0);
    }
  }
  
  return options;
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const viewer = new LogViewer(options);
  
  if (options.tail) {
    viewer.tail().catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  } else if (options.count) {
    viewer.count().then(count => {
      console.log(count);
    }).catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  } else {
    viewer.view().then(() => {
      process.exit(0);
    }).catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  }
}

module.exports = LogViewer;
